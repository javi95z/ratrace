import { cityIcon, lives, portraitArt } from '@ratrace/content';
import { escapeAge } from '@ratrace/core/game/present';
import type { Community, RankedLifeDetail, RankingRow } from '@ratrace/online/types';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Bare, Button, Figure, KeyFigure, Notice, pressDown, Row, Segmented, usePress } from '../../ui/kit';
import { Loading } from '../../ui/Loading';
import { Sheet, Tabs, Toast } from '../../ui/overlay';
import { BottomBar, ListScreen } from '../../ui/Page';
import { WIDE_COLUMN } from '../../ui/desk';
import { PerfDrawn } from '../../ui/perf';
import { Picker } from '../../ui/Picker';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, EXTRA } from '../../ui/theme';
import { useCommunity, useWords } from '../context';
import { useT } from '../words';
import { BackLink } from './BackLink';
import { ChallengeBoard, ChallengeEntry, topTenth, useChallengeBoard } from './Challenge';
import { FriendInvite, FriendRequests, useFriendCode, useFriendships } from './Friends';
import { LifeFace } from './LifeFace';
import { Medal } from './Medal';
import { WorthGraph } from './WorthGraph';

/** The rankings' tabs: everyone's, the player's friends', and the week's challenge. */
export type Tab = 'global' | 'friends' | 'challenge';
/** The period of everyone's ranking and the friends': this week, or all time. */
export type Period = 'week' | 'all';
/**
 * What a link opens the page on (the route's `?tab=`): a tab, or a period of everyone's ranking (`week` and `all`, the tabs it had before: a link of
 * then, a notice's or a scene's, opens on the same ranking).
 */
export type Opening = Tab | Period;
export const OPENINGS: readonly Opening[] = ['global', 'friends', 'challenge', 'week', 'all'];
const TABS: readonly Tab[] = ['global', 'friends', 'challenge'];
const PERIODS: readonly Period[] = ['week', 'all'];
/** The tab and the period a link opens on: a period alone is everyone's ranking of it. */
const openingOf = (opening: Opening): { tab: Tab; period?: Period } => (opening === 'week' || opening === 'all' ? { tab: 'global', period: opening } : { tab: opening });
/** Fewer friends than this, and the ranking among them asks the player to add some. */
const FEW_FRIENDS = 2;
/** How a name is written. The database checks it again, and what it says. */
export const NAME = /^[A-Za-z0-9_]{3,16}$/;

/** What a player with no name is told apart by: the start of their id. */
const tagOf = (userId: string) => userId.slice(0, 4).toUpperCase();

/**
 * The gold, silver and bronze of the first three places. The web's third is `#c98a4b`, the bronze of a common badge's rim (`EXTRA.bronze`); its
 * second, `text-ink-100`, names no colour of its palette, so the line's own is drawn there: cream (its button's `color: inherit`, from the page).
 */
const placeColour = (place: number): string => (place === 1 ? COLORS['gold-500'] : place === 2 ? COLORS.cream : place === 3 ? EXTRA.bronze : COLORS['ink-200']);

/**
 * A line of a ranking: the place in its metal, the face of the starting life, the name with the life and the day it ended under it, the score.
 * The player's own is lit gold, and is the line they are on (the web's `aria-current`). A press opens the life behind it. Drawn again only when one of
 * these changes: a ranking switched to that has the same line draws it no more.
 */
