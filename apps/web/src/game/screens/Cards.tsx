'use client';

import { cardArt } from '@ratrace/content';
import { previewCard } from '@ratrace/engine';
import type { CardDef, GameEvent, OptionPreview, SkillId, WorldState } from '@ratrace/engine';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, useSettings, useT, useWords } from '@/game/context';
import { cardRarity, chancePct, effectTags, onlyCosts } from '@/game/present';
import type { EffectTag } from '@/game/present';
import { Panel, Tag } from '@/ui/kit';
import { Sparks } from '@/ui/Sparks';
import { Sprite } from '@/ui/Sprite';
import { CareerPreview } from './CareerPreview';
import { Celebrations } from './Celebrations';
import { FlyingCoins } from './FlyingCoins';
import { KeyboardHint, useKeyboard, useKeyboardScope } from '@/ui/keyboard';

/** How far a card must be dragged before letting go answers it. */
const SWIPE = 90;

function Tags({ cash, tags, empty, className = '' }: { cash: number; tags: EffectTag[]; empty?: string; className?: string }) {
  const { fmt } = useWords();
  if (cash === 0 && tags.length === 0) return empty ? <span className={`text-[12px] text-ink-300 ${className}`}>{empty}</span> : null;
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {cash !== 0 ? <Tag tone={cash > 0 ? 'good' : 'bad'}>{fmt.briefSigned(cash)}</Tag> : null}
      {tags.map((tag, i) => (
        <Tag key={i} tone={tag.tone}>
          {tag.text}
        </Tag>
      ))}
    </span>
  );
}

/** What one option of a card offers: its label, what it costs and does, and the odds of each thing it may bring. */
function Offer({ def, index, preview, world, shortcut, partnered }: { def: CardDef; index: number; preview: OptionPreview; world: WorldState; shortcut?: number; partnered: boolean }) {
  const t = useT('cards');
  const effects = useT('effects');
  const words = useWords();
  const option = def.options[index];
  // What the player is paid or pays every year: an outcome may end one of them.
  const owned = useGame((s) => s.view?.player.life.recurring);
  const written = words.text.cards[def.id].options[index];
  let total = 0;
  for (const outcome of preview.outcomes) total += outcome.weight;
  // What cannot be chosen is dimmed part by part, not as a whole: the reason it is locked must stay easy to read.
  const dim = preview.available ? '' : 'opacity-50';
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

  return (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className={`pixel flex items-center gap-2 text-[16px] ${dim}`}>
          {written.label}
          {shortcut ? <KeyboardHint>{shortcut}</KeyboardHint> : null}
        </span>
        {preview.available ? (thanks ? <span className="pixel shrink-0 bg-teal-800 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-teal-300">{thanks}</span> : null) : <Tag tone="bad">{t('locked')}</Tag>}
      </span>
      {/* Why it is locked is the engine's to say. */}
      {preview.lock ? <span className="text-[13px] leading-snug text-cream">{lockWords(preview.lock)}</span> : null}
      <Tags cash={preview.cash} tags={[...effectTags(words, effects, world, option.effects, partnered), ...(preview.covered > 0 ? [{ tone: 'good' as const, text: t('covers', { amount: words.fmt.brief(preview.covered) }) }] : [])]} className={dim} />
      {(option.outcomes ?? []).map((outcome, k) => {
        const outcomeTags = (said: typeof outcome.effects) => {
          const tags = effectTags(words, effects, world, said, partnered, [...(option.effects?.recurring ?? []), ...(owned ?? [])]);
          // Nothing more on top of an option that only cost: what was put in is gone, and that is said in red.
          return tags.length === 0 && preview.outcomes[k].cash === 0 && onlyCosts(option.effects) ? [{ tone: 'bad' as const, text: t('lostStake') }] : tags;
        };
        return (
        <span key={k} className={`flex items-start gap-2 ${dim}`}>
          <span className="pixel w-12 shrink-0 text-right text-[13px] text-gold-500">{t('chance', { pct: chancePct(preview.outcomes[k].weight, total) })}</span>
          {/* An outcome that changes nothing more leaves the option as it says: that is how it goes, not nothing at all. */}
          <Tags cash={preview.outcomes[k].cash} tags={outcomeTags(outcome.effects)} empty={t('asPlanned')} />
        </span>
        );
      })}
    </>
  );
}

