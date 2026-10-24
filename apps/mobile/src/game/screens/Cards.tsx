import { cardArt } from '@ratrace/content';
import { cardRarity, chancePct, effectTags, onlyCosts } from '@ratrace/core/game/present';
import type { EffectTag } from '@ratrace/core/game/present';
import { previewCard, quoteItem } from '@ratrace/engine';
import type { CardDef, GameEvent, GameView, OptionPreview, SkillId, WorldState } from '@ratrace/engine';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useKeyframes, useRise } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { CREAM, GOLD } from '../../ui/frames';
import { Panel, reach, Tag, useInlineRow, usePress } from '../../ui/kit';
import { dialogOpen, focusedMark, focusMarked, KeyboardHint, pressMarked, useKeyboardMode, useKeyboardScope } from '../../ui/keyboard';
import { perfStart } from '../../ui/perf';
import { LinkText } from '../../ui/LinkText';
import { Glint, Holo } from '../../ui/Shine';
import { Sparks } from '../../ui/Sparks';
import { ArtScale, Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, TOUCH } from '../../ui/theme';
import { useGame, useStill, useT, useWords } from '../context';
import { CareerPreview } from './CareerPreview';
import { Celebrations } from './Celebrations';
import { FlyingCoins, useCoinTarget } from './FlyingCoins';
import { JailSheet } from './Jail';
import { CityPreview } from './Finance';

/*
 * The web's Cards.tsx on a phone: the card waiting (`CardStage`), swiped or answered with a tap, and what came of it (`Outcome`). What the
 * phone leaves out: the keyboard (digits, arrows, the focus that follows a new card, the hints of keys), and `Pending`, the card a server
 * is still answering (only a ranked life is played by a server, and a phone plays its lives itself).
 */

/** How far a card must be dragged before letting go answers it. */
export const SWIPE = 90;

/** The stage's gaps (the web's `gap-3`, the choices' `gap-2.5`, a choice and its links' `gap-1`): what a link under a choice may reach into. */
const STAGE_GAP = 12;
const CHOICES_GAP = 10;
const LINKS_GAP = 4;

/** How far a finger goes sideways before a touch on the card is a drag, and up or down before it is the page's scroll (the web's `touch-pan-y`). */
const ACTIVATE = 6;
const CANCEL = 10;

/**
 * The spring a card let go of goes back on: motion's own for a drag that snaps to where it began (`dragSnapToOrigin` with `dragElastic` set,
 * VisualElementDragControls: stiffness 200, damping 40), from the speed it was let go at. The web's, not a step of its stylesheet.
 */
const SNAP = { stiffness: 200, damping: 40, mass: 1 };

/** The tilt of a card dragged `x` points: the web's `useTransform(x, [-160, 160], [-6, 6])`, which holds its ends. */
export function tiltOf(x: number): number {
  'worklet';
  return Math.max(-6, Math.min(6, (x * 6) / 160));
}

/**
 * Where a scene holds the shine of a rare card still, so that its picture is the web's at one moment (the web's scene page holds its
 * stylesheet's animations at the same points): the rainbow and the band of light at these points of their runs (0 to 1), the sparks at theirs.
 * Left out, as in the game, all of it plays.
 */
export const HeldShine = createContext<{ holo: number; glint: number; spark: number } | null>(null);

/**
 * What a thing a card hands over is worth in status to the player as they stand, the engine's figure:
 * before the choice, what it would add; after it, what it counts for among what they own.
 */
function useItemStatus(view: GameView | null): ((itemId: string) => number) | undefined {
  const { content } = useWords();
  return view ? (itemId) => quoteItem(content, view, itemId).statusReal : undefined;
}

/**
 * What an option does, as tags (the web's `flex flex-wrap gap-1`), or the words `empty` when it does nothing. Each tag may wrap its own words on a
 * narrow phone, as the web's inline block does, instead of running past the edge. `dim` fades them, on a choice that cannot be taken; `shrink` lets
 * them take what is left of a row (the line of an outcome, beside its chance).
 */
