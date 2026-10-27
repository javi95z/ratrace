import { BADGE_RARITY, badges, itemArt, PEOPLE, personArt, personEndings, RARITIES, rarityOf } from '@ratrace/content';
import type { PersonId } from '@ratrace/content';
import type { BadgeRarity } from '@ratrace/content';
import { memo, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Bare, Segmented, SrOnly } from '../../ui/kit';
import { Tabs } from '../../ui/overlay';
import { PerfDrawn } from '../../ui/perf';
import { WIDE_COLUMN } from '../../ui/desk';
import { ListScreen } from '../../ui/Page';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG, TIGHT } from '../../ui/text';
import { COLORS, grey } from '../../ui/theme';
import { useProfile, useT, useWords } from '../context';
import { BackLink } from './BackLink';
import { Medal } from './Medal';
import { RARITY_TONE } from './rarityStyle';
import { Heading } from './Heading';

type Tab = 'items' | 'badges' | 'people';

/**
 * How many to a row, by the width of the page's column inside its gutter: the web's container queries on its `main` (`@container`), which measure
 * the same width. Three rarities to a row, five from 460 (`grid-cols-3 @min-[460px]:grid-cols-5`); two things, four from 560; one badge, two
 * from 560. A phone's column is at most 448, 424 inside its gutter: never as wide as these, so a phone always has the first of each. A browser's is
 * the web's `max-w-2xl` (`WIDE_COLUMN`, 672, 648 inside), as wide as the window lets it be.
 */
export function columnsAt(width: number): { rarities: number; things: number; badges: number } {
  return { rarities: width >= 460 ? 5 : 3, things: width >= 560 ? 4 : 2, badges: width >= 560 ? 2 : 1 };
}

/** The width from which the columns change last (`columnsAt`): all a page keeps of its width, so a width that crosses none draws nothing again. */
export const breakpointOf = (width: number): number => (width >= 560 ? 560 : width >= 460 ? 460 : 0);

/** A tile of a row: a thing (owned or not) or a badge (earned or not). */
type Tile = { id: string; on: boolean };

/**
 * A line of the list, all that it shows: a group's heading, or a row of its things or badges, each owned or earned or not, the first of a group under
 * its heading with nothing between.
 */
type Line =
  | { kind: 'heading'; key: string; title: string }
  | { kind: 'things' | 'badges'; key: string; tiles: readonly Tile[]; columns: number; first: boolean }
  | { kind: 'people'; key: string; people: ReadonlyArray<{ who: PersonId; met: boolean; endings: number }>; columns: number; first: boolean };

/** The lines of groups of ids: each group's heading, then its ids in rows of `columns`, each said to be owned or earned (`on`) or not. */
function linesOf(kind: 'things' | 'badges', groups: ReadonlyArray<{ id: string; title: string; ids: readonly string[] }>, columns: number, on: (id: string) => boolean): Line[] {
  return groups.flatMap((group) => {
    const rows: Line[] = [];
    for (let at = 0; at < group.ids.length; at += columns) {
      const ids = group.ids.slice(at, at + columns);
      rows.push({ kind, key: `${kind}-${ids.join('+')}`, tiles: ids.map((id) => ({ id, on: on(id) })), columns, first: at === 0 });
    }
    return [{ kind: 'heading', key: `${kind}-group-${group.id}`, title: group.title } as Line, ...rows];
  });
}

/** A line's name in the list. */
const keyOf = (line: Line): string => line.key;

