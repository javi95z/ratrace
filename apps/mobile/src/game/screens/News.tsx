import { headlineArt } from '@ratrace/content';
import { ratLookOf } from '@ratrace/core/game/avatar';
import { ageAt, headlineText, paperOf } from '@ratrace/core/game/present';
import { memberName } from '@ratrace/core/game/room';
import { rivalNews } from '@ratrace/core/game/rivals';
import type { Headline } from '@ratrace/engine';
import { useMemo, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { DashedRule } from '../../ui/DashedRule';
import { usePaper } from '../../ui/animations';
import { KEPT_LAYER } from '../../ui/keptLayer';
import { Framed } from '../../ui/Frame';
import { Panel, SrOnly } from '../../ui/kit';
import { RatAvatar } from '../../ui/RatAvatar';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, TIGHT } from '../../ui/text';
import { COLORS, EXTRA, type ColorToken } from '../../ui/theme';
import { useGame, useT, useWords } from '../context';
import { roomStory, useRoomPaper } from '../roomStory';
import type { RoomStory } from '../roomStory';
import { useRivals } from '../useRivals';
import { CityBanner } from './CityBanner';
import { CrisisBar } from './Crisis';

/*
 * The news of a round (the web's News.tsx). In a game with friends the paper tells of the players themselves (`roomStory`, `storyText`, the room's
 * members from `useRoomPaper`); alone, of the people the player grew up with (`useRivals`), now and then.
 */

/**
 * One gauge of the economy, as a dial sunk into the panel: an icon, where it stands, and what it is.
 * A gauge that reads as a word takes the whole width: "Desaceleración" does not fit beside another
 * gauge in a side column, and a reading is never cut short.
 */
function Gauge({ icon, label, value, wide = false }: { icon: string; label: string; value: string; wide?: boolean }) {
  return (
    <Framed
      kind="sunk"
      style={{ backgroundColor: COLORS['night-900'], padding: 6, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, ...(wide ? null : { flex: 1 }) }}
    >
      <Sprite id={icon} />
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <PixelText size={16} lineHeight={16 * TIGHT}>{value}</PixelText>
        <ReadText size={11} lineHeight={11 * TIGHT} tone="ink-200">{label}</ReadText>
      </View>
    </Framed>
  );
}

/**
 * The colour of the block a clipping's picture sits on, by what the headline is about. The markets' is the web's `bg-teal-500`, a colour its
 * palette does not have (the stylesheet sets every colour but the game's own aside), so its block is clear: the paper shows through.
 */
const TOPIC: Record<Headline['topic'], ColorToken | null> = {
  regime: 'gold-500',
  crypto: 'gold-700',
  rates: 'sky-300',
  inflation: 'wine-300',
  property: 'teal-300',
  asset: null,
  taxes: 'wine-500',
  noise: 'ink-300',
  government: 'sky-200',
};

/**
 * How the paper may tell each story of a game with friends: three ways each, as a tabloid would, so
 * the same news does not read the same twice in a row. The keys are written out, one by one.
 */
const PAPER = {
  lead: ['paperLead', 'paperLead2', 'paperLead3'],
  leadMe: ['paperLeadMe', 'paperLeadMe2', 'paperLeadMe3'],
  passed: ['paperPassed', 'paperPassed2', 'paperPassed3'],
  passedBy: ['paperPassedBy', 'paperPassedBy2', 'paperPassedBy3'],
  jump: ['paperJump', 'paperJump2', 'paperJump3'],
  jumpMe: ['paperJumpMe', 'paperJumpMe2', 'paperJumpMe3'],
  drop: ['paperDrop', 'paperDrop2', 'paperDrop3'],
  dropMe: ['paperDropMe', 'paperDropMe2', 'paperDropMe3'],
  neck: ['paperNeck', 'paperNeck2', 'paperNeck3'],
  last: ['paperLast', 'paperLast2', 'paperLast3'],
  lastMe: ['paperLastMe', 'paperLastMe2', 'paperLastMe3'],
} as const;