function Tags({ cash, tags, empty, dim = false, shrink = false }: { cash: number; tags: EffectTag[]; empty?: string; dim?: boolean; shrink?: boolean }) {
  const { fmt } = useWords();
  const box: ViewStyle = { ...(shrink ? { flexShrink: 1, minWidth: 0 } : null), ...(dim ? { opacity: 0.5 } : null) };
  if (cash === 0 && tags.length === 0) {
    return empty ? (
      <View style={box}>
        <ReadText size={12} tone="ink-300">{empty}</ReadText>
      </View>
    ) : null;
  }
  const tagged = (tone: EffectTag['tone'], words: string, key: string | number) => (
    <View key={key} style={{ flexShrink: 1, maxWidth: '100%' }}>
      <Tag tone={tone}>{words}</Tag>
    </View>
  );
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }, box]}>
      {cash !== 0 ? tagged(cash > 0 ? 'good' : 'bad', fmt.briefSigned(cash), 'cash') : null}
      {tags.map((tag, i) => tagged(tag.tone, tag.text, i))}
    </View>
  );
}

/** What one option of a card offers: its label, what it costs and does, and the odds of each thing it may bring. */
function Offer({ def, index, preview, world, partnered }: { def: CardDef; index: number; preview: OptionPreview; world: WorldState; partnered: boolean }) {
  const t = useT('cards');
  const effects = useT('effects');
  const words = useWords();
  const option = def.options[index];
  // What the player is paid or pays every year: an outcome may end one of them.
  const owned = useGame((s) => s.view?.player.life.recurring);
  const itemStatus = useItemStatus(useGame((s) => s.view));
  const written = words.text.cards[def.id].options[index];
  let total = 0;
  for (const outcome of preview.outcomes) total += outcome.weight;
  // What cannot be chosen is dimmed part by part, not as a whole: the reason it is locked must stay easy to read.
  const dim = !preview.available;
  // A skill the player lacks is named, with the level it takes: it is something to work towards.
  const lockWords = (lock: NonNullable<OptionPreview['lock']>) => {
    const wanted = lock === 'skill' ? Object.entries(option.when?.minSkills ?? {})[0] : undefined;
    return wanted ? t('needsSkill', { skill: words.text.skills[wanted[0] as SkillId], level: wanted[1] }) : words.text.optionLocks[lock];
  };

  // A choice that is there because of what the player has made of themselves says so: a skill, a cover, a trade.
  const skill = Object.keys(option.when?.minSkills ?? {})[0] as SkillId | undefined;
  const thanks = skill
    ? t('thanksSkill', { skill: words.text.skills[skill] })
    : option.when?.insured
      ? t('thanksCover', { cover: words.text.insurance[option.when.insured].replace(/^./, (first) => first.toLowerCase()) })
      : option.when?.careers
        ? t('thanksTrade')
        : null;
  const covers = preview.covered > 0 ? [{ tone: 'good' as const, text: t('covers', { amount: words.fmt.brief(preview.covered) }) }] : [];

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexShrink: 1, minWidth: 0, ...(dim ? { opacity: 0.5 } : null) }}>
          <PixelText size={16}>{written.label}</PixelText>
        </View>
        {preview.available ? (
          thanks ? (
            <View style={{ flexShrink: 0, backgroundColor: COLORS['teal-800'], paddingHorizontal: 6, paddingVertical: 2 }}>
              <PixelText size={11} tone="teal-300" style={{ letterSpacing: 11 * 0.05, textTransform: 'uppercase' }}>{thanks}</PixelText>
            </View>
          ) : null
        ) : (
          <Tag tone="bad">{t('locked')}</Tag>
        )}
      </View>
      {/* Why it is locked is the engine's to say. */}
      {preview.lock ? <ReadText size={13} lineHeight={13 * SNUG}>{lockWords(preview.lock)}</ReadText> : null}
      <Tags cash={preview.cash} tags={[...effectTags(words, effects, world, option.effects, partnered, [], itemStatus), ...covers]} dim={dim} />
      {(option.outcomes ?? []).map((outcome, k) => {
        const outcomeTags = (said: typeof outcome.effects) => {
          const tags = effectTags(words, effects, world, said, partnered, [...(option.effects?.recurring ?? []), ...(owned ?? [])], itemStatus);
          // Nothing more on top of an option that only cost: what was put in is gone, and that is said in red.
          return tags.length === 0 && preview.outcomes[k].cash === 0 && onlyCosts(option.effects) ? [{ tone: 'bad' as const, text: t('lostStake') }] : tags;
        };
        return (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, ...(dim ? { opacity: 0.5 } : null) }}>
            <PixelText size={13} tone="gold-500" style={{ width: 48, flexShrink: 0, textAlign: 'right' }}>{t('chance', { pct: chancePct(preview.outcomes[k].weight, total) })}</PixelText>
            {/* An outcome that changes nothing more leaves the option as it says: that is how it goes, not nothing at all. */}
            <Tags cash={preview.outcomes[k].cash} tags={outcomeTags(outcome.effects)} empty={t('asPlanned')} shrink />
          </View>
        );
      })}
    </>
  );
}