const RankLine = memo(function RankLine({ userId, place, lifeId, name, sub, score, mine, onOpen }: { userId: string; place: number; lifeId: string; name: string; sub: string; score: string; mine: boolean; onOpen(userId: string): void }) {
  const phone = useT('phone');
  const press = usePress({ onPress: () => onOpen(userId) });
  return (
    // The player's own line says so on the button a screen reader stops on (the web's `aria-current`); the item says it too, for the list.
    <View role="listitem" aria-selected={mine}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: mine }} accessibilityHint={phone('opensLife')} onPress={press} style={({ pressed }) => pressDown(pressed)}>
        <Framed kind="bevel" tone={mine ? GOLD : undefined} style={{ backgroundColor: COLORS[mine ? 'night-600' : 'night-700'], flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
          {/* At least two digits' room, more for a place past them (the player's own, a thousandth): never cut. */}
          <PixelText size={17} style={{ minWidth: 32, flexShrink: 0, textAlign: 'right', color: placeColour(place) }}>{String(place)}</PixelText>
          <Bare style={{ width: 32, height: 32 }}>
            <LifeFace lifeId={lifeId} />
          </Bare>
          {/* The name, and the life and the day under it, wrap where the line is narrow (a Russian life on a phone 360 wide): never cut. */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <ReadText>{name}</ReadText>
            <ReadText size={12} tone="ink-300">{sub}</ReadText>
          </View>
          <PixelText size={18} style={{ flexShrink: 0 }}>{score}</PixelText>
          <View aria-hidden importantForAccessibility="no-hide-descendants">
            <ReadText size={11} tone="ink-300">{'▸'}</ReadText>
          </View>
        </Framed>
      </Pressable>
    </View>
  );
});

/**
 * The sheet of the life behind a line, open while a line is (`row`). It keeps the last line it showed while it leaves (a sheet that closes is gone
 * only once its Modal has, `Sheet`). Each opening draws the life anew (the sheet's panel is a new one each time it opens), and so asks the cloud anew,
 * as the web's sheet is drawn anew each time it is opened.
 */
function RunSheet({ community, row, nameOf, onClose }: { community: Community; row: RankingRow | null; nameOf(row: RankingRow): string; onClose(): void }) {
  const common = useT('common');
  const [last, setLast] = useState(row);
  if (row !== null && row !== last) setLast(row);
  const shown = row ?? last;
  return (
    <Sheet open={row !== null} half onClose={onClose} title={shown ? nameOf(shown) : ''} closeLabel={common('close')}>
      {shown ? <RunLife community={community} row={shown} /> : null}
    </Sheet>
  );
}

/**
 * The life behind a line of a ranking, as anyone may see it: how it ended, what it was worth year by year, the cities it was lived in and the badges
 * it earned. Asked of the cloud when opened.
 */
function RunLife({ community, row }: { community: Community; row: RankingRow }) {
  const t = useT('rankings');
  const end = useT('end');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  /** `undefined` while it is on its way; null when it could not be read. */
  const [life, setLife] = useState<RankedLifeDetail | null | undefined>(undefined);
  const [badge, setBadge] = useState<string | null>(null);
  useEffect(() => {
    let wanted = true;
    void community.run(row).then((found) => {
      if (wanted) setLife(found);
    });
    return () => {
      wanted = false;
    };
  }, [community, row]);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <LifeFace lifeId={row.lifeId} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <PixelText size={16} numberOfLines={1}>{text.lives[row.lifeId]?.name ?? row.lifeId}</PixelText>
          <ReadText size={12} tone="ink-300">{t('place', { place: row.place, day: fmt.day(row.finishedAt) })}</ReadText>
        </View>
        <KeyFigure>{fmt.number(row.score)}</KeyFigure>
      </View>
      {life === undefined ? <Loading>{common('loading')}</Loading> : null}
      {life === null ? <ReadText size={13} tone="ink-200">{t('runUnreachable')}</ReadText> : null}
      {life ? (
        <>
          <View>
            <Row left={end('netWorth')} right={<Figure tone="gold-500">{fmt.money(life.netWorth)}</Figure>} />
            <Row left={t('runStatus')} right={fmt.number(life.status)} />
            <Row left={t('runEscape')} right={life.escapedAtRound === null ? t('runNever') : t('runAge', { age: escapeAge(content, life.escapedAtRound) })} />
            <Row left={t('runBankruptcies')} right={fmt.number(life.bankruptcies)} />
          </View>
          {life.history.length > 1 ? <WorthGraph history={life.history} label={end('graph')} height={72} /> : null}
          {life.cities.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <ReadText size={13} tone="ink-200">{`${t('runCities')}:`}</ReadText>
              {life.cities.map((city) => (
                <View key={city} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Sprite id={cityIcon(city)} />
                  <ReadText size={13} tone="ink-200">{names.cities[city] ?? city}</ReadText>
                </View>
              ))}
            </View>
          ) : null}
          {life.badges.length > 0 ? (
            <>
              <View role="list" aria-label={t('runBadges')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {life.badges.map((id) => (
                  <View key={id} role="listitem">
                    {/* Its name on a tap: a phone has no hover. A second tap hides it. */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={text.badges[id]?.name ?? id}
                      accessibilityState={{ selected: badge === id }}
                      aria-selected={badge === id}
                      onPress={() => setBadge(badge === id ? null : id)}
                    >
                      <Medal badgeId={id} size="sm" />
                    </Pressable>
                  </View>
                ))}
              </View>
              {badge ? (
                <View accessible role="status">
                  <PixelText
                    size={13}
                    tone="gold-500"
                    lineHeight={13 * SNUG}
                    after={text.badges[badge]?.how ? [{ text: ` · ${text.badges[badge]?.how}`, tone: 'ink-200', read: 13 }] : undefined}
                  >
                    {text.badges[badge]?.name ?? badge}
                  </PixelText>
                </View>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** A line of the page's list, all that it shows: a line of a ranking, or a player's best attempt at the week's challenge. */
type Line =
  | { kind: 'rank'; key: string; first: boolean; userId: string; place: number; lifeId: string; name: string; sub: string; score: string; mine: boolean }
  | { kind: 'entry'; key: string; first: boolean; place: number; name: string; day: string; score: string; top: boolean; mine: boolean };

/** A line's name in the list. */
const keyOf = (line: Line): string => line.key;

/** What is asked of the cloud for a ranking: its tab, its period and its starting life, the name its answer is known by. */
const askingOf = (tab: Tab, period: Period, lifeId: string | null): string => `${tab} ${period} ${lifeId ?? ''}`;

/**
 * The player's own line where the ranking lists it apart from the others: the server answers the first fifty and the player's own, which is past them
 * when its place does not follow the line before it. Null where it is among them, or not there.
 */
const apartOf = (rows: readonly RankingRow[]): RankingRow | null => {
  const at = rows.findIndex((row) => row.mine);
  return at > 0 && rows[at].place !== rows[at - 1].place + 1 ? rows[at] : null;
};

/** The line of the requests waiting on the player, at the top of the ranking among friends: pressed, it opens them (`FriendRequests`). */
function RequestsLine({ count, onOpen }: { count: number; onOpen(): void }) {
  const t = useT('rankings');
  const press = usePress({ onPress: onOpen });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('requestsWaiting', { count })} onPress={press} style={({ pressed }) => pressDown(pressed)}>
      <Framed kind="bevel" tone={GOLD} style={{ backgroundColor: COLORS['night-600'], flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8 }}>
        <ReadText size={14} tone="gold-200" style={{ flex: 1, minWidth: 0 }}>{t('requestsWaiting', { count })}</ReadText>
        <View aria-hidden importantForAccessibility="no-hide-descendants">
          <PixelText size={14} tone="ink-300">{'›'}</PixelText>
        </View>
      </Framed>
    </Pressable>
  );
}

/**
 * The rankings: the best ranked life of each player, of everyone or among the player's friends, of this week or of all time, of any starting life or
 * of one; and the ranking of the week's challenge. Only lives the server played are in them, so every line can be set beside every other. Everything
 * here is asked of the cloud and shown as it answers. Among friends, the requests waiting on the player are a line at the top, answered in a sheet, and
 * a player with one friend or none is asked to add some (their invitation, `FriendInvite`); the rest of the friends are on the games with others' page.
 *
 * The page is one list that draws only the lines near the screen (a ranking is fifty lines and the player's own): its head (the title, the tabs, the
 * period, what the ranking came to) is the list's header; its rows are the ranking's lines. The player's own line, where the ranking has it past its
 * fifty, stands pinned at the foot of the page. `tab` is the ranking it opens on (the route's `?tab=`, a link on the week's challenge).
 */
export function Rankings({ tab: opening }: { tab?: Opening } = {}) {
  const t = useT('rankings');
  const challenge = useT('challenge');
  const common = useT('common');
  const { text, fmt } = useWords();
  const community = useCommunity();
  const [tab, setTab] = useState<Tab>(opening === undefined ? 'global' : openingOf(opening).tab);
  const [period, setPeriod] = useState<Period>((opening === undefined ? undefined : openingOf(opening).period) ?? 'week');
  // A link followed while the page is open (a notice tapped) opens it on what the link names.
  useEffect(() => {
    if (opening === undefined) return;
    const { tab: to, period: during } = openingOf(opening);
    setTab(to);
    if (during !== undefined) setPeriod(during);
  }, [opening]);
  const [lifeId, setLifeId] = useState<string | null>(null);
  /**
   * Each answer, by what it answers: a ranking is shown only for what is being asked now, and one asked before is shown at once while it is asked
   * again (the web keeps the last answer only, and shows it the same way when it is the one asked again).
   */
  const [answers, setAnswers] = useState<Readonly<Record<string, RankingRow[] | null>>>({});
  const [opened, setOpened] = useState<RankingRow | null>(null);
  // The player's friends: the requests waiting on them (the tab says how many), and how many friends they have.
  const friends = useFriendships(community);
  const incoming = friends.list?.incoming ?? [];
  const code = useFriendCode(community);
  const [answering, setAnswering] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [told, setTold] = useState<string | null>(null);
  // A friend made is in the ranking among friends: it is asked again.
  const [made, setMade] = useState(0);
  const asking = askingOf(tab, period, lifeId);
  const nameOf = useCallback((row: { userId: string; nickname: string | null }) => row.nickname ?? t('nameless', { tag: tagOf(row.userId) }), [t]);
  /** `undefined` while the answer is on its way; null when it could not be read. */
  const rows = Object.hasOwn(answers, asking) ? answers[asking] : undefined;

  useEffect(() => {
    if (community === null || tab === 'challenge') return;
    let wanted = true;
    void community.ranking({ period, friends: tab === 'friends', lifeId }).then((found) => {
      if (wanted) setAnswers((known) => ({ ...known, [asking]: found }));
    });
    return () => {
      wanted = false;
    };
  }, [community, tab, period, lifeId, asking, made]);
  const challengeBoard = useChallengeBoard(community, tab === 'challenge');
  const board = challengeBoard.board;
  // Pulled down, the page reads again what it shows: the ranking, or the week's challenge. What is on screen stays until the new answer comes.
  const reading = useRef({ community, tab, period, lifeId, asking });
  reading.current = { community, tab, period, lifeId, asking };
  const reloadBoard = challengeBoard.reload;
  const reloadFriends = friends.reload;
  const refresh = useCallback(async () => {
    const now = reading.current;
    if (now.community === null) return;
    if (now.tab === 'challenge') return reloadBoard();
    await Promise.all([
      now.community.ranking({ period: now.period, friends: now.tab === 'friends', lifeId: now.lifeId }).then((found) => setAnswers((known) => ({ ...known, [now.asking]: found }))),
      now.tab === 'friends' ? reloadFriends() : null,
    ]);
  }, [reloadBoard, reloadFriends]);
  const answerFriend = friends.answer;
  const answer = useCallback((userId: string, yes: boolean) => void answerFriend(userId, yes).then(() => yes && setMade((n) => n + 1)), [answerFriend]);
  // The player's own line past the ranking's fifty, pinned at the foot of the page rather than listed after them.
  const apart = tab === 'challenge' || !rows ? null : apartOf(rows);
  /** The starting life and the day under a line's name. The day is held whole ("12 сент. 2026 г." never leaves its "г." alone on the next line). */
  const subOf = useCallback((row: RankingRow) => `${text.lives[row.lifeId]?.name ?? row.lifeId} · ${fmt.day(row.finishedAt).replace(/ /g, ' ')}`, [text, fmt]);
  // The lines on screen, made again only when the answer or the words change: a line's datum is all it shows.
  const lines = useMemo<Line[]>(() => {
    if (tab === 'challenge') {
      if (!board) return [];
      const top = topTenth(board.entrants);
      return board.rows.map((entry, i) => ({
        kind: 'entry',
        key: `entry-${entry.userId}`,
        first: i === 0,
        place: entry.place,
        name: entry.nickname ?? challenge('nameless'),
        day: fmt.day(entry.finishedAt),
        score: fmt.number(entry.score),
        top: entry.place <= top,
        mine: entry.mine,
      }));
    }
    const ranking: Line[] = (rows ?? [])
      .filter((row) => row !== apart)
      .map((row, i) => ({
        kind: 'rank',
        key: `rank-${row.userId}`,
        first: i === 0,
        userId: row.userId,
        place: row.place,
        lifeId: row.lifeId,
        name: nameOf(row),
        sub: subOf(row),
        score: fmt.number(row.score),
        mine: row.mine,
      }));
    return ranking;
  }, [tab, board, rows, apart, nameOf, subOf, fmt, challenge]);
  const ranked = lines.filter((line) => line.kind === 'rank' || line.kind === 'entry').length;
  // The line pressed, among the lines on screen: read when it is pressed, so the press stays the same function and no line is drawn again for it.
  const shown = useRef(rows);
  shown.current = rows;
  const openLine = useCallback((userId: string) => setOpened(shown.current?.find((row) => row.userId === userId) ?? null), []);
  const lifeOptions = useMemo(
    () => [{ value: null, label: t('anyLife'), icon: 'icon.trophy' }, ...lives.map((life) => ({ value: life.id, label: text.lives[life.id]?.name ?? life.id, face: portraitArt(life.id, 22) }))],
    [t, text],
  );
  const tabs = TABS.map((id) => ({ id, label: id === 'friends' && incoming.length > 0 ? t('friendsWaiting', { count: incoming.length }) : t(id) }));
  const periods = PERIODS.map((value) => ({ value, label: t(value === 'week' ? 'thisWeek' : 'all') }));
  // Among friends, a player with one friend or none (once their friends are read) is asked to add some.
  const few = tab === 'friends' && friends.list != null && friends.list.friends.length < FEW_FRIENDS;

  const head = (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackLink />
        <View accessibilityRole="header" style={{ flexShrink: 1 }}>
          <PixelText size={24} tone="gold-500">{t('title')}</PixelText>
        </View>
      </View>

      {community === null ? (
        <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], padding: 12 }}>
          <ReadText size={14} tone="ink-200">{t('needAccount')}</ReadText>
        </Framed>
      ) : (
        <>
          <View>
            {/* The tabs run to the edges of the screen, their own gutter inside them (the web's `-mx-3`). */}
            <View style={{ marginHorizontal: -12 }}>
              <Tabs<Tab> label={t('kinds')} tabs={tabs} value={tab} onChange={setTab} />
            </View>
            {/* The web's panel of the tab (`role="tabpanel"`, `pt-1`): its head here, its lines the rows of the page's list under it. */}
            <View style={{ paddingTop: 4, gap: 8 }}>
              {tab === 'challenge' ? (
                <ChallengeBoard board={board} />
              ) : (
                <>
                  {tab === 'friends' && incoming.length > 0 ? <RequestsLine count={incoming.length} onOpen={() => setAnswering(true)} /> : null}
                  <Segmented<Period> label={t('period')} value={period} onChange={setPeriod} options={periods} />
                  <ReadText size={12} tone="ink-300">{t(period === 'week' ? 'hintWeek' : 'hint')}</ReadText>
                  <Picker<string | null> label={t('life')} value={lifeId} onChange={setLifeId} closeLabel={common('close')} options={lifeOptions} />
                  {rows === undefined ? <Loading>{common('loading')}</Loading> : null}
                  {rows === null ? <Notice role="status">{t('unreachable')}</Notice> : null}
                  {/* Among few friends, the way to add more says what an empty ranking would. */}
                  {rows?.length === 0 && !few ? (
                    <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], padding: 12 }}>
                      <ReadText size={14} tone="ink-200">{t('empty')}</ReadText>
                    </Framed>
                  ) : null}
                </>
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );

  // Under the ranking among few friends: what it is for, and the way to add some (shown once the player's code is read).
  const foot = few ? (
    <View style={{ gap: 8, paddingTop: 16, alignItems: 'center' }}>
      <ReadText size={14} tone="ink-200" lineHeight={14 * SNUG} style={{ textAlign: 'center' }}>{t('fewFriends')}</ReadText>
      {code !== null ? (
        <Button variant="primary" wide onPress={() => setInviting(true)}>
          {t('addFriends')}
        </Button>
      ) : null}
    </View>
  ) : undefined;

  const item = (line: Line): ReactElement => (
    // 8 under the head (the panel's `gap-2`), 6 between lines (the list's `gap-1.5`).
    <View style={{ paddingTop: line.first ? 8 : 6 }}>
      {line.kind === 'rank' ? (
        <RankLine userId={line.userId} place={line.place} lifeId={line.lifeId} name={line.name} sub={line.sub} score={line.score} mine={line.mine} onOpen={openLine} />
      ) : (
        <ChallengeEntry place={line.place} name={line.name} day={line.day} score={line.score} top={line.top} mine={line.mine} />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <PerfDrawn name={lines.length > 0 ? 'rankings: lines' : 'rankings'} />
      <ListScreen
        width={WIDE_COLUMN}
        head={head}
        foot={foot}
        data={lines}
        keyOf={keyOf}
        item={item}
        // Always a list, named by its ranking once it has lines: a list that came and went would make the page another box each time on the web's
        // renderer (react-native-web draws a list as a `ul`), which the tests draw on, and every box of its head and foot anew with it.
        role="list"
        label={ranked > 0 ? (tab === 'challenge' ? challenge('rankingTitle') : t(tab)) : undefined}
        contentStyle={{ paddingBottom: 40 }}
        // Pulled down, it reads the ranking on screen again: only where there is a cloud to ask.
        onRefresh={community === null ? undefined : refresh}
      />
      {apart ? (
        <BottomBar>
          <View role="list" aria-label={t('yourPlace')}>
            <RankLine userId={apart.userId} place={apart.place} lifeId={apart.lifeId} name={t('you')} sub={subOf(apart)} score={fmt.number(apart.score)} mine onOpen={openLine} />
          </View>
        </BottomBar>
      ) : null}
      {community !== null ? (
        <>
          <RunSheet community={community} row={opened} nameOf={nameOf} onClose={() => setOpened(null)} />
          <FriendRequests open={answering && incoming.length > 0} incoming={incoming} busy={friends.busy} onAnswer={answer} onClose={() => setAnswering(false)} />
          {inviting && code !== null ? <FriendInvite code={code} onClose={() => setInviting(false)} onTold={setTold} /> : null}
        </>
      ) : null}
      <Toast message={told} onDone={() => setTold(null)} />
    </View>
  );
}