/** The story of a game with friends in the words of the paper: one of its ways, turned by the round and by who it is about. */
export function storyText(t: (key: string, values?: Record<string, string | number>) => string, story: RoomStory, round: number): string {
  const name = (member: { name: string | null; userId: string; bot: string | null }) => memberName(t, member);
  const way = (keys: readonly string[]) => {
    let mix = round;
    for (const char of story.who.userId) mix += char.charCodeAt(0);
    return keys[mix % keys.length];
  };
  switch (story.kind) {
    case 'lead':
      return story.me ? t(way(PAPER.leadMe)) : t(way(PAPER.lead), { who: name(story.who) });
    case 'passed':
      return t(way(PAPER.passed), { who: name(story.who) });
    case 'passedBy':
      return t(way(PAPER.passedBy), { who: name(story.who) });
    case 'jump':
      return story.me ? t(way(PAPER.jumpMe), { n: story.points }) : t(way(PAPER.jump), { who: name(story.who), n: story.points });
    case 'drop':
      return story.me ? t(way(PAPER.dropMe), { n: story.points }) : t(way(PAPER.drop), { who: name(story.who), n: story.points });
    case 'neck':
      return t(way(PAPER.neck), { who: name(story.who), other: name(story.other) });
    case 'last':
      return story.me ? t(way(PAPER.lastMe)) : t(way(PAPER.last), { who: name(story.who) });
  }
}

export { dashesOf } from '../../ui/DashedRule';

/** A clipping of the paper: the block with its picture, what it is about, and what it says, under a dashed rule unless it is the first. */
function Clipping({ first, topic, children, picture }: { first: boolean; topic: string; children: string; picture: ReactNode }) {
  return (
    <View role="listitem">
      {first ? null : <DashedRule />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
        {picture}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View {...{ dataSet: { topic: 'true' } }}>
            <PixelText size={11} lineHeight={11} tone="ink-500" style={{ letterSpacing: 11 * 0.12 }}>{topic.toUpperCase()}</PixelText>
          </View>
          <ReadText size={15} weight={600} lineHeight={15 * TIGHT} tone="ink-900" style={{ marginTop: 2 }}>{children}</ReadText>
        </View>
      </View>
    </View>
  );
}

/** The 44-point block a clipping's picture sits in, its 1-point ink edge round it: an icon inside its padding, or a famous face filling it. */
function Picture({ art, bg }: { art: string; bg: ColorToken | null }) {
  const whole = art.startsWith('celeb.');
  const box: ViewStyle = { width: 44, height: 44, flexShrink: 0, borderWidth: 1, borderColor: COLORS['ink-900'], ...(bg ? { backgroundColor: COLORS[bg] } : null), overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: whole ? 0 : 4 };
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={box}>
      <Sprite id={art} size={whole ? { w: 42, h: 42 } : undefined} />
    </View>
  );
}

/** The newspaper's drop shadow (the web's `4px 4px 0 rgb(0 0 0 / 0.45)`): what shows of it, right and below. */
const SHADOW_RIGHT: ViewStyle = { position: 'absolute', right: -4, top: 4, bottom: -4, width: 4, backgroundColor: EXTRA.paperShadow };
const SHADOW_FOOT: ViewStyle = { position: 'absolute', left: 4, right: 0, bottom: -4, height: 4, backgroundColor: EXTRA.paperShadow };

/** A newspaper, thrown onto the table once a round, spinning: masthead, the double rule of its border, and its stories. */
function Paper({ children }: { children: ReactNode }) {
  const paper = usePaper();
  // A layer of its own on the web, as Chrome keeps the Next web's paper once thrown (ui/keptLayer.web.ts); nothing more on the phone.
  return <Animated.View style={[paper, KEPT_LAYER]}>{children}</Animated.View>;
}