/** The web's `outline outline-2 outline-gold-500` round the option taken: a ring 2 outside its box, corners and all, over its frame. */
const RING: readonly ViewStyle[] = [
  { top: -2, left: -2, right: -2, height: 2 },
  { bottom: -2, left: -2, right: -2, height: 2 },
  { top: 0, bottom: 0, left: -2, width: 2 },
  { top: 0, bottom: 0, right: -2, width: 2 },
];

/**
 * Words that open a sheet, underlined as the web underlines them (`underline underline-offset-N` under a line of `size` × 1.45), every line they
 * wrap to (the kit's `LinkText`). A thumb has 44 points of it: its box is that tall already
 * (`style`), or it reaches into the `room` round it (the kit's `reach`), and where that room is too little, it takes the rest under its line.
 */
function Link({ size, offset, onPress, style, room, children }: { size: number; offset: number; onPress(): void; style?: ViewStyle; room?: { above: number; below: number }; children: string }) {
  const press = usePress({ onPress });
  const line = size * 1.45;
  const box = room ? reach(line, room, { grow: true }).style : null;
  return (
    <Pressable accessibilityRole="button" onPress={press} style={[box, style]}>
      <LinkText size={size} offset={offset}>{children}</LinkText>
    </Pressable>
  );
}

/** The web's `transition-[transform,opacity]` on a choice: Tailwind's 150 ms, on its curve (cubic-bezier(0.4, 0, 0.2, 1)). */
const SETTLE = { duration: 150, easing: Easing.bezier(0.4, 0, 0.2, 1) };

/**
 * A choice easing into its look as it changes (the web's `transition-[transform,opacity]`): 2 down while it is held or taken, half faded once
 * another is taken. It eases on the phone's animation thread, and React draws it once a change, not once a frame. Where motion is left out it is
 * there at once, as the web's every transition is then.
 */
function Settling({ down, faded, children }: { down: boolean; faded: boolean; children: ReactNode }) {
  const still = useStill();
  const y = useSharedValue(down ? 2 : 0);
  const fade = useSharedValue(faded ? 0.5 : 1);
  // Where each is going: it moves only when that changes (nothing eases on the first drawing), and stops if the choice goes.
  const aimed = useRef({ y: down ? 2 : 0, fade: faded ? 0.5 : 1 });
  useEffect(() => {
    const to = down ? 2 : 0;
    if (aimed.current.y === to) return;
    aimed.current.y = to;
    y.value = still ? to : withTiming(to, SETTLE);
  }, [down, still, y]);
  useEffect(() => {
    const to = faded ? 0.5 : 1;
    if (aimed.current.fade === to) return;
    aimed.current.fade = to;
    fade.value = still ? to : withTiming(to, SETTLE);
  }, [faded, still, fade]);
  useEffect(
    () => () => {
      cancelAnimation(y);
      cancelAnimation(fade);
    },
    [y, fade],
  );
  const look = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateY: y.value }] }));
  return <Animated.View style={look}>{children}</Animated.View>;
}

