import { Fill, Path } from '@shopify/react-native-skia';
import { FRAME_STATUS, frameArt, portraitArt, ratArt } from '@ratrace/content';
import { characterName } from '@ratrace/core/game/characters';
import { ageAt, cityLight, escapeAge, portraitAge } from '@ratrace/core/game/present';
import { ratOutfit } from '@ratrace/core/game/quips';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { cashflow, cashflowLines, escapeMultiplier, escapeProgress, netWorth, scoreBreakdown, statusBreakdown, taxAnnual } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { Canvas } from '../../ui/Canvas';
import { usePop } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { webBaseline } from '../../ui/fonts';
import { Bar, KeyFigure, Raised, reach, Row, Stat, StatRow, Tag, usePress, Well } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { Glint } from '../../ui/Shine';
import { Sparks } from '../../ui/Sparks';
import { Sprite } from '../../ui/Sprite';
import { useScrolledPastLead } from '../../ui/Sticky';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, TOUCH, type ColorToken } from '../../ui/theme';
import { useGame, useSettings, useT, useWords } from '../context';
import { CityBanner } from './CityBanner';
import { Explain } from './Explain';
import { useCoinTarget } from './FlyingCoins';
import { JailSheet } from './Jail';
import { Loop } from './Loop';
import { Headlines } from './News';
import { SettingsSheet } from './Settings';

/**
 * The game as it stands for the screens: in the finance phase, the player as they will be once the
 * orders in the basket have run, so every figure on screen already counts them.
 */
export function useShown(): GameView {
  const view = useGame((s) => s.view);
  const preview = useGame((s) => s.preview);
  if (!view) throw new Error('no game on screen');
  // The same object for as long as the two it is made of are: what is worked out from it is not worked out again for nothing.
  return useMemo(() => (preview ? { ...view, player: preview.player } : view), [view, preview]);
}

/** What stands behind the portrait, by the frame it has earned: nothing at first, then a colour, then stage lights, then a burst of gold. */
const BACKDROP = [null, 'colour', 'lights', 'rays'] as const;
const tierOf = (status: number): number => FRAME_STATUS.reduce((best, from, i) => (status >= from ? i : best), 0);

/** The frame the status has reached, and a moment of celebration each time it reaches a better one. */
function useTierUp(status: number): { tier: number; rose: number } {
  const tier = tierOf(status);
  const last = useRef(tier);
  const [rose, setRose] = useState(0);
  useEffect(() => {
    if (tier > last.current) setRose((n) => n + 1);
    last.current = tier;
  }, [tier]);
  return { tier, rose };
}

/**
 * The web's `repeating-conic-gradient(from 0deg at 50% 100%, gold-700 0 10deg, gold-900 10deg 20deg)` in a box `w` by `h`: rays of
 * gold from the middle of its foot, every other ten degrees, the first one from straight up turning clockwise. The gold-700 rays, as one path.
 */