/** One option of a card, to be chosen. */
function Option({ def, index, number, preview, onPick, disabled, tabIndex }: { def: CardDef; index: number; number: number; preview: OptionPreview; onPick(): void; disabled: boolean; tabIndex: number }) {
  const world = useGame((s) => s.view?.timeline[s.view.round]);
  const partnered = useGame((s) => s.view?.player.life.partner ?? false);
  // The option tapped is shown taken at once, pressed and lit, and the others step back, while the answer is on its way.
  const picked = useGame((s) => s.picked);
  const view = useGame((s) => s.view);
  const t = useT('cards');
  const words = useWords();
  const [seeing, setSeeing] = useState(false);
  if (!world || !view) return null;
  const look = picked === null ? '' : picked === index ? 'translate-y-[2px] outline outline-2 outline-gold-500' : 'opacity-50';
  // An option that takes the player into another career can show that career whole before it is chosen.
  const job = def.options[index]?.effects?.job;
  const career = job?.career;
  const option = (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled || !preview.available}
      tabIndex={tabIndex}
      data-card-option={index}
      aria-pressed={picked === index ? true : undefined}
      className={`frame-raised relative flex min-h-11 w-full flex-col gap-1.5 bg-night-700 px-3 py-2 text-left transition-[transform,opacity] enabled:active:translate-y-[2px] ${look}`}
    >
      <Offer def={def} index={index} preview={preview} world={world} shortcut={preview.available ? number : undefined} partnered={partnered} />
    </button>
  );
  if (!career) return option;
  return (
    <div className="flex flex-col items-stretch gap-1">
      {option}
      <button type="button" aria-haspopup="dialog" onClick={() => setSeeing(true)} className="self-end px-1 text-[12px] text-sky-300 underline underline-offset-2">
        {t('seeCareer', { career: words.text.careers[career].name })}
      </button>
      {seeing ? <CareerPreview careerId={career} startLevel={job?.level ?? 0} shown={view} onClose={() => setSeeing(false)} /> : null}
    </div>
  );
}

/** How long the result of a card is on screen before what it paid flies to the cash: once its panel has risen. */
const COINS_AFTER_MS = 450;