/** One option of a card, to be chosen. `below` is the gap to what follows it, which a link under it reaches into no further. */
function Option({ def, index, preview, onPick, disabled, below, shortcut }: { def: CardDef; index: number; preview: OptionPreview; onPick(): void; disabled: boolean; below: number; shortcut?: string }) {
  const world = useGame((s) => s.view?.timeline[s.view.round]);
  const partnered = useGame((s) => s.view?.player.life.partner ?? false);
  // The option tapped is shown taken at once, pressed and lit, and the others step back, while the answer is on its way.
  const picked = useGame((s) => s.picked);
  const view = useGame((s) => s.view);
  const t = useT('cards');
  const words = useWords();
  const [seeing, setSeeing] = useState<'career' | 'city' | null>(null);
  const off = disabled || !preview.available;
  const press = usePress({ onPress: onPick, disabled: off });
  // On the web, once a keyboard is in use, the digit that picks it in its corner, its room kept (the web's `padding-right: 2.75rem`).
  const keyboard = useKeyboardMode() && shortcut !== undefined;
  if (!world || !view) return null;
  const taken = picked === index;
  // An option that takes the player into another career can show that career whole before it is chosen.
  const job = def.options[index]?.effects?.job;
  const career = job?.career;
  // An option that moves the player can show the city beside theirs before it is chosen.
  const city = def.options[index]?.effects?.moveCity;
  // Drawn once, whatever the press does: only the box round it eases.
  const face = (
    <Framed kind="raised" style={{ backgroundColor: COLORS['night-700'], minHeight: TOUCH, paddingHorizontal: 12, paddingRight: keyboard ? 44 : 12, paddingVertical: 8, gap: 6 }}>
      <Offer def={def} index={index} preview={preview} world={world} partnered={partnered} />
      {shortcut !== undefined ? <KeyboardHint>{shortcut}</KeyboardHint> : null}
      {taken ? RING.map((side, i) => <View key={i} pointerEvents="none" style={{ position: 'absolute', backgroundColor: COLORS['gold-500'], ...side }} />) : null}
    </Framed>
  );
  const option = (
    <Pressable {...{ dataSet: { cardOption: index } }} accessibilityRole="button" accessibilityState={{ disabled: off, selected: taken }} aria-selected={taken} disabled={off} onPress={press}>
      {/* The web's buttons are not faded when they cannot be pressed: only the ones not taken step back, once one is. */}
      {({ pressed }) => (
        <Settling down={taken || (pressed && !off)} faded={picked !== null && !taken}>
          {face}
        </Settling>
      )}
    </Pressable>
  );
  if (!career && !city) return option;
  // A link reaches up to its choice (whose frame's strips take no touch) and down to what follows; between two choices that is too little for a
  // thumb's 44, so it stands that much further from the next (a phone's own room: the web's link is its 17-point line).
  const room = { above: LINKS_GAP, below };
  return (
    <View style={{ gap: LINKS_GAP }}>
      {option}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: 12 }}>
        {city ? (
          <Link size={12} offset={2} room={room} onPress={() => setSeeing('city')} style={{ paddingHorizontal: 4 }}>
            {t('seeCity', { city: words.names.cities[city] })}
          </Link>
        ) : null}
        {career ? (
          <Link size={12} offset={2} room={room} onPress={() => setSeeing('career')} style={{ paddingHorizontal: 4 }}>
            {t('seeCareer', { career: words.text.careers[career].name })}
          </Link>
        ) : null}
      </View>
      {seeing === 'career' && career ? <CareerPreview careerId={career} startLevel={job?.level ?? 0} shown={view} onClose={() => setSeeing(null)} /> : null}
      {seeing === 'city' && city ? <CityPreview cityId={city} view={view} onClose={() => setSeeing(null)} /> : null}
    </View>
  );
}

/**
 * A card coming in, once (the stage keys each card by its id, so each is drawn anew): a legendary one turning over (`animate-legend`), any other
 * rising (`animate-rise`). Only the box moves: what is in it is not drawn again for it.
 */