/** A line drawn from itself alone: a group's heading (16 over it, the web's `gap-4` between groups; 8 under it), or a row of tiles, 8 apart (`gap-2`). */
function lineOf(line: Line): ReactElement {
  if (line.kind === 'heading') {
    return (
      <View style={{ paddingTop: 16 }}>
        <Heading>{line.title}</Heading>
      </View>
    );
  }
  if (line.kind === 'people') {
    return (
      // The first row stands clear of the count, as the other tabs' first heading does (16 over it).
      <View style={{ paddingTop: line.first ? 16 : 8, flexDirection: 'row', gap: 8 }}>
        {line.people.map(({ who, met, endings }) => (
          <Person key={who} who={who} met={met} endings={endings} />
        ))}
        {Array.from({ length: line.columns - line.people.length }, (_, i) => (
          <View key={`empty-${i}`} style={{ flex: 1, minWidth: 0 }} />
        ))}
      </View>
    );
  }
  return (
    <View style={{ paddingTop: line.first ? 0 : 8, flexDirection: 'row', gap: 8 }}>
      {line.tiles.map(({ id, on }) => (line.kind === 'things' ? <Thing key={id} itemId={id} owned={on} /> : <BadgeLine key={id} badgeId={id} got={on} />))}
      {/* A short last row leaves its other places empty, as the web's grid does: its tiles are no wider. */}
      {Array.from({ length: line.columns - line.tiles.length }, (_, i) => (
        <View key={`empty-${i}`} style={{ flex: 1, minWidth: 0 }} />
      ))}
    </View>
  );
}

/** What a missing picture keeps room for. */
const FALLBACK = { w: 64, h: 64 };

/**
 * A thing of the game, as the shop groups it: in colour with its name once owned in any life, a shadow until then. Drawn again only when it is
 * owned (or no longer), whatever else of the list changes.
 */
const Thing = memo(function Thing({ itemId, owned }: { itemId: string; owned: boolean }) {
  const t = useT('collection');
  const { names } = useWords();
  return (
    <View role="listitem" style={{ flex: 1, minWidth: 0 }}>
      <Framed kind={owned ? 'bevel' : 'frame'} tone={owned ? GOLD : undefined} style={{ flex: 1, backgroundColor: COLORS[owned ? 'night-600' : 'night-700'], alignItems: 'center', gap: 4, padding: 8 }}>
        {/* The name stands under the picture, so the picture itself says nothing more. What has never been owned is a shape and no name: finding out is the game. */}
        <Bare style={{ width: '100%', paddingVertical: 6 }}>
          <Sprite id={itemArt(itemId)} silhouette={!owned} fallback={FALLBACK} />
        </Bare>
        {owned ? (
          <ReadText size={13} lineHeight={13 * TIGHT} style={{ textAlign: 'center' }}>{names.items[itemId] ?? itemId}</ReadText>
        ) : (
          <SrOnly>{t('notOwned')}</SrOnly>
        )}
      </Framed>
    </View>
  );
});

/**
 * One of the people who come back, as the things are drawn: once met in any life, their face, who they are and how many of their story's
 * endings the player has seen; a shadow and no name until then.
 */
const Person = memo(function Person({ who, met, endings }: { who: PersonId; met: boolean; endings: number }) {
  const t = useT('collection');
  const { text } = useWords();
  return (
    <View role="listitem" style={{ flex: 1, minWidth: 0 }}>
      <Framed kind={met ? 'bevel' : 'frame'} tone={met ? GOLD : undefined} style={{ flex: 1, backgroundColor: COLORS[met ? 'night-600' : 'night-700'], alignItems: 'center', gap: 4, padding: 8 }}>
        <Bare style={{ width: '100%', paddingVertical: 6 }}>
          <Sprite id={personArt(who, 'pleased')} silhouette={!met} fallback={FALLBACK} />
        </Bare>
        {met ? (
          <>
            <ReadText size={13} lineHeight={13 * TIGHT} style={{ textAlign: 'center' }}>{text.people[who].who}</ReadText>
            <ReadText size={12} tone="ink-300" style={{ textAlign: 'center' }}>{t('endingsCount', { n: endings, total: personEndings[who].length })}</ReadText>
          </>
        ) : (
          <SrOnly>{t('notMet')}</SrOnly>
        )}
      </Framed>
    </View>
  );
});

/** The group each badge belongs to, by its id. */
const GROUP_OF: ReadonlyMap<string, (typeof badges)[number]['group']> = new Map(badges.map((badge) => [badge.id, badge.group]));

/**
 * A badge in the rim of its rarity, with how it is earned once it has been. One not earned yet is the lock in the same rim, and the whole card is
 * drawn as the web draws it, through its `grayscale` filter: its pictures, its frame, its ground and its words in grey. Drawn again only when it is
 * earned, whatever else of the list changes (another rarity chosen leaves the badges that stay as they are).
 */