/** The headlines about the next two years, and the gauges of the economy. */
export function Headlines() {
  const t = useT('news');
  const words = useWords();
  const { names, text, fmt } = words;
  const view = useGame((s) => s.view);
  const history = useGame((s) => s.history);
  const people = useRivals();
  const r = useT('rivals');
  const room = useT('room');
  const players = useRoomPaper();
  // The papers of every round so far are read to pick this one's wording: once for a view, not on every drawing.
  const printed = useMemo(() => (view ? paperOf(words, view.timeline, view.round) : []), [words, view]);
  if (!view) return null;
  const world = view.timeline[view.round];
  // In a game with friends the paper tells of the players themselves; alone, of the people the player grew up with, now and then.
  const story = players ? roomStory(players) : null;
  const gossip = players === null && people ? rivalNews(people.rivals, history, view.round) : null;
  const told = story ? storyText(room, story, view.round) : gossip && people ? r(`stories.${gossip.story}`, { who: people.who(gossip.rival) }) : null;

  return (
    <View style={{ gap: 12 }}>
      <CrisisBar crisis={world.crisis} />
      <Paper key={view.round}>
        <View>
          <View style={SHADOW_RIGHT} />
          <View style={SHADOW_FOOT} />
          {/* Its border, 2 of ink, round the cream of the page. */}
          <View role="region" aria-label={t('title')} style={{ padding: 2, backgroundColor: COLORS['ink-900'] }}>
            <View style={{ backgroundColor: COLORS.cream, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 }}>
              {/* The double rule of its border: 3 of cream inside it, then a line of ink. */}
              <View pointerEvents="none" style={{ position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderWidth: 1, borderColor: COLORS['ink-900'] }} />
              <View accessibilityRole="header" style={{ position: 'absolute' }}>
                <SrOnly>{t('title')}</SrOnly>
              </View>
              <View>
                <PixelText size={26} lineHeight={26} tone="ink-900" style={{ textAlign: 'center', letterSpacing: 26 * 0.025 }}>{t('paper')}</PixelText>
                <View style={{ marginTop: 6, height: 3, backgroundColor: COLORS['ink-900'] }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                  <PixelText size={12} tone="ink-500" style={{ letterSpacing: 12 * 0.12 }}>{names.cities[view.player.cityId].toUpperCase()}</PixelText>
                  <PixelText size={12} tone="ink-500" style={{ letterSpacing: 12 * 0.12 }}>{t('issue', { n: view.round + 1 }).toUpperCase()}</PixelText>
                </View>
                <View style={{ height: 1, backgroundColor: COLORS['ink-900'] }} />
              </View>
              <View role="list">
                {printed.map(({ headline: h, n }, i) => {
                  // The same number picks the words and, when one of the famous says them, the portrait.
                  const art = headlineArt(h, n);
                  return (
                    <Clipping key={i} first={i === 0} topic={t(`topics.${h.topic}`)} picture={<Picture art={art} bg={TOPIC[h.topic]} />}>
                      {headlineText(words, h, n)}
                    </Clipping>
                  );
                })}
                {told ? (
                  // A story of the game with friends shows the rat it is about.
                  <Clipping
                    first={false}
                    topic={story ? room('paperTopic') : r('topic')}
                    picture={story ? <RatAvatar look={ratLookOf(story.who.avatar, story.who.userId)} size="md" /> : <Picture art="icon.percentile" bg="gold-200" />}
                  >
                    {told}
                  </Clipping>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </Paper>

      {/* Two columns: the two gauges that read as figures side by side, each that reads as a word across both. */}
      <Panel>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Gauge icon="icon.rates" label={t('rates')} value={fmt.rate(world.policyRateBp)} />
            <Gauge icon="icon.inflation" label={t('inflation')} value={fmt.rate(world.inflationBp)} />
          </View>
          <Gauge icon="icon.mood" label={t('economy')} value={text.regimes[world.regime]} wide />
          <Gauge icon="icon.crypto" label={t('crypto')} value={text.cryptoPhases[world.cryptoPhase]} wide />
        </View>
      </Panel>
    </View>
  );
}

/** The news as a phone shows it: the headlines and the gauges. How the last ones turned out is for the player to work out. */
export function NewsPanel() {
  return <Headlines />;
}

/** How a round opens on a wide screen, where the headlines already sit at the side. (The phone has no wide screen: kept with its words, for the web's name.) */
export function RoundOpener() {
  const t = useT('news');
  const common = useT('common');
  const { content, names } = useWords();
  const view = useGame((s) => s.view);
  if (!view) return null;

  return (
    <View style={{ gap: 12 }}>
      <CityBanner cityId={view.player.cityId} light="day" />
      <Panel>
        <View style={{ alignItems: 'center' }}>
          <PixelText size={13} tone="ink-300" style={{ letterSpacing: 13 * 0.05 }}>{common('round', { n: view.round + 1, total: content.rounds }).toUpperCase()}</PixelText>
          <PixelText size={32} lineHeight={32} tone="gold-500" style={{ marginTop: 4 }}>{common('age', { age: ageAt(content, view.round) })}</PixelText>
          <ReadText tone="ink-200" style={{ marginTop: 4 }}>{names.cities[view.player.cityId]}</ReadText>
          <ReadText size={13} tone="ink-300" style={{ marginTop: 12, maxWidth: 384, textAlign: 'center' }}>{t('opener')}</ReadText>
        </View>
      </Panel>
    </View>
  );
}