function Entrance({ legendary, children }: { legendary: boolean; children: ReactNode }) {
  const entrance = useKeyframes(legendary ? 'legend' : 'rise');
  return <Animated.View style={entrance}>{children}</Animated.View>;
}

/**
 * The card itself, as wide as its picture (the web's `calc(288px * var(--art) + 4px)`): its picture in a cream mat, its title and its words. A
 * rare one is framed in gold and catches the light now and then; a legendary one shimmers all over and throws sparks.
 */
function Card({ def }: { def: CardDef }) {
  const { text } = useWords();
  const art = useContext(ArtScale);
  const held = useContext(HeldShine);
  const rarity = cardRarity(def);
  const written = text.cards[def.id];
  const picture = { w: 288 * art, h: 120 * art };
  return (
    <View role="article" style={{ width: picture.w + 4 }}>
      <Framed kind="frame" tone={rarity ? GOLD : CREAM} style={{ backgroundColor: COLORS.cream }}>
        {/* The web's `border-2 border-cream`, and inside it the box the light is clipped to. */}
        <View style={{ padding: 2 }}>
          <View style={{ overflow: 'hidden' }}>
            <Sprite id={cardArt[def.id] ?? ''} scale="art" fallback={{ w: 288, h: 120 }}>
              {/* A rare card catches the light now and then; a legendary one shimmers all over. */}
              {rarity === 'legendary' ? <Holo width={picture.w} height={picture.h} held={held?.holo} /> : null}
            </Sprite>
            {rarity ? <Glint held={held?.glint} /> : null}
          </View>
        </View>
        {rarity === 'legendary' ? <Sparks colours={['gold-500', 'teal-300', 'cream', 'wine-300']} count={16} reach={150} size={4} delayMs={450} held={held?.spark} /> : null}
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 8 }}>
          <View accessibilityRole="header">
            <PixelText size={19} tone="ink-900">{written.title}</PixelText>
          </View>
          <ReadText size={14} lineHeight={14 * SNUG} tone="ink-700" style={{ marginTop: 4 }}>{written.body}</ReadText>
        </View>
      </Framed>
    </View>
  );
}

/**
 * The card, dragged sideways where it can be (the web's `drag="x" dragSnapToOrigin`): it follows the finger on the phone's animation thread,
 * tilting as it goes, and springs back when let go. Let go past `SWIPE` points, it answers: `onRelease` is told which side, on React's side.
 * Nothing of React is drawn while it moves. A swipe cut short by the phone (a cancel) answers nothing.
 */
function Swiped({ enabled, onRelease, children }: { enabled: boolean; onRelease(side: 1 | -1): void; children: ReactNode }) {
  const x = useSharedValue(0);
  const pan = usePanGesture({
    enabled,
    activeOffsetX: [-ACTIVATE, ACTIVATE],
    failOffsetY: [-CANCEL, CANCEL],
    onUpdate: (event) => {
      'worklet';
      x.value = event.translationX;
    },
    onDeactivate: (event) => {
      'worklet';
      if (!event.canceled && Math.abs(event.translationX) > SWIPE) scheduleOnRN(onRelease, event.translationX > 0 ? 1 : -1);
      x.value = withSpring(0, { ...SNAP, velocity: event.velocityX });
    },
  });
  const swing = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: `${tiltOf(x.value)}deg` }] }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ alignSelf: 'center' }, swing]}>{children}</Animated.View>
    </GestureDetector>
  );
}