const BadgeLine = memo(function BadgeLine({ badgeId, got }: { badgeId: string; got: boolean }) {
  const labels = useT('badges');
  const { text } = useWords();
  // A badge whose rarity is a judgement is a secret until won: no name, only the group it belongs to.
  const secret = !got && BADGE_RARITY[badgeId]?.judged === true;
  const rarity = rarityOf(badgeId);
  const group = GROUP_OF.get(badgeId);
  const ink = (colour: string) => (got ? colour : grey(colour));
  return (
    <View role="listitem" style={{ flex: 1, minWidth: 0 }} {...{ dataSet: { rarity, ...(secret ? { secret: 'true' } : null) } }}>
      <Framed kind={got ? 'bevel' : 'frame'} tone={got ? GOLD : undefined} grey={!got} style={{ flex: 1, backgroundColor: ink(COLORS[got ? 'night-600' : 'night-700']), flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8 }}>
        <Medal badgeId={badgeId} locked={!got} grey={!got} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <PixelText size={16} style={{ color: got ? COLORS.cream : grey(COLORS['ink-200']) }}>{secret ? labels('hiddenName') : (text.badges[badgeId]?.name ?? badgeId)}</PixelText>
          {/* The web's silver names no colour of its palette (rarityStyle.ts): it keeps the card's own, cream. */}
          <PixelText size={11} style={{ letterSpacing: 11 * 0.1, textTransform: 'uppercase', color: ink(RARITY_TONE[rarity] ?? COLORS.cream) }}>{labels(`rarity.${rarity}`)}</PixelText>
          {/* How a badge is earned is told once it has been: until then its name is the only clue. */}
          {got ? <ReadText size={13} tone="ink-200" lineHeight={13 * SNUG}>{text.badges[badgeId]?.how ?? ''}</ReadText> : null}
          {got ? null : (
            <ReadText size={12} style={{ marginTop: 2, color: grey(COLORS['ink-300']) }}>
              {secret && group !== undefined ? labels('hiddenHint', { group: text.badgeGroups[group] }) : labels('notYet')}
            </ReadText>
          )}
        </View>
      </Framed>
    </View>
  );
});

/** The count at the head of a tab (the web's `pixel text-center text-[15px] text-gold-500`). */
function Count({ children }: { children: string }) {
  return (
    <PixelText size={15} tone="gold-500" style={{ textAlign: 'center' }}>{children}</PixelText>
  );
}

/**
 * The gallery of everything ever owned and every badge ever earned, across all lives: the badges first (what a player has done comes before what
 * they have bought), the things on the second tab. The page is one list that draws only the rows near the screen (67 things, 63 badges, each
 * with its pictures): its head (the title, the words under it, the tabs, the tab's count and rarities) is the list's header and scrolls away with
 * the rows, as the web's page does. `tab` is the tab open from the start (a scene's initial state; the player opens the other by a tap).
 */