export function raysOf(w: number, h: number): string {
  const reach = 2 * Math.max(w, h);
  const at = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(w / 2 + reach * Math.sin(rad)).toFixed(2)} ${(h - reach * Math.cos(rad)).toFixed(2)}`;
  };
  return Array.from({ length: 18 }, (_, i) => `M${w / 2} ${h} L${at(i * 20)} L${at(i * 20 + 10)} Z`).join(' ');
}

const FILL: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

/** What stands behind a portrait of `size` points, by the tier of its frame. */
function Backdrop({ tier, size }: { tier: number; size: number }) {
  const kind = BACKDROP[tier];
  if (kind === null) return null;
  const marked = { dataSet: { backdrop: kind } };
  if (kind === 'colour') return <View {...marked} style={[FILL, { backgroundColor: COLORS['teal-800'] }]} />;
  if (kind === 'lights') {
    // Stripes of 4 across, night-500 first (the web's `repeating-linear-gradient(90deg, night-500 0 4px, sky-500 4px 8px)`).
    return (
      <View {...marked} style={[FILL, { flexDirection: 'row' }]}>
        {Array.from({ length: Math.ceil(size / 4) }, (_, i) => (
          <View key={i} style={{ width: 4, backgroundColor: COLORS[i % 2 === 0 ? 'night-500' : 'sky-500'] }} />
        ))}
      </View>
    );
  }
  return (
    <View {...marked} style={FILL}>
      <Canvas style={{ width: size, height: size }}>
        <Fill color={COLORS['gold-900']} />
        <Path path={raysOf(size, size)} color={COLORS['gold-700']} />
      </Canvas>
    </View>
  );
}

type Figure = 'cash' | 'flow' | 'status' | 'ratRace';
const FIGURES: readonly Figure[] = ['cash', 'flow', 'status', 'ratRace'];

/**
 * What a scene shows open over the Hud at the start (a client draws a scene by a screen's own initial state, never by a tap): the
 * sheet of a figure, the prison's (from the tag of someone inside), the settings, or the paper.
 */
export type HudOpen = Figure | 'jail' | 'settings' | 'news';

/** The web's `mt-1 border-t-2 border-night-900 pt-2` on a line that sums up the lines above it. */
const TOTAL: ViewStyle = { marginTop: 4, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 8 };

/** A figure of a sheet in a colour (the web's `<span className="text-teal-300">` inside a Row's pixel cell). */
const Coloured = ({ tone, children }: { tone: ColorToken; children: string }) => (
  <PixelText size={14} tone={tone} style={{ textAlign: 'right' }}>
    {children}
  </PixelText>
);

/**
 * What one figure of the HUD means, and what it is made of. Lines that are zero and say nothing
 * by being so are left out.
 */
function Details({ figure, shown }: { figure: Figure; shown: GameView }) {
  const t = useT('hud');
  const { content, fmt } = useWords();
  const p = shown.player;
  const good = (cents: number) => <Coloured tone="teal-300">{fmt.signed(cents)}</Coloured>;
  const bad = (cents: number) => <Coloured tone="wine-300">{fmt.signed(-cents)}</Coloured>;
  const points = (value: number) => (value > 0 ? `+${fmt.number(value)}` : fmt.number(value));

  let rows: ReactNode;
  if (figure === 'cash') {
    rows = (
      <>
        <Row size={14} left={t('cash')} right={fmt.money(p.cash)} />
        <Row size={14} left={t('savings')} right={fmt.money(p.deposit)} />
        <Row size={14} style={TOTAL} left={t('netWorth')} sub={t('netWorthHint')} right={<Coloured tone="gold-500">{fmt.money(netWorth(p))}</Coloured>} />
      </>
    );
  } else if (figure === 'flow') {
    const lines = cashflowLines(content, shown);
    const whole = cashflow(content, shown);
    const tax = taxAnnual(content, shown);
    rows = (
      <>
        <Row size={14} left={t('salary')} right={good(lines.salary)} />
        {lines.dividends > 0 ? <Row size={14} left={t('dividends')} right={good(lines.dividends)} /> : null}
        {lines.interest > 0 ? <Row size={14} left={t('interest')} right={good(lines.interest)} /> : null}
        {lines.rent > 0 ? <Row size={14} left={t('rent')} right={good(lines.rent)} /> : null}
        {lines.otherPassive > 0 ? <Row size={14} left={t('otherPassive')} right={good(lines.otherPassive)} /> : null}
        <Row size={14} left={t('living')} right={bad(lines.living)} />
        {lines.other > 0 ? <Row size={14} left={t('otherExpenses')} right={bad(lines.other)} /> : null}
        {lines.debt > 0 ? <Row size={14} left={t('debt')} right={bad(lines.debt)} /> : null}
        {tax > 0 ? <Row size={14} left={t('wayOut.tax')} right={bad(tax)} /> : null}
        <Row size={14} style={TOTAL} left={t('perYear')} right={fmt.signed(whole.salaryAnnual + whole.passiveAnnual - whole.expensesAnnual - tax)} />
      </>
    );
  } else if (figure === 'ratRace') {
    rows = <RatRace shown={shown} />;
  } else {
    const status = statusBreakdown(content, shown);
    rows = (
      <>
        <Row size={14} left={t('statusJob')} right={points(status.job)} />
        <Row size={14} left={t('statusHome')} right={points(status.home)} />
        {status.estates !== 0 ? <Row size={14} left={t('statusEstates')} sub={t('statusEstatesHint')} right={points(status.estates)} /> : null}
        <Row size={14} left={t('statusCity')} right={points(status.city)} />
        <Row size={14} left={t('statusLifestyle')} right={points(status.lifestyle)} />
        <Row size={14} left={t('statusItems')} right={points(status.items)} />
        {status.network !== 0 ? <Row size={14} left={t('statusNetwork')} right={points(status.network)} /> : null}
        {status.bonus !== 0 ? <Row size={14} left={t('statusBonus')} right={points(status.bonus)} /> : null}
        <Row size={14} style={TOTAL} left={t('statusNow')} right={fmt.number(status.total)} />
        <Row size={14} left={t('statusLived')} sub={t('statusLivedHint')} right={fmt.number(status.lived)} />
        <ScoreNow shown={shown} />
      </>
    );
  }

  return (
    <>
      <Explain style={{ marginBottom: 4 }}>{t(`about.${figure}`)}</Explain>
      <View>{rows}</View>
    </>
  );
}

/**
 * Two texts side by side that share a baseline (the web's `items-baseline`): the room above each, so that, laid from the top, their
 * baselines meet. A native row reads the baseline of a box and the kit moves glyphs inside theirs, so the browser's own baselines are used.
 */
function sharedBaseline(...lines: Array<[role: 'pixel' | 'read', size: number, line: number]>): (language: string) => number[] {
  return (language) => {
    const baselines = lines.map(([role, size, line]) => webBaseline(role, 400, size, line, language));
    const top = Math.max(...baselines);
    return baselines.map((baseline) => top - baseline);
  };
}

/** The label of a figure in a sheet (13, upper case, wide) beside the figure itself (28): the web's `flex items-baseline justify-between`. */
const LABEL_AND_FIGURE = sharedBaseline(['pixel', 13, 13 * 1.1], ['pixel', 28, 28]);

/** A sheet's label in its own small capitals (the web's `pixel text-[13px] uppercase tracking-wider text-gold-200`). */
const Label = ({ children, style }: { children: string; style?: ViewStyle }) => (
  <PixelText size={13} tone="gold-200" style={{ letterSpacing: 13 * 0.05, ...style }}>
    {children.toUpperCase()}
  </PixelText>
);

/**
 * The way out, laid bare: how much of the year's outgoings what comes in without working already
 * pays, where that comes from, what is left to cover, and what getting out is worth.
 */
function RatRace({ shown }: { shown: GameView }) {
  const t = useT('hud');
  const { content, fmt } = useWords();
  const { locale } = useSettings();
  const preview = useGame((s) => s.preview);
  const p = shown.player;
  const years = content.yearsPerRound;
  const escape = preview ? preview.escape : escapeProgress(content, shown);
  const lines = cashflowLines(content, shown);
  const passive = Math.floor(escape.passiveAfterTax / years);
  const outgoings = Math.floor(escape.outgoings / years);
  const before = lines.dividends + lines.interest + lines.rent + lines.otherPassive;
  const tax = Math.max(0, before - passive);
  const gap = outgoings - passive;
  const pct = outgoings > 0 ? Math.min(100, Math.floor((passive * 100) / outgoings)) : 100;
  const escaped = p.escapedAtRound !== null;
  const good = (cents: number) => <Coloured tone="teal-300">{fmt.signed(cents)}</Coloured>;
  const bad = (cents: number) => <Coloured tone="wine-300">{fmt.signed(-cents)}</Coloured>;
  const state = escaped
    ? t('wayOut.escaped', { age: escapeAge(content, p.escapedAtRound ?? 0), multiplier: fmt.factor(escapeMultiplier(p.escapedAtRound, content.rounds, content.scoring)) })
    : gap <= 0 && p.passiveStreak >= 1
      ? t('wayOut.oneMore')
      : t('wayOut.worth', { multiplier: fmt.factor(escapeMultiplier(shown.round, content.rounds, content.scoring)) });
  const [labelTop, figureTop] = LABEL_AND_FIGURE(locale);
  // The web's first line of the list collapses its `mt-1` into the list's `mt-3`: where the passive income is that first line, it has no room of its own on top.
  const passiveFirst = !(lines.dividends > 0 || lines.interest > 0 || lines.rent > 0 || lines.otherPassive > 0 || tax > 0);

  return (
    <>
      {/* Still in the race, the rat runs in its wheel, the harder the less it covers; out of it, it walks out of the door. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ marginTop: 4, alignItems: 'center' }}>
        {escaped ? <Sprite id={ratArt('exit')} fallback={{ w: 128, h: 128 }} /> : <Loop name="wheel" outfit={ratOutfit(shown)} scale={2} ms={Math.round(90 + pct * 1.4)} />}
      </View>
      <View style={{ marginVertical: 8, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <Label style={{ marginTop: labelTop }}>{t('wayOut.covered')}</Label>
        <View style={{ marginTop: figureTop }}>
          <KeyFigure tone={escaped ? 'teal' : 'gold'}>{`${pct}%`}</KeyFigure>
        </View>
      </View>
      <Bar value={passive} max={outgoings} label={t('ratRace')} tone={escaped ? 'teal' : 'gold'} door />
      <View style={{ marginTop: 12 }}>
        {lines.dividends > 0 ? <Row size={14} left={t('dividends')} right={good(lines.dividends)} /> : null}
        {lines.interest > 0 ? <Row size={14} left={t('interest')} right={good(lines.interest)} /> : null}
        {lines.rent > 0 ? <Row size={14} left={t('rent')} right={good(lines.rent)} /> : null}
        {lines.otherPassive > 0 ? <Row size={14} left={t('otherPassive')} right={good(lines.otherPassive)} /> : null}
        {tax > 0 ? <Row size={14} left={t('wayOut.tax')} right={bad(tax)} /> : null}
        <Row size={14} style={passiveFirst ? { ...TOTAL, marginTop: 0 } : TOTAL} left={t('wayOut.passive')} sub={t('perYearShort')} right={<Coloured tone="teal-300">{fmt.money(passive)}</Coloured>} />
        <Row size={14} left={t('wayOut.outgoings')} sub={t('perYearShort')} right={<Coloured tone="wine-300">{fmt.money(outgoings)}</Coloured>} />
        <Row size={14} style={TOTAL} left={gap > 0 ? t('wayOut.missing') : t('wayOut.spare')} right={<Coloured tone={gap > 0 ? 'gold-500' : 'teal-300'}>{fmt.money(Math.abs(gap))}</Coloured>} />
      </View>
      <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200" style={{ marginTop: 8 }}>
        {state}
      </ReadText>
    </>
  );
}

/**
 * What status is for: the score as it would stand today, and how much of it is money and how much
 * is status. The figures are the engine's own, the same the last screen of a life will show.
 */
function ScoreNow({ shown }: { shown: GameView }) {
  const t = useT('hud');
  const { content, fmt } = useWords();
  const { locale } = useSettings();
  const score = scoreBreakdown(content, shown);
  const sum = Math.max(1, score.wealth + score.status);
  const share = Math.round((score.status * 100) / sum);
  const [labelTop, figureTop] = LABEL_AND_FIGURE(locale);
  return (
    <View role="region" aria-label={t('scoreNow')} style={{ marginTop: 12 }}>
      <Framed kind="frame" style={{ backgroundColor: COLORS['night-800'], paddingHorizontal: 12, paddingVertical: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <Label style={{ marginTop: labelTop }}>{t('scoreNow')}</Label>
          <View style={{ marginTop: figureTop }}>
            <KeyFigure>{fmt.number(score.total)}</KeyFigure>
          </View>
        </View>
        {/* The split, gold for the money and teal for status: the two sides fill the sunk track, edge to edge. */}
        <Framed kind="sunk" style={{ marginTop: 8, flexDirection: 'row', height: 12, backgroundColor: COLORS['ink-900'] }}>
          <View {...{ dataSet: { split: 'wealth' } }} accessibilityElementsHidden style={{ width: `${100 - share}%`, backgroundColor: COLORS['gold-500'] }} />
          <View {...{ dataSet: { split: 'status' } }} accessibilityElementsHidden style={{ width: `${share}%`, backgroundColor: COLORS['teal-300'] }} />
        </Framed>
        <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12 }}>
          <ReadText size={13} tone="gold-500">{t('scoreWealth', { n: fmt.number(score.wealth) })}</ReadText>
          <ReadText size={13} tone="teal-300">{t('scoreStatus', { n: fmt.number(score.status) })}</ReadText>
        </View>
        <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300" style={{ marginTop: 6 }}>
          {score.multiplierPct > 100 ? t('scoreEscaped', { multiplier: fmt.factor(score.multiplierPct) }) : t('scoreHint')}
        </ReadText>
      </Framed>
    </View>
  );
}

/**
 * The room round the tag of someone in prison. On the web it is a button in a line of the column's own text (15 × 1.45, Chakra Petch), so the
 * line is as tall as the tag with its `mt-1`, and the room the reading line's strut leaves under its baseline where that is more than the tag
 * leaves: both are worked out from the browser's baselines (the tag's 12-point pixel line of 1.25 in its 2 of padding).
 */
function tagRoom(language: string): { top: number; bottom: number } {
  const strut = 15 * 1.45;
  const above = webBaseline('read', 400, 15, strut, language);
  const tag = 2 + webBaseline('pixel', 400, 12, 12 * 1.25, language);
  return { top: 4 + Math.max(0, above - (4 + tag)), bottom: Math.max(0, strut - above - (JAIL_TAG.height - tag)) };
}

/** The tag of someone in prison as the kit draws it (`Tag`: a 12-point line of 1.25 in 2 of padding above and below), in points. */
export const JAIL_TAG = { height: 2 + 12 * 1.25 + 2 };

/** The lines always above the tag in its column, which are not pressed: the age (26 high) and, 4 under it, the round's line (13 × 1.45). */
const ABOVE_TAG = 26 + 4 + 13 * 1.45;

/**
 * The box of the tag, made the 44 points a thumb needs (the kit's `reach`): the tag is 19 high, at the foot of its column, so its box reaches down
 * only through the line's own room under it (not past the column) and up the rest of the way, over the lines above it, which are not pressed. Its
 * place is the tag's own (`room`): the padding is given back by its margins.
 */
function tagBox(room: { top: number; bottom: number }) {
  const { top, bottom } = reach(JAIL_TAG.height, { above: ABOVE_TAG, below: room.bottom });
  return { paddingTop: top, paddingBottom: bottom, marginTop: room.top - top, marginBottom: room.bottom - bottom, alignSelf: 'flex-start' as const };
}

/** What the lead of the Hud draws of the life: little of it, so that the portrait's row is not drawn again for every coin. */
interface Lead {
  round: number;
  cityId: string;
  career: string | null;
  level: number;
  jailRounds: number;
  status: number;
  light: ReturnType<typeof cityLight>;
  news: boolean;
}

function leadOf(s: RoundState & RoundActions): Lead | null {
  if (!s.view) return null;
  const player = s.preview ? s.preview.player : s.view.player;
  const career = player.life.career;
  return {
    round: s.view.round,
    cityId: player.cityId,
    career: career ? career.id : null,
    level: career ? career.level : 0,
    jailRounds: player.life.jailRounds,
    status: player.statusPoints,
    // A round opens in the first light and closes at night; a boom and a crisis each have a sky of their own.
    light: cityLight(s.view.timeline[s.view.round], s.stage === 'news'),
    news: s.stage === 'news',
  };
}

/** What the settings read of the game while they are shut: nothing. */
const SHUT = { view: null, preview: null } as const;

/**
 * The settings of the life, over the Hud: they need the whole of the game, which the portrait's row does not draw, so they read it only while
 * they are open (shut, the game moving on draws nothing here). The game as it was last read is kept for the sheet while it leaves.
 */
function HudSettings({ open, onClose }: { open: boolean; onClose(): void }) {
  const now = useGame(useShallow((s) => (open ? { view: s.view, preview: s.preview } : SHUT)));
  const read = useMemo(() => (now.view ? (now.preview ? { ...now.view, player: now.preview.player } : now.view) : null), [now.view, now.preview]);
  const [kept, keep] = useState<GameView | null>(read);
  if (read !== null && read !== kept) keep(read);
  const shown = read ?? kept;
  return shown ? <SettingsSheet open={open} onClose={onClose} shown={shown} /> : null;
}

/** The portrait, hung: a moment of celebration (it jumps and lands, sparks fly, a band of light crosses it) each time its frame gets better. */
function Hung({ rose, compact, frame, children }: { rose: number; compact: boolean; frame: string; children: ReactNode }) {
  const pop = usePop({ play: rose > 0 });
  if (compact) {
    // The small one keeps its gold line: a double frame round the well.
    return (
      <Animated.View style={[{ marginVertical: 6, marginLeft: 6, flexShrink: 0 }, pop]}>
        <Framed kind="double" tone={{ ring: 'gold-500' }}>
          {children}
          {rose > 0 ? <Sparks colours={['gold-500', 'gold-200', 'cream']} count={10} reach={34} /> : null}
        </Framed>
      </Animated.View>
    );
  }
  return (
    <Animated.View {...{ dataSet: { frame } }} style={[{ width: 80, height: 80, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, pop]}>
      {children}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }}>
        <Sprite id={frame} fallback={{ w: 80, h: 80 }} />
      </View>
      {rose > 0 ? <Sparks colours={['gold-500', 'gold-200', 'cream']} count={14} reach={52} size={4} /> : null}
      {rose > 0 ? (
        <View pointerEvents="none" style={[FILL, { overflow: 'hidden' }]}>
          <Glint share={0.25} once rest={{ opacity: 0 }} />
        </View>
      ) : null}
    </Animated.View>
  );
}

/** A square button of the Hud's row, with its icon: the paper, the settings. */
function Square({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Raised label={label} bg="night-700" place={{ flexShrink: 0 }} style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }} onPress={onPress}>
      <Sprite id={icon} fallback={{ w: 32, h: 32 }} />
    </Raised>
  );
}

/**
 * The part of the Hud that scrolls away: the city, the portrait, who and where, and the paper and settings buttons. Its sheets (the
 * prison, the settings, the paper) are its own.
 */
function HudLead({ compact, skyline, onProfile, open }: { compact: boolean; skyline: boolean; onProfile?: () => void; open?: HudOpen }) {
  const t = useT('hud');
  const common = useT('common');
  const { content, text, names } = useWords();
  const lifeId = useGame((s) => s.lifeId) ?? '';
  const { locale } = useSettings();
  const life = useGame(useShallow(leadOf));
  const [settings, setSettings] = useState(open === 'settings');
  const [paper, setPaper] = useState(open === 'news');
  const [jail, setJail] = useState(open === 'jail');
  const { tier, rose } = useTierUp(life?.status ?? 0);
  const profile = usePress({ onPress: () => onProfile?.() });
  const prison = usePress({ onPress: () => setJail(true) });
  if (!life) throw new Error('no game on screen');
  const character = characterName(lifeId, locale);
  const age = ageAt(content, life.round);
  const well = compact ? 44 : 64;
  const room = tagRoom(locale);
  // A sprite is never drawn at a fraction of its size: the small portrait is the face, cut out of the whole.
  const portrait = (
    <Well style={{ width: well, height: well, overflow: 'hidden', alignSelf: 'center', ...(compact ? { justifyContent: 'flex-start' } : null) }}>
      <Backdrop tier={tier} size={well} />
      <Sprite id={portraitArt(lifeId, portraitAge(age))} fallback={{ w: 64, h: 64 }} style={compact ? { marginTop: -4 } : undefined} />
    </Well>
  );
  const framed = (
    <Hung key={rose} rose={rose} compact={compact} frame={frameArt(life.status)}>
      {portrait}
    </Hung>
  );

  return (
    <View>
      {skyline ? (
        <View style={{ marginTop: 12 }}>
          <CityBanner cityId={life.cityId} light={life.light} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: skyline ? 8 : 12 }}>
        {onProfile ? (
          // The web's portrait button does not sink when pressed (no `active:translate-y`): it opens the profile, it is not a raised button.
          <Pressable accessibilityRole="button" accessibilityLabel={t('openProfile')} onPress={profile} style={{ flexShrink: 0 }}>
            {framed}
          </Pressable>
        ) : (
          framed
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Who lives this life, by name, above how old they are. */}
          {character ? (
            <PixelText size={15} lineHeight={15} tone="gold-500" numberOfLines={1} style={{ marginBottom: 4 }}>
              {character}
            </PixelText>
          ) : null}
          <PixelText size={26} lineHeight={26}>{common('age', { age })}</PixelText>
          <ReadText size={13} tone="ink-200" numberOfLines={1} style={{ marginTop: 4 }}>
            {`${t('roundShort', { n: Math.min(life.round + 1, content.rounds), total: content.rounds })} · ${names.cities[life.cityId]}`}
          </ReadText>
          {/* The job on a line of its own: a long title is not cut short by the city. */}
          {life.career ? (
            <ReadText size={12} lineHeight={12 * 1.25} tone="ink-300" numberOfLines={1}>
              {text.careers[life.career].levels[life.level]}
            </ReadText>
          ) : null}
          {/* Prison says so where the player always looks. */}
          {life.jailRounds > 0 ? (
            <Pressable
              accessibilityRole="button"
              testID="jail-tag"
              onPress={prison}
              style={tagBox(room)}
            >
              <Tag tone="bad">{`${t('inJail')} ›`}</Tag>
            </Pressable>
          ) : null}
        </View>
        {/* The paper of the round, to read again once the round is under way. */}
        {life.news ? null : <Square icon="icon.news" label={t('openNews')} onPress={() => setPaper(true)} />}
        <Square icon="icon.settings" label={t('openSettings')} onPress={() => setSettings(true)} />
      </View>
      <JailSheet open={jail && life.jailRounds > 0} onClose={() => setJail(false)} left={life.jailRounds} />
      <HudSettings open={settings} onClose={() => setSettings(false)} />
      <Sheet open={paper} onClose={() => setPaper(false)} title={t('newsTitle')} closeLabel={common('close')}>
        {paper ? <Headlines /> : null}
      </Sheet>
    </View>
  );
}

/** The two texts of the strip that sticks once the portrait is away: a pixel 13 and a reading 13, on one baseline. */
const AWAY = sharedBaseline(['pixel', 13, 13 * 1.1], ['read', 13, 13 * 1.45]);
/** The way out's label (13) and its figures (14), on one baseline. */
const WAY_OUT = sharedBaseline(['pixel', 13, 13 * 1.1], ['pixel', 14, 14 * 1.1]);

/**
 * The part of the Hud that sticks to the top: whose life it is once the portrait has scrolled away, the figures, and the way out of the rat
 * race. A tap on a figure opens a sheet of what it means and what it is made of.
 */
function HudFigures({ open }: { open?: HudOpen }) {
  const t = useT('hud');
  const common = useT('common');
  const { content, fmt } = useWords();
  const { locale } = useSettings();
  const lifeId = useGame((s) => s.lifeId) ?? '';
  const preview = useGame((s) => s.preview);
  const shown = useShown();
  const opened = FIGURES.find((figure) => figure === open);
  const [figure, setFigure] = useState<Figure>(opened ?? 'cash');
  const [showing, setShowing] = useState(opened !== undefined);
  // Once the row with the portrait has scrolled away, the strip that sticks says whose life and which round it is.
  const away = useScrolledPastLead();
  const p = shown.player;
  const years = content.yearsPerRound;
  const { yearly, escape } = useMemo(() => {
    const flow = cashflow(content, shown);
    return {
      yearly: flow.salaryAnnual + flow.passiveAnnual - flow.expensesAnnual - taxAnnual(content, shown),
      escape: preview ? preview.escape : escapeProgress(content, shown),
    };
  }, [content, shown, preview]);
  const escaped = p.escapedAtRound !== null;
  const age = ageAt(content, shown.round);
  const character = characterName(lifeId, locale);
  const round = t('roundShort', { n: Math.min(shown.round + 1, content.rounds), total: content.rounds });
  const show = (which: Figure) => {
    setFigure(which);
    setShowing(true);
  };
  const [pixelTop, readTop] = AWAY(locale);
  const [labelTop, figuresTop] = WAY_OUT(locale);
  const wayOut = usePress({ onPress: () => show('ratRace') });
  // The web marks its cash `[data-hud-cash]`: here it is put on the list of the page coins fly over (Play's), by name.
  const cashTarget = useCoinTarget('cash');

  return (
    <>
      <View style={{ gap: 8, paddingTop: 4, paddingBottom: 8 }}>
        {away ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flexShrink: 1, minWidth: 0, marginTop: pixelTop }}>
              {character ? (
                <PixelText size={13} tone="gold-500" numberOfLines={1} after={[{ text: common('age', { age }), tone: 'ink-200' }]}>
                  {`${character} · `}
                </PixelText>
              ) : (
                <PixelText size={13} tone="ink-200" numberOfLines={1}>{common('age', { age })}</PixelText>
              )}
            </View>
            <ReadText size={13} tone="ink-200" style={{ flexShrink: 0, marginTop: readTop }}>{round}</ReadText>
          </View>
        ) : null}
        <StatRow>
          {/* Where money that comes in lands: coins fly here from a card that paid. */}
          <Stat ref={cashTarget} icon="icon.cash" value={fmt.compact(p.cash)} label={t('cash')} onOpen={() => show('cash')} />
          <Stat icon="icon.cashflow" value={fmt.compact(yearly).replace(/^(?=[^−])/, '+')} label={t('flow')} tone={yearly >= 0 ? 'good' : 'bad'} hint={t('flowHint')} onOpen={() => show('flow')} />
          <Stat icon="icon.status" value={fmt.number(p.statusPoints)} label={t('status')} onOpen={() => show('status')} />
        </StatRow>
        <Pressable accessibilityRole="button" accessibilityHint={t('ratRaceHint')} onPress={wayOut} style={{ minHeight: TOUCH, justifyContent: 'center' }}>
          <View style={{ marginBottom: 4, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <PixelText size={13} style={{ marginTop: labelTop }}>{escaped ? t('escaped', { age: escapeAge(content, p.escapedAtRound ?? 0) }) : t('ratRace')}</PixelText>
            <PixelText size={14} tone="ink-200" style={{ marginTop: figuresTop }}>
              {`${fmt.compact(Math.floor(escape.passiveAfterTax / years))} / ${fmt.compact(Math.floor(escape.outgoings / years))}`}
            </PixelText>
          </View>
          <Bar value={escape.passiveAfterTax} max={escape.outgoings} label={t('ratRace')} tone={escaped ? 'teal' : 'gold'} door />
        </Pressable>
      </View>
      <Sheet open={showing} onClose={() => setShowing(false)} title={t(figure)} closeLabel={common('close')}>
        <Details figure={figure} shown={shown} />
      </Sheet>
    </>
  );
}

/**
 * Always in sight: who and where you are, cash, yearly cashflow, status, and how far passive income is from covering your life. `compact`
 * leaves the skyline out and shrinks the portrait, to give the cards and the finance tabs room.
 *
 * On the phone it is the two parts of a `StickyScreen`, as the web's page makes of it with `position: sticky`: `part="lead"` scrolls away
 * (the skyline, the portrait, who and where, the paper and the settings), `part="header"` sticks (whose life it is once the portrait has
 * gone, the figures, the way out). Each draws only what it shows, and holds its own sheets. The strip of a crisis that hangs under it on
 * the web (`CrisisBar compact`) is the screen's to place, under the header, where the page scrolls. `open` is what a scene shows open at the
 * start; each part opens what is its own.
 */
export function Hud({ part, compact = false, skyline = !compact, onProfile, open }: { part: 'lead' | 'header'; compact?: boolean; skyline?: boolean; onProfile?: () => void; open?: HudOpen }) {
  return part === 'lead' ? <HudLead compact={compact} skyline={skyline} onProfile={onProfile} open={open} /> : <HudFigures open={open} />;
}