/** The card on screen. A card with two options can be swiped; every card can be answered with a tap. */
export function CardStage() {
  const t = useT('cards');
  const jailT = useT('jail');
  const { content, text } = useWords();
  const still = useStill();
  const view = useGame((s) => s.view);
  const busy = useGame((s) => s.busy);
  const pick = useGame((s) => s.pick);
  const [seeingJail, setSeeingJail] = useState(false);

  // The card to answer is the next one of the hand, judged as the player stands after the ones before it.
  const waiting = view !== null && view.phase === 'cards';
  const cardId = waiting ? view.hand[view.answered] : undefined;
  const def = content.cards.find((card) => card.id === cardId);
  const previews = useMemo(() => (view && def && waiting ? previewCard(content, view, def.id) : []), [content, view, def, waiting]);
  // A choice the player cannot take is not shown at all.
  const shown = previews.flatMap((preview, index) => (preview.available ? [index] : []));
  // Two choices on screen can be swiped, left for the first and right for the second.
  const swipeable = shown.length === 2 && !still && !busy;
  // What a swipe let go of is judged by: the drawing on screen's, whenever the phone's thread says it was let go (kept as each is put on screen).
  const latest = useRef({ shown, swipeable, pick });
  useLayoutEffect(() => {
    latest.current = { shown, swipeable, pick };
  });
  const release = useCallback((side: 1 | -1) => {
    perfStart('swipe');
    const now = latest.current;
    if (!now.swipeable) return;
    void now.pick(side > 0 ? now.shown[1] : now.shown[0]);
  }, []);
  // The keyboard (the web's, docs/keyboard.md): a digit picks the choice it numbers at once, a held one never the next card's too; the arrows, Home
  // and End move among the choices, Enter or Space then taking the one in focus. A card met with the keyboard puts its first choice in focus.
  const keyboard = useKeyboardMode();
  // What can be taken now: a choice shown that is open to the player, and none while an answer is on its way (the web's `enabled`). The digits
  // count what is shown.
  const enabled = busy ? [] : shown.filter((index) => previews[index].available);
  useKeyboardScope(
    (event) => {
      if (!waiting || enabled.length === 0 || event.altKey || event.ctrlKey || event.metaKey || dialogOpen()) return false;
      if (event.repeat && /^[1-4]$/.test(event.key)) return true;
      if (/^[1-4]$/.test(event.key)) {
        const index = shown[Number(event.key) - 1];
        return index !== undefined && enabled.includes(index) && pressMarked('card-option', index);
      }
      const direction = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      if (!direction && event.key !== 'Home' && event.key !== 'End') return false;
      const active = Number(focusedMark('card-option') ?? Number.NaN);
      const at = enabled.includes(active) ? enabled.indexOf(active) : 0;
      const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled[enabled.length - 1] : enabled[(at + direction + enabled.length) % enabled.length];
      focusMarked('card-option', next);
      return true;
    },
    { active: waiting, priority: 20 },
  );
  const first = enabled[0];
  useEffect(() => {
    if (!keyboard || def === undefined || first === undefined) return;
    const frame = requestAnimationFrame(() => focusMarked('card-option', first));
    return () => cancelAnimationFrame(frame);
    // The card deliberately takes the focus to its first choice; which are shown belongs to that card. Once an answer on its way is given up (the
    // card back, still busy for a moment: a server that never answered), the first choice takes it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def?.id, keyboard, busy]);
  if (!view || !def) return null;

  const written = text.cards[def.id];
  // A choice that may end in prison says what prison is, beside the choices, never inside one.
  const mayJail = shown.some((i) => def.options[i].effects?.jail !== undefined || (def.options[i].outcomes ?? []).some((outcome) => outcome.effects?.jail !== undefined));

  return (
    <View style={{ gap: STAGE_GAP }}>
      <PixelText size={13} tone="ink-300" style={{ textAlign: 'center' }}>
        {`${t('progress', { n: view.answered + 1, total: view.hand.length })} · ${def.category === 'world' ? t('world') : text.categories[def.category]}`}
      </PixelText>

      <Swiped key={def.id} enabled={swipeable} onRelease={release}>
        <Entrance legendary={cardRarity(def) === 'legendary'}>
          <Card def={def} />
        </Entrance>
      </Swiped>

      <View role="group" aria-label={t('choices', { title: written.title })} style={{ gap: CHOICES_GAP }}>
        {shown.map((i, at) => (
          <Option key={`${def.id}-${i}`} def={def} index={i} preview={previews[i]} onPick={() => void pick(i)} disabled={busy} below={at === shown.length - 1 ? STAGE_GAP : CHOICES_GAP} shortcut={at < 4 ? String(at + 1) : undefined} />
        ))}
      </View>
      {swipeable ? (
        // A swipe cannot be taken back, so each side says what it picks. The buttons above say the same to a screen reader.
        <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <ReadText size={12} tone="ink-300" numberOfLines={1} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>{`← ${written.options[shown[0]].label}`}</ReadText>
          <ReadText size={12} tone="ink-300" numberOfLines={1} style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>{`${written.options[shown[1]].label} →`}</ReadText>
        </View>
      ) : null}
      {swipeable ? (
        <ReadText size={12} tone="ink-300" style={{ textAlign: 'center' }}>
          {t('swipe')}
        </ReadText>
      ) : null}
      {mayJail ? (
        <Link size={13} offset={4} onPress={() => setSeeingJail(true)} style={{ minHeight: TOUCH, alignSelf: 'center', justifyContent: 'center' }}>
          {jailT('see')}
        </Link>
      ) : null}
      <JailSheet open={seeingJail} onClose={() => setSeeingJail(false)} />
    </View>
  );
}

/** How long the result of a card is on screen before what it paid flies to the cash: once its panel has risen. */
const COINS_AFTER_MS = 450;

/**
 * The name the lines a card's result paid from go by on the page coins fly over (FlyingCoins.tsx: names are the whole page's, so each stage
 * that flies coins has its own).
 */
const PAID_FROM = 'card';

/**
 * The box of what a card changed, as the web's `inline-block` span: as wide as its tags, and as tall as the line of words it stands in makes it
 * (`useInlineRow`, where there are tags: the words of nothing changing are a line of their own). One that paid is where its coins fly from.
 */
const CHANGES_BOX: ViewStyle = { alignSelf: 'flex-start', maxWidth: '100%' };
function ChangesBox({ paid, inline, children }: { paid: boolean; inline: boolean; children: ReactNode }) {
  const place = useCoinTarget(PAID_FROM);
  const row = useInlineRow();
  return (
    <View ref={paid ? place : undefined} collapsable={false} style={inline ? [CHANGES_BOX, row] : CHANGES_BOX}>
      {children}
    </View>
  );
}

/** The card answered, as it was, rising into view: the choice made, what followed, what the cover paid and how likely what came up was. */
function Answered({ event }: { event: Extract<GameEvent, { kind: 'card' }> }) {
  const t = useT('cards');
  const words = useWords();
  const { text } = words;
  const offered = useGame((s) => s.offered);
  const art = useContext(ArtScale);
  const rise = useRise();
  const written = text.cards[event.cardId];
  const option = written.options[event.option];
  // The card as it stood when it was answered. Without it, as after a reload, the result is told without the odds.
  const was = offered && offered.cardId === event.cardId ? offered : null;
  const odds = was?.options[event.option]?.outcomes ?? [];
  let total = 0;
  for (const outcome of odds) total += outcome.weight;
  // What the player's cover paid, when it paid: the reason to have it.
  const covered = was?.options[event.option]?.covered ?? 0;
  return (
    // As wide as its picture, like the card it was, and never wider than the page.
    <Animated.View style={rise}>
      <View role="article" style={{ width: 288 * art + 4, maxWidth: '100%', alignSelf: 'center' }}>
        <Framed kind="frame" tone={CREAM} style={{ backgroundColor: COLORS.cream }}>
          <View style={{ padding: 2 }}>
            <Sprite id={cardArt[event.cardId] ?? ''} scale="art" fallback={{ w: 288, h: 120 }} />
          </View>
          <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 8 }}>
            <View accessibilityRole="header">
              <PixelText size={19} tone="ink-900">{written.title}</PixelText>
            </View>
            <PixelText size={13} tone="ink-500" style={{ marginTop: 2, letterSpacing: 13 * 0.05, textTransform: 'uppercase' }}>{t('chose', { label: option.label })}</PixelText>
            {/* What followed: the line of the outcome the dice gave, or the line of the choice itself. */}
            <ReadText size={15} lineHeight={15 * SNUG} tone="ink-900" style={{ marginTop: 8 }}>{(event.outcome !== null ? option.outcomes[event.outcome] : option.after) ?? ''}</ReadText>
            {covered > 0 ? (
              <PixelText size={14} tone="teal-800" style={{ marginTop: 8 }}>
                {t('saved', { amount: words.fmt.money(covered) })}
              </PixelText>
            ) : null}
            {event.outcome !== null && total > 0 ? (
              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: COLORS['ink-900'], paddingHorizontal: 6, paddingVertical: 2 }}>
                  <PixelText size={13} tone="gold-500">{t('chance', { pct: chancePct(odds[event.outcome]?.weight ?? 0, total) })}</PixelText>
                </View>
                <ReadText size={13} tone="ink-700" style={{ flexShrink: 1 }}>{t('rolled')}</ReadText>
              </View>
            ) : null}
          </View>
        </Framed>
      </View>
    </Animated.View>
  );
}