export function Collection({ tab: first = 'badges' }: { tab?: Tab } = {}) {
  const t = useT('collection');
  const labels = useT('badges');
  const { content, text } = useWords();
  const { gallery, badges: earned, people: seen } = useProfile();
  const [tab, setTab] = useState<Tab>(first);
  // One rarity at a time, or all: the badges' tab's own, so it is all of them again whenever the tab is shown again.
  const [only, setOnly] = useState<BadgeRarity | 'all'>('all');
  const [breakpoint, setBreakpoint] = useState(0);
  const columns = columnsAt(breakpoint);
  // The web's badges' tab is drawn anew each time it is shown, its choice of rarity with it; pressing the tab already open changes nothing.
  const choose = (next: Tab) => {
    if (next === tab) return;
    setTab(next);
    setOnly('all');
  };

  // Every line made again only when what it shows changes: a group's name, a thing owned, a badge earned, the rarity chosen, the columns.
  const things = useMemo(() => {
    const owned = new Set(gallery);
    const ladders = [...new Set(content.items.map((item) => item.ladder))];
    const groups = ladders.map((ladder) => ({ id: ladder, title: text.ladders[ladder] ?? ladder, ids: content.items.filter((item) => item.ladder === ladder).map((item) => item.id) }));
    return linesOf('things', groups, columns.things, (id) => owned.has(id));
  }, [content, text, gallery, columns.things]);
  const shownBadges = useMemo(() => {
    const shown = badges.filter((badge) => only === 'all' || rarityOf(badge.id) === only);
    const groups = [...new Set(shown.map((badge) => badge.group))];
    const lines = groups.map((group) => ({ id: group, title: text.badgeGroups[group], ids: shown.filter((badge) => badge.group === group).map((badge) => badge.id) }));
    return linesOf('badges', lines, columns.badges, (id) => Object.hasOwn(earned, id));
  }, [only, text, earned, columns.badges]);
  // The people, as many to a row as the things: each met or not, and the endings of their story seen.
  const people = useMemo(() => {
    const all = PEOPLE.map((who) => ({ who, met: seen.includes(who), endings: personEndings[who].filter((ending) => seen.includes(`${who}.${ending.id}`)).length }));
    const lines: Line[] = [];
    for (let at = 0; at < all.length; at += columns.things) lines.push({ kind: 'people', key: `people-${at}`, people: all.slice(at, at + columns.things), columns: columns.things, first: at === 0 });
    return lines;
  }, [seen, columns.things]);
  const count = (list: typeof badges) => list.filter((badge) => Object.hasOwn(earned, badge.id)).length;

  const head = (
    <View>
      <View style={{ marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackLink />
        <View accessibilityRole="header" style={{ flexShrink: 1 }}>
          <PixelText size={24} tone="gold-500">{t('title')}</PixelText>
        </View>
      </View>
      <ReadText size={13} tone="ink-300" style={{ marginBottom: 8 }}>{t('intro')}</ReadText>
      {/* The tabs run to the edges of the screen, their own gutter inside them (the web's `-mx-3`). */}
      <View style={{ marginHorizontal: -12 }}>
        <Tabs<Tab> label={t('title')} tabs={[{ id: 'badges', label: t('badges') }, { id: 'items', label: t('items') }, { id: 'people', label: t('people') }]} value={tab} onChange={choose} />
      </View>
      {/* The head of the tab's panel (the web's `pt-2`, then `gap-4`): its count, and for the badges one rarity at a time, each saying how many of it are won. */}
      <View style={{ paddingTop: 8, gap: 16 }}>
        {tab === 'items' ? (
          <Count>{t('itemsCount', { n: gallery.filter((id) => content.items.some((item) => item.id === id)).length, total: content.items.length })}</Count>
        ) : tab === 'people' ? (
          <Count>{t('peopleCount', { n: PEOPLE.filter((who) => seen.includes(who)).length, total: PEOPLE.length })}</Count>
        ) : (
          <>
            <Count>{t('badgesCount', { n: count(badges), total: badges.length })}</Count>
            <Segmented<BadgeRarity | 'all'>
              label={t('rarity')}
              value={only}
              onChange={setOnly}
              columns={columns.rarities}
              options={[
                { value: 'all', label: t('rarityAll') },
                ...RARITIES.map((rarity) => {
                  const of = badges.filter((badge) => rarityOf(badge.id) === rarity);
                  return { value: rarity, label: labels(`rarity.${rarity}`), hint: `${count(of)}/${of.length}` };
                }),
              ]}
            />
          </>
        )}
      </View>
    </View>
  );

  // The web's panel of the tab (`role="tabpanel"`) holds the count and the rows, under the tabs. Here they are the rows of the page's list, whose header
  // holds the tabs as well, and no prop of a FlatList puts a role on the box of its rows alone: the panel is not named (iOS and Android say nothing of a
  // tab panel either). The tabs are a tab list of their own (`Tabs`), each saying which is selected.
  return (
    <>
      <PerfDrawn name={`collection: ${tab}`} />
      <ListScreen
        width={WIDE_COLUMN}
        head={head}
        data={tab === 'items' ? things : tab === 'people' ? people : shownBadges}
        keyOf={keyOf}
        item={lineOf}
        onWidth={(width) => setBreakpoint(breakpointOf(width))}
        contentStyle={{ paddingBottom: 40 }}
      />
    </>
  );
}