/** The card on screen. A card with two options can be swiped; every card can be answered with a tap. */
export function CardStage() {
  const t = useT('cards');
  const { content, text } = useWords();
  const { reducedMotion } = useSettings();
  const view = useGame((s) => s.view);
  const busy = useGame((s) => s.busy);
  const pick = useGame((s) => s.pick);
  const x = useMotionValue(0);
  const tilt = useTransform(x, [-160, 160], [-6, 6]);
  const choices = useRef<HTMLDivElement>(null);
  const { keyboard } = useKeyboard();

  // The card to answer is the next one of the hand, judged as the player stands after the ones before it.
  const waiting = view !== null && view.phase === 'cards';
  const cardId = waiting ? view.hand[view.answered] : undefined;
  const def = content.cards.find((card) => card.id === cardId);
  const previews = useMemo(() => (view && def && waiting ? previewCard(content, view, def.id) : []), [content, view, def, waiting]);
  // A choice the player cannot take is not shown at all: the digits count what is shown.
  const shown = previews.flatMap((preview, index) => (preview.available ? [index] : []));
  const enabled = shown.filter((index) => previews[index].available);
  const focus = (index: number) => {
    const option = choices.current?.querySelector<HTMLElement>(`[data-card-option="${index}"]`);
    option?.focus();
    option?.scrollIntoView?.({ block: 'nearest' });
  };
  const choose = (index: number) => choices.current?.querySelector<HTMLButtonElement>(`[data-card-option="${index}"]`)?.click();
  useKeyboardScope(
    (event) => {
      if (!waiting || busy || enabled.length === 0 || event.altKey || event.ctrlKey || event.metaKey) return false;
      // A held digit must not go on to answer the next card too.
      if (event.repeat && /^[1-4]$/.test(event.key)) return true;
      if (/^[1-4]$/.test(event.key)) {
        const index = shown[Number(event.key) - 1];
        if (index === undefined || !enabled.includes(index)) return false;
        choose(index);
        return true;
      }
      const direction = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      if (!direction && event.key !== 'Home' && event.key !== 'End') return false;
      const active = document.activeElement instanceof HTMLElement ? Number(document.activeElement.dataset.cardOption) : Number.NaN;
      const at = enabled.includes(active) ? enabled.indexOf(active) : 0;
      const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1)! : enabled[(at + direction + enabled.length) % enabled.length];
      focus(next);
      return true;
    },
    { active: waiting, priority: 20 },
  );
  useEffect(() => {
    if (!keyboard || !def || enabled.length === 0) return;
    const frame = requestAnimationFrame(() => focus(enabled[0]));
    return () => cancelAnimationFrame(frame);
    // The card id deliberately resets focus; availability belongs to that card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def?.id, keyboard]);
  if (!view || !def) return null;

  const written = text.cards[def.id];
  const rarity = cardRarity(def);
  // Two choices on screen can be swiped, left for the first and right for the second.
  const swipeable = shown.length === 2 && !reducedMotion && !busy;

  return (
    <div className="flex flex-col gap-3 px-3">
      <p className="pixel text-center text-[13px] text-ink-300">
        {t('progress', { n: view.answered + 1, total: view.hand.length })} · {def.category === 'world' ? t('world') : text.categories[def.category]}
      </p>

      <motion.article
        key={def.id}
        drag={swipeable ? 'x' : false}
        dragSnapToOrigin
        dragElastic={0.6}
        style={{ x, rotate: tilt, width: 'calc(288px * var(--art) + 4px)' }}
        onDragEnd={(_, info) => {
          if (info.offset.x > SWIPE) void pick(shown[1]);
          else if (info.offset.x < -SWIPE) void pick(shown[0]);
        }}
        className={`frame relative mx-auto touch-pan-y bg-cream text-ink-900 ${rarity ? 'frame-gold' : 'frame-cream'} ${rarity === 'legendary' ? 'animate-legend' : 'animate-rise'}`}
      >
        <div className="relative overflow-hidden border-2 border-cream leading-[0]">
          <Sprite id={cardArt[def.id] ?? ''} scale="art" fallback={{ w: 288, h: 120 }} />
          {/* A rare card catches the light now and then; a legendary one shimmers all over. */}
          {rarity === 'legendary' ? (
            <span
              aria-hidden
              data-motion-only
              className="pointer-events-none absolute inset-0 animate-holo opacity-40 mix-blend-overlay"
              style={{ backgroundImage: 'linear-gradient(110deg, #d1495b, #f2c14e, #7fd1b9, #9ad1d4, #3b6ea5, #d1495b)', backgroundSize: '200% 100%' }}
            />
          ) : null}
          {rarity ? <span aria-hidden data-motion-only className="pointer-events-none absolute inset-y-0 left-0 w-1/5 animate-glint bg-white/40" /> : null}
        </div>
        {rarity === 'legendary' ? <Sparks colours={['bg-gold-500', 'bg-teal-300', 'bg-cream', 'bg-wine-300']} count={16} reach={150} size={4} delayMs={450} /> : null}
        <div className="px-3 pb-3 pt-2">
          <h2 className="pixel text-[19px]">{written.title}</h2>
          <p className="mt-1 text-[14px] leading-snug text-ink-700">{written.body}</p>
        </div>
      </motion.article>

      <div ref={choices} role="group" aria-label={t('choices', { title: written.title })} className="flex flex-col gap-2.5">
        {shown.map((i, at) => (
          <Option key={`${def.id}-${i}`} def={def} index={i} number={at + 1} preview={previews[i]} onPick={() => void pick(i)} disabled={busy} tabIndex={i === enabled[0] ? 0 : -1} />
        ))}
      </div>
      {swipeable ? (
        // A swipe cannot be taken back, so each side says what it picks. The buttons above say the same to a screen reader.
        <div aria-hidden className="flex items-start justify-between gap-3 text-[12px] text-ink-300">
          <span className="min-w-0 flex-1 truncate text-left">← {written.options[shown[0]].label}</span>
          <span className="min-w-0 flex-1 truncate text-right">{written.options[shown[1]].label} →</span>
        </div>
      ) : null}
      {swipeable ? <p className="text-center text-[12px] text-ink-300">{t('swipe')}</p> : null}
    </div>
  );
}

/**
 * What the card just answered did: its picture again, the choice made and what followed from it,
 * what the dice said when there were dice, and everything it changed. Nothing is worked out
 * here: the figures are the engine's.
 */
export function Outcome() {
  const view = useGame((s) => s.view);
  const t = useT('cards');
  const effects = useT('effects');
  const words = useWords();
  const { content, text, fmt } = words;
  const events = useGame((s) => s.cardEvents);
  const offered = useGame((s) => s.offered);
  const pending = useGame((s) => s.pending);
  const picked = useGame((s) => s.picked);
  const area = useRef<HTMLDivElement>(null);
  if (pending && offered && picked !== null) return <Pending cardId={offered.cardId} option={picked} />;
  const cards = events.filter((e): e is Extract<GameEvent, { kind: 'card' }> => e.kind === 'card');
  const money = events.filter((e): e is Extract<GameEvent, { kind: 'ledger' }> => e.kind === 'ledger');

  const paid = cards.some((event) => event.cash > 0);
  return (
    <div ref={area} className="relative flex flex-col gap-3 px-3">
      {paid ? <FlyingCoins area={area} startMs={COINS_AFTER_MS} target="[data-hud-cash] > *" /> : null}
      <h2 className="pixel text-center text-[20px] text-gold-500">{t('results')}</h2>
      <Celebrations />
      {cards.map((event) => {
        const def = content.cards.find((card) => card.id === event.cardId);
        const written = text.cards[event.cardId];
        const option = written.options[event.option];
        const chosen = def?.options[event.option];
        const rolled = event.outcome === null ? undefined : chosen?.outcomes?.[event.outcome];
        // The card as it stood when it was answered. Without it, as after a reload, the result is told without the odds.
        const was = offered && offered.cardId === event.cardId ? offered : null;
        const world = was?.world;
        const odds = was?.options[event.option]?.outcomes ?? [];
        let total = 0;
        for (const outcome of odds) total += outcome.weight;
        const partnered = offered?.cardId === event.cardId ? offered.partnered : (view?.player.life.partner ?? false);
        const tags = world ? [...effectTags(words, effects, world, chosen?.effects, partnered), ...effectTags(words, effects, world, rolled?.effects, partnered, chosen?.effects?.recurring ?? [])] : [];
        // What the player's cover paid, when it paid: the reason to have it.
        const covered = was?.options[event.option]?.covered ?? 0;

        return (
          <div key={event.cardId} className="flex flex-col gap-3">
            {/* As wide as its picture, like the card it was. */}
            <article className="frame frame-cream mx-auto max-w-full animate-rise bg-cream text-ink-900" style={{ width: 'calc(288px * var(--art) + 4px)' }}>
              <div className="border-2 border-cream leading-[0]">
                <Sprite id={cardArt[event.cardId] ?? ''} scale="art" fallback={{ w: 288, h: 120 }} />
              </div>
              <div className="px-3 pb-3 pt-2">
                <h3 className="pixel text-[19px]">{written.title}</h3>
                <p className="pixel mt-0.5 text-[13px] uppercase tracking-wider text-ink-500">{t('chose', { label: option.label })}</p>
                {/* What followed: the line of the outcome the dice gave, or the line of the choice itself. */}
                <p className="mt-2 text-[15px] leading-snug">{event.outcome !== null ? option.outcomes[event.outcome] : option.after}</p>
                {covered > 0 ? <p className="pixel mt-2 text-[14px] text-teal-800">{t('saved', { amount: words.fmt.money(covered) })}</p> : null}
                {event.outcome !== null && total > 0 ? (
                  <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-700">
                    <span className="pixel bg-ink-900 px-1.5 py-0.5 text-[13px] text-gold-500">{t('chance', { pct: chancePct(odds[event.outcome]?.weight ?? 0, total) })}</span>
                    {t('rolled')}
                  </p>
                ) : null}
              </div>
            </article>

            <Panel title={t('changes')} label={t('changes')} className="animate-rise">
              {/* Money a card paid flies to the cash in the HUD. */}
              <span data-coin-from={event.cash > 0 ? '' : undefined} className="inline-block">
                <Tags cash={event.cash} tags={tags} empty={t('nothing')} />
              </span>
            </Panel>

          </div>
        );
      })}
      {money.length > 0 ? (
        <Panel>
          {money.map((event, i) => (
            <div key={i} className="flex justify-between gap-3 py-0.5 text-[14px]">
              <span>{text.ledger[event.line]}</span>
              <span className="pixel">{fmt.signed(event.amount)}</span>
            </div>
          ))}
        </Panel>
      ) : null}
    </div>
  );
}

/**
 * A card answered whose result a server has still to give: the card, the choice made, and what
 * followed when nothing was left to chance. When there were dice, they are still rolling.
 */
function Pending({ cardId, option }: { cardId: string; option: number }) {
  const t = useT('cards');
  const { content, text } = useWords();
  const written = text.cards[cardId];
  const chosen = content.cards.find((card) => card.id === cardId)?.options[option];
  const dice = (chosen?.outcomes?.length ?? 0) > 0;
  return (
    <div className="flex flex-col gap-3 px-3" aria-busy>
      <h2 className="pixel text-center text-[20px] text-gold-500">{t('results')}</h2>
      <article className="frame frame-cream mx-auto max-w-full bg-cream text-ink-900" style={{ width: 'calc(288px * var(--art) + 4px)' }}>
        <div className="border-2 border-cream leading-[0]">
          <Sprite id={cardArt[cardId] ?? ''} scale="art" fallback={{ w: 288, h: 120 }} />
        </div>
        <div className="px-3 pb-3 pt-2">
          <h3 className="pixel text-[19px]">{written.title}</h3>
          <p className="pixel mt-0.5 text-[13px] uppercase tracking-wider text-ink-500">{t('chose', { label: written.options[option].label })}</p>
          {dice ? (
            <p className="mt-2 flex items-center gap-2 text-[15px] leading-snug" role="status">
              <span aria-hidden data-motion-only className="inline-block size-3 animate-spin bg-ink-900" />
              {t('rolling')}
            </p>
          ) : (
            <p className="mt-2 text-[15px] leading-snug">{written.options[option].after}</p>
          )}
        </div>
      </article>
    </div>
  );
}