/** Everything the card answered changed, in a panel that rises after it. Money a card paid flies from here to the cash in the HUD. */
function Changes({ event, itemStatus }: { event: Extract<GameEvent, { kind: 'card' }>; itemStatus?: (itemId: string) => number }) {
  const t = useT('cards');
  const effects = useT('effects');
  const words = useWords();
  const offered = useGame((s) => s.offered);
  const playerPartnered = useGame((s) => s.view?.player.life.partner ?? false);
  const rise = useRise();
  const def = words.content.cards.find((card) => card.id === event.cardId);
  const chosen = def?.options[event.option];
  const rolled = event.outcome === null ? undefined : chosen?.outcomes?.[event.outcome];
  const was = offered && offered.cardId === event.cardId ? offered : null;
  const world = was?.world;
  const partnered = offered?.cardId === event.cardId ? offered.partnered : playerPartnered;
  const tags = world ? [...effectTags(words, effects, world, chosen?.effects, partnered, [], itemStatus), ...effectTags(words, effects, world, rolled?.effects, partnered, chosen?.effects?.recurring ?? [], itemStatus)] : [];
  const changes = <Tags cash={event.cash} tags={tags} empty={t('nothing')} />;
  return (
    <Animated.View style={rise}>
      <View role="region" aria-label={t('changes')}>
        <Panel title={t('changes')}>
          <ChangesBox paid={event.cash > 0} inline={event.cash !== 0 || tags.length > 0}>{changes}</ChangesBox>
        </Panel>
      </View>
    </Animated.View>
  );
}

/**
 * What the card just answered did: its picture again, the choice made and what followed from it,
 * what the dice said when there were dice, and everything it changed. Nothing is worked out
 * here: the figures are the engine's.
 */
export function Outcome() {
  const view = useGame((s) => s.view);
  const itemStatus = useItemStatus(view);
  const t = useT('cards');
  const { text, fmt } = useWords();
  const events = useGame((s) => s.cardEvents);
  const cards = events.filter((e): e is Extract<GameEvent, { kind: 'card' }> => e.kind === 'card');
  const money = events.filter((e): e is Extract<GameEvent, { kind: 'ledger' }> => e.kind === 'ledger');

  const paid = cards.some((event) => event.cash > 0);
  return (
    <View style={{ gap: 12 }}>
      {paid ? <FlyingCoins from={PAID_FROM} to="cash" startMs={COINS_AFTER_MS} /> : null}
      <View accessibilityRole="header">
        <PixelText size={20} tone="gold-500" style={{ textAlign: 'center' }}>
          {t('results')}
        </PixelText>
      </View>
      <Celebrations />
      {cards.map((event) => (
        <View key={event.cardId} style={{ gap: 12 }}>
          <Answered event={event} />
          <Changes event={event} itemStatus={itemStatus} />
        </View>
      ))}
      {money.length > 0 ? (
        <Panel>
          {money.map((event, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 2 }}>
              <ReadText size={14} style={{ flexShrink: 1 }}>{text.ledger[event.line]}</ReadText>
              <PixelText size={14}>{fmt.signed(event.amount)}</PixelText>
            </View>
          ))}
        </Panel>
      ) : null}
    </View>
  );
}
