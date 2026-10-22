import { cityIcon, lives, portraitArt } from '@ratrace/content';
import { ratLookOf } from '@ratrace/core/game/avatar';
import { escapeAge } from '@ratrace/core/game/present';
import type { Community, Friend, Friends, RankedLifeDetail, RankingRow } from '@ratrace/online/types';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { copy } from '../../ui/copy';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Bare, Button, Figure, KeyFigure, Notice, Panel, PanelPart, pressDown, reach, Row, usePress } from '../../ui/kit';
import { Loading } from '../../ui/Loading';
import { Sheet, Tabs, Toast } from '../../ui/overlay';
import { ListScreen } from '../../ui/Page';
import { PerfDrawn } from '../../ui/perf';
import { Picker } from '../../ui/Picker';
import { RatAvatar } from '../../ui/RatAvatar';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { TextField } from '../../ui/TextField';
import { COLORS, EXTRA, type ColorToken } from '../../ui/theme';
import { useAccount, useCommunity, useWords } from '../context';
import { useT } from '../words';
import { BackLink } from './BackLink';
import { ChallengeBoard, ChallengeEntry, topTenth, useChallengeBoard } from './Challenge';
import { LifeFace } from './LifeFace';
import { Medal } from './Medal';
import { WorthGraph } from './WorthGraph';

export type Kind = 'all' | 'week' | 'friends' | 'challenge';
const KINDS: readonly Kind[] = ['all', 'week', 'friends', 'challenge'];
/** How a name is written. The database checks it again, and what it says. */
export const NAME = /^[A-Za-z0-9_]{3,16}$/;

/** What a player with no name is told apart by: the start of their id. */
const tagOf = (userId: string) => userId.slice(0, 4).toUpperCase();

/** The line of the friend code (the web's `text-[12px]` paragraph round a `pixel text-[15px]` code): the code's own line, in the pixel face. */
const CODE_LINE = 15 * 1.1;
/**
 * The code's touch box, the 44 a thumb needs: 8 up, to the name's line above it (its button takes the touches there), and 20 down, through the
 * panel's foot (12) and 8 into the page's gap of 16 under the panel, short of the tabs. A phone selects nothing in a line of text (the web's
 * `select-all`): the code copies itself when it is pressed.
 */
export const CODE_REACH = reach(CODE_LINE, { above: 8, below: 12 + 16 + 8 });

/** The player's own name, and the code a friend follows them with. Nothing, where theirs could not be read. */
function You({ community, onRenamed, onTold, naming }: { community: Community; onRenamed(): void; onTold(message: string): void; naming: boolean }) {
  const t = useT('rankings');
  const player = useT('player');
  const [me, setMe] = useState<{ nickname: string | null; friendCode: string } | null>(null);
  const [editing, setEditing] = useState(naming);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<'invalid' | 'taken' | 'refused' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const { state: account } = useAccount();
  const userId = account.kind === 'guest' || account.kind === 'member' ? account.userId : '';
  // A scene opens the form from the start (`naming`): it starts from the name, once the name is read, as a press of "Change it" would.
  const startsNaming = useRef(naming);

  useEffect(() => {
    let wanted = true;
    void community.me().then((mine) => {
      if (!wanted) return;
      setMe(mine);
      if (startsNaming.current) setName(mine?.nickname ?? '');
      startsNaming.current = false;
    });
    return () => {
      wanted = false;
    };
  }, [community]);
  const copyCode = usePress({ onPress: () => void (me ? copy(me.friendCode, () => onTold(player('copied'))) : undefined) });

  if (me === null) return null;

  const open = () => {
    setName(me.nickname ?? '');
    setProblem(null);
    setEditing(true);
  };
  const save = async () => {
    const asked = name.trim();
    // How it is written is checked here, before anyone is asked. What it says is the database's to judge.
    if (!NAME.test(asked)) return setProblem('invalid');
    setBusy(true);
    const answer = await community.rename(asked);
    setBusy(false);
    if (answer !== 'ok') return setProblem(answer);
    setMe({ ...me, nickname: asked });
    setEditing(false);
    onRenamed();
  };

  return (
    <View role="region" aria-label={t('you')}>
      <Panel title={t('you')} label={t('you')}>
        <View style={{ gap: 8 }}>
          {/* The name as the rankings show it, the one they give until another is chosen, and the way to change it. */}
          {editing ? null : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <PixelText size={18} numberOfLines={1} style={{ flexShrink: 1, minWidth: 0 }}>{me.nickname ?? t('nameless', { tag: tagOf(userId) })}</PixelText>
              <Button variant="quiet" size={14} onPress={open}>
                {t('changeName')}
              </Button>
            </View>
          )}
          {editing ? (
            <View style={{ gap: 8 }}>
              <View style={{ gap: 4 }}>
                <ReadText size={13} tone="ink-200">{t('name')}</ReadText>
                <TextField label={t('name')} value={name} onChangeText={setName} maxLength={16} returnKeyType="done" onSubmitEditing={() => void save()} />
              </View>
              {problem ? (
                <Notice role="alert" size={13}>
                  {t(problem)}
                </Notice>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button variant="primary" cell disabled={busy} onPress={() => void save()}>
                  {t('save')}
                </Button>
                <Button variant="quiet" onPress={() => setEditing(false)}>
                  {t('cancel')}
                </Button>
              </View>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <ReadText size={12} tone="ink-300">{`${t('code')}: `}</ReadText>
            <Pressable accessibilityRole="button" accessibilityLabel={`${t('code')}: ${me.friendCode}`} accessibilityHint={player('copy')} onPress={copyCode} style={({ pressed }) => [CODE_REACH.style, pressDown(pressed)]}>
              <PixelText size={15} tone="gold-500" lineHeight={CODE_LINE} style={{ letterSpacing: 15 * 0.12 }}>{me.friendCode}</PixelText>
            </Pressable>
          </View>
        </View>
      </Panel>
    </View>
  );
}

/** What asking for a friend by their code came to, as the panel says it. */
const ASKED = {
  sent: 'requestSent',
  accepted: 'nowFriends',
  pending: 'alreadyAsked',
  friends: 'alreadyFriends',
  unknown: 'followUnknown',
  self: 'followSelf',
  full: 'followFull',
  failed: 'followFailed',
} as const;

/** What the friends' panel says of the last thing done in it: a word of the rankings', and whether it went wrong. */
type Said = { key: (typeof ASKED)[keyof typeof ASKED] | 'answerGone'; bad: boolean };

/** How another player stands to the player, in the friends' panel: a friend, a request waiting on the player, or one the player sent. */
type Bond = 'friend' | 'incoming' | 'outgoing';

/** The line of a friend in the panel (the web's `bevel flex min-h-11 w-full items-center gap-2 bg-night-700 px-2 py-1.5`). */
const LINE = { backgroundColor: COLORS['night-700'], minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 } as const;

/**
 * Another player in the friends' panel: their rat and their name, and what can be done there. A request waiting on the player is answered on its
 * line (`busy` while an answer is on its way: only such a line has it, so an answer given draws no friend's line again); a friend, or a request the
 * player sent, opens its sheet. Drawn again only when one of these changes.
 */
const FriendLine = memo(function FriendLine({ userId, name, avatar, bond, busy, onAnswer, onOpen }: { userId: string; name: string; avatar: string | null; bond: Bond; busy: boolean; onAnswer(userId: string, yes: boolean): void; onOpen(userId: string, waiting: boolean): void }) {
  const t = useT('rankings');
  const look = useMemo(() => ratLookOf(avatar, userId), [avatar, userId]);
  const press = usePress({ onPress: () => onOpen(userId, bond === 'outgoing') });
  if (bond === 'incoming') {
    return (
      <Framed kind="bevel" style={LINE}>
        <RatAvatar look={look} size="sm" />
        <ReadText size={14} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{name}</ReadText>
        <Button variant="primary" size={13} disabled={busy} onPress={() => onAnswer(userId, true)}>
          {t('accept')}
        </Button>
        <Button variant="quiet" size={13} disabled={busy} onPress={() => onAnswer(userId, false)}>
          {t('decline')}
        </Button>
      </Framed>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={bond === 'outgoing' ? `${name} ${t('pending')}` : name} onPress={press} style={({ pressed }) => pressDown(pressed)}>
      <Framed kind="bevel" style={LINE}>
        <RatAvatar look={look} size="sm" />
        <ReadText size={14} tone={bond === 'outgoing' ? 'ink-200' : 'cream'} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{name}</ReadText>
        {bond === 'outgoing' ? (
          <ReadText size={12} tone="ink-300" style={{ flexShrink: 0 }}>{t('pending')}</ReadText>
        ) : (
          <View aria-hidden importantForAccessibility="no-hide-descendants">
            <PixelText size={14} tone="ink-300">{'›'}</PixelText>
          </View>
        )}
      </Framed>
    </Pressable>
  );
});

/** The heading of a group of the panel (the web's `pixel text-[12px] uppercase tracking-[0.1em]`). */
function GroupHeading({ tone, children }: { tone: ColorToken; children: string }) {
  return (
    <View accessibilityRole="header">
      <PixelText size={12} tone={tone} style={{ letterSpacing: 12 * 0.1, textTransform: 'uppercase' }}>{children}</PixelText>
    </View>
  );
}

/**
 * The player's friends, both ways, as the friends' panel holds them while its tab is open (the web's `Friendships`, mounted with the tab): the list
 * (`undefined` until it is read, null where it could not be), what the panel says of the last thing done, whether an answer is on its way, the friend
 * whose sheet is open, and what can be done: ask by a code, answer a request, open a friend, end a friendship. Each opening of the tab reads the
 * friends anew, and says nothing of the last time, as the web's panel drawn anew does. Requests answered and sent are the server's. `onChanged` is
 * told of every change of the friends, for the ranking among them to be read again.
 */
function useFriendships(community: Community | null, active: boolean, onChanged: () => void) {
  const [state, setState] = useState<{ active: boolean; list: Friends | null | undefined; said: Said | null; open: { friend: Friend; waiting: boolean } | null }>({ active, list: undefined, said: null, open: null });
  let now = state;
  if (active !== state.active) {
    now = active ? { active, list: undefined, said: null, open: null } : { ...state, active };
    setState(now);
  }
  const { list, said, open } = now;
  const [busy, setBusy] = useState(false);
  const [turn, setTurn] = useState(0);
  const set = useCallback((change: Partial<typeof state>) => setState((was) => ({ ...was, ...change })), []);

  useEffect(() => {
    if (!active || community === null) return;
    let wanted = true;
    void community.friends().then((found) => {
      if (wanted) setState((was) => ({ ...was, list: found }));
    });
    return () => {
      wanted = false;
    };
  }, [community, active, turn]);

  // The latest of what a press needs, read by callbacks that stay the same: a line is drawn again for what it shows, never for a new callback.
  const latest = useRef({ list, community, onChanged });
  latest.current = { list, community, onChanged };
  const changed = useCallback(() => {
    setTurn((n) => n + 1);
    latest.current.onChanged();
  }, []);
  /** Asks the player a code is theirs; true where the code is done with (asked, or friends already), for the field to be emptied. */
  const ask = useCallback(
    async (code: string): Promise<boolean> => {
      const asking = latest.current.community;
      const asked = code.trim();
      if (asked === '' || asking === null) return false;
      setBusy(true);
      const answer = await asking.befriend(asked);
      setBusy(false);
      const good = answer === 'sent' || answer === 'accepted' || answer === 'pending' || answer === 'friends';
      set({ said: { key: ASKED[answer], bad: !good } });
      if (good) changed();
      return good;
    },
    [set, changed],
  );
  const answer = useCallback(
    async (userId: string, yes: boolean) => {
      const asking = latest.current.community;
      if (asking === null) return;
      setBusy(true);
      const answered = await asking.answerFriend(userId, yes);
      setBusy(false);
      if (answered === 'accepted') set({ said: { key: 'nowFriends', bad: false } });
      else if (answered === 'gone') set({ said: { key: 'answerGone', bad: true } });
      else if (answered === 'full' || answered === 'failed') set({ said: { key: answered === 'full' ? 'followFull' : 'followFailed', bad: true } });
      else set({ said: null });
      changed();
    },
    [set, changed],
  );
  const opening = useCallback(
    (userId: string, waiting: boolean) => {
      const known = latest.current.list;
      const friend = (waiting ? known?.outgoing : known?.friends)?.find((one) => one.userId === userId);
      if (friend) set({ open: { friend, waiting } });
    },
    [set],
  );
  const close = useCallback(() => set({ open: null }), [set]);
  const end = async (friend: Friend) => {
    const asking = latest.current.community;
    if (asking === null) return;
    setBusy(true);
    const done = await asking.unfriend(friend.userId);
    setBusy(false);
    set(done ? { open: null } : { open: null, said: { key: 'followFailed', bad: true } });
    changed();
  };
  return { list, said, open, busy, ask, answer, opening, close, end };
}

/**
 * The foot of the friends' panel: a friend code to ask with, and what the panel says of the last thing done. The code is its own while it is typed
 * (the page is not drawn again for each letter), and emptied once it is done with.
 */
function FriendForm({ busy, said, onAsk }: { busy: boolean; said: Said | null; onAsk(code: string): Promise<boolean> }) {
  const t = useT('rankings');
  const [code, setCode] = useState('');
  const ask = async () => {
    if (await onAsk(code)) setCode('');
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <ReadText size={13} tone="ink-200">{t('friendCode')}</ReadText>
          <TextField label={t('friendCode')} kind="code" value={code} onChangeText={setCode} maxLength={12} returnKeyType="send" onSubmitEditing={() => void ask()} />
        </View>
        <Button variant="primary" disabled={busy} onPress={() => void ask()}>
          {t('follow')}
        </Button>
      </View>
      {said ? (
        <Notice role={said.bad ? 'alert' : 'status'} bg={said.bad ? 'wine-900' : 'teal-800'} size={13}>
          {t(said.key)}
        </Notice>
      ) : null}
    </View>
  );
}

/**
 * The friends' panel's lines, each a row of the page's list (the panel cut across them, `PanelPart`), in the web's order: the requests waiting on the
 * player under their heading, "no friends yet" where there are none, the friends, the requests the player sent under theirs. Nothing while the
 * friends are on their way, or could not be read (the ranking among friends above already shows them): the panel is then its foot alone. `pad` is the
 * room over a line inside the panel: the panel's `gap-2` between its groups, a group's `gap-1.5` between its lines, none over the first.
 */
function friendLines(list: Friends | null | undefined, nameOf: (friend: Friend) => string, busy: boolean, words: { requests: string; nobody: string; sent: string }): FriendRow[] {
  if (!list) return [];
  const rows: Unplaced[] = [];
  const group = (pad: number) => (rows.length === 0 ? 0 : pad);
  const line = (friend: Friend, bond: Bond, pad: number) =>
    rows.push({ kind: 'friend', key: `${bond}-${friend.userId}`, pad: group(pad), userId: friend.userId, name: nameOf(friend), avatar: friend.avatar, bond, busy: bond === 'incoming' && busy });
  if (list.incoming.length > 0) {
    rows.push({ kind: 'group', key: 'group-requests', pad: group(8), title: words.requests, tone: 'gold-200' });
    for (const friend of list.incoming) line(friend, 'incoming', 6);
  }
  if (list.friends.length === 0 && list.incoming.length === 0) rows.push({ kind: 'nobody', key: 'nobody', pad: group(8), text: words.nobody });
  list.friends.forEach((friend, i) => line(friend, 'friend', i === 0 ? 8 : 6));
  if (list.outgoing.length > 0) {
    rows.push({ kind: 'group', key: 'group-sent', pad: group(8), title: words.sent, tone: 'ink-300' });
    for (const friend of list.outgoing) line(friend, 'outgoing', 6);
  }
  return rows.map((row, i) => ({ ...row, first: i === 0, part: i === 0 ? 'top' : 'middle' }) as FriendRow);
}

/** A line of the friends' panel before it is placed in the panel: all of it but whether it is its first, and which part of the panel it is. */
type Unplaced = FriendRow extends infer R ? (R extends FriendRow ? Omit<R, 'first' | 'part'> : never) : never;

/** A line of the friends' panel, as a row of the page's list: a group's heading, "no friends yet", or another player. */
type FriendRow = { key: string; first: boolean; part: 'top' | 'middle'; pad: number } & (
  | { kind: 'group'; title: string; tone: ColorToken }
  | { kind: 'nobody'; text: string }
  | { kind: 'friend'; userId: string; name: string; avatar: string | null; bond: Bond; busy: boolean }
);

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
          <PixelText size={17} style={{ width: 32, flexShrink: 0, textAlign: 'right', color: placeColour(place) }}>{String(place)}</PixelText>
          <Bare style={{ width: 32, height: 32 }}>
            <LifeFace lifeId={lifeId} />
          </Bare>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ReadText numberOfLines={1}>{name}</ReadText>
            <ReadText size={12} tone="ink-300" numberOfLines={1}>{sub}</ReadText>
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
    <Sheet open={row !== null} onClose={onClose} title={shown ? nameOf(shown) : ''} closeLabel={common('close')}>
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

/**
 * A line of the page's list, all that it shows: a line of a ranking, a player's best attempt at the week's challenge, or a line of the friends' panel
 * under the ranking among friends (`FriendRow`).
 */
type Line =
  | { kind: 'rank'; key: string; first: boolean; userId: string; place: number; lifeId: string; name: string; sub: string; score: string; mine: boolean }
  | { kind: 'entry'; key: string; first: boolean; place: number; name: string; day: string; score: string; top: boolean; mine: boolean }
  | FriendRow;

/** A line's name in the list. */
const keyOf = (line: Line): string => line.key;

/** What is asked of the cloud for a ranking: its kind and its starting life, the name its answer is known by. */
const askingOf = (kind: Kind, lifeId: string | null): string => `${kind} ${lifeId ?? ''}`;

/** The room between the page's blocks (the web's `gap-4`): over the friends' panel, under the ranking. */
const PAGE_GAP = 16;

/**
 * The rankings: the best ranked life of each player, of all time, of this week, or among the player's friends, of any starting life or of one; and the
 * ranking of the week's challenge. Only lives the server played are in them, so every line can be set beside every other. Everything here is asked of
 * the cloud and shown as it answers.
 *
 * The page is one list that draws only the lines near the screen (a ranking is fifty lines and the player's own; a player may have two hundred friends
 * and fifty requests each way): its head (the title, the player's name, the tabs, what the ranking came to) is the list's header; its rows are the
 * ranking's lines, then, among friends, the friends' panel's lines, the panel cut across them (`PanelPart`); the panel's foot, the friend code to ask
 * with, is the list's footer.
 * `tab` is the ranking it opens on (the route's `?tab=`: a friend request's notice opens it on the friends, a link on the week's challenge); `naming`
 * opens the form of the player's name from the start (a scene's initial state; the player opens it by a tap).
 */
export function Rankings({ tab, naming = false }: { tab?: Kind; naming?: boolean } = {}) {
  const t = useT('rankings');
  const challenge = useT('challenge');
  const common = useT('common');
  const { text, fmt } = useWords();
  const community = useCommunity();
  const [kind, setKind] = useState<Kind>(tab ?? 'all');
  // A link followed while the page is open (a notice tapped) opens it on what the link names.
  useEffect(() => {
    if (tab !== undefined) setKind(tab);
  }, [tab]);
  const [lifeId, setLifeId] = useState<string | null>(null);
  /**
   * Each answer, by what it answers: a ranking is shown only for what is being asked now, and one asked before is shown at once while it is asked
   * again (the web keeps the last answer only, and shows it the same way when it is the one asked again).
   */
  const [answers, setAnswers] = useState<Readonly<Record<string, RankingRow[] | null>>>({});
  const [turn, setTurn] = useState(0);
  const [opened, setOpened] = useState<RankingRow | null>(null);
  /** What the page tells the player for a moment (the friend code copied), over the page: the web's toast, fixed to the screen. */
  const [told, setTold] = useState<string | null>(null);
  const asking = askingOf(kind, lifeId);
  const nameOf = useCallback((row: { userId: string; nickname: string | null }) => row.nickname ?? t('nameless', { tag: tagOf(row.userId) }), [t]);
  /** `undefined` while the answer is on its way; null when it could not be read. */
  const rows = Object.hasOwn(answers, asking) ? answers[asking] : undefined;

  useEffect(() => {
    if (community === null || kind === 'challenge') return;
    let wanted = true;
    void community.ranking({ period: kind === 'week' ? 'week' : 'all', friends: kind === 'friends', lifeId }).then((found) => {
      if (wanted) setAnswers((known) => ({ ...known, [asking]: found }));
    });
    return () => {
      wanted = false;
    };
  }, [community, kind, lifeId, asking, turn]);
  // Asked again after a change of name or of friends: the ranking on screen stays until the new one comes, and every other one known is let go, since
  // it may show the old name or the old friends (the web knows no other: it shows "Loading…" there).
  const askingNow = useRef(asking);
  askingNow.current = asking;
  const again = useCallback(() => {
    setAnswers((known) => (Object.hasOwn(known, askingNow.current) ? { [askingNow.current]: known[askingNow.current] } : {}));
    setTurn((n) => n + 1);
  }, []);

  const board = useChallengeBoard(community, kind === 'challenge');
  const friends = useFriendships(community, kind === 'friends', again);
  const friendRows = useMemo(
    () => friendLines(friends.list, (friend) => nameOf(friend), friends.busy, { requests: t('requests'), nobody: t('nobody'), sent: t('sent') }),
    [friends.list, friends.busy, nameOf, t],
  );
  // The lines on screen, made again only when the answer or the words change: a line's datum is all it shows.
  const lines = useMemo<Line[]>(() => {
    if (kind === 'challenge') {
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
    const ranking: Line[] = (rows ?? []).map((row, i) => ({
      kind: 'rank',
      key: `rank-${row.userId}`,
      first: i === 0,
      userId: row.userId,
      place: row.place,
      lifeId: row.lifeId,
      name: nameOf(row),
      sub: `${text.lives[row.lifeId]?.name ?? row.lifeId} · ${fmt.day(row.finishedAt)}`,
      score: fmt.number(row.score),
      mine: row.mine,
    }));
    return kind === 'friends' && community !== null ? [...ranking, ...friendRows] : ranking;
  }, [kind, board, rows, nameOf, text, fmt, challenge, friendRows, community]);
  const ranked = lines.filter((line) => line.kind === 'rank' || line.kind === 'entry').length;
  // The line pressed, among the lines on screen: read when it is pressed, so the press stays the same function and no line is drawn again for it.
  const shown = useRef(rows);
  shown.current = rows;
  const openLine = useCallback((userId: string) => setOpened(shown.current?.find((row) => row.userId === userId) ?? null), []);
  const lifeOptions = useMemo(
    () => [{ value: null, label: t('anyLife'), icon: 'icon.trophy' }, ...lives.map((life) => ({ value: life.id, label: text.lives[life.id]?.name ?? life.id, face: portraitArt(life.id, 22) }))],
    [t, text],
  );

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
          <You community={community} onRenamed={again} onTold={setTold} naming={naming} />
          <View>
            {/* The tabs run to the edges of the screen, their own gutter inside them (the web's `-mx-3`). */}
            <View style={{ marginHorizontal: -12 }}>
              <Tabs<Kind> label={t('kinds')} tabs={KINDS.map((id) => ({ id, label: t(id) }))} value={kind} onChange={setKind} />
            </View>
            {/* The web's panel of the tab (`role="tabpanel"`, `pt-1`): its head here, its lines the rows of the page's list under it. */}
            <View style={{ paddingTop: 4, gap: 8 }}>
              {kind === 'challenge' ? (
                <ChallengeBoard board={board} />
              ) : (
                <>
                  <ReadText size={12} tone="ink-300">{t('hint')}</ReadText>
                  <Picker<string | null> label={t('life')} value={lifeId} onChange={setLifeId} closeLabel={common('close')} options={lifeOptions} />
                  {rows === undefined ? <Loading>{common('loading')}</Loading> : null}
                  {rows === null ? <Notice role="status">{t('unreachable')}</Notice> : null}
                  {rows?.length === 0 ? (
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

  const item = (line: Line): ReactElement => {
    if (line.kind === 'rank' || line.kind === 'entry') {
      return (
        // 8 under the head (the panel's `gap-2`), 6 between lines (the list's `gap-1.5`).
        <View style={{ paddingTop: line.first ? 8 : 6 }}>
          {line.kind === 'rank' ? (
            <RankLine userId={line.userId} place={line.place} lifeId={line.lifeId} name={line.name} sub={line.sub} score={line.score} mine={line.mine} onOpen={openLine} />
          ) : (
            <ChallengeEntry place={line.place} name={line.name} day={line.day} score={line.score} top={line.top} mine={line.mine} />
          )}
        </View>
      );
    }
    // A line of the friends' panel: its part of the panel, the first with the panel's title, and the page's gap over the panel.
    return (
      <View style={line.first ? { paddingTop: PAGE_GAP } : null}>
        <PanelPart part={line.part} title={line.first ? t('following') : undefined} style={{ paddingTop: line.first ? undefined : line.pad }}>
          {line.kind === 'group' ? (
            <GroupHeading tone={line.tone}>{line.title}</GroupHeading>
          ) : line.kind === 'nobody' ? (
            <ReadText size={13} tone="ink-200">{line.text}</ReadText>
          ) : (
            <FriendLine userId={line.userId} name={line.name} avatar={line.avatar} bond={line.bond} busy={line.busy} onAnswer={friends.answer} onOpen={friends.opening} />
          )}
        </PanelPart>
      </View>
    );
  };

  // The friends' panel's foot, under its lines (or the whole panel, where it has none): the code to ask with, and what the panel said last.
  const panelFoot =
    community !== null && kind === 'friends' ? (
      <View style={friendRows.length === 0 ? { paddingTop: PAGE_GAP } : null}>
        <PanelPart part={friendRows.length === 0 ? 'whole' : 'bottom'} title={friendRows.length === 0 ? t('following') : undefined} style={friendRows.length === 0 ? undefined : { paddingTop: 8 }}>
          <FriendForm busy={friends.busy} said={friends.said} onAsk={friends.ask} />
        </PanelPart>
      </View>
    ) : undefined;
  const friend = friends.open;

  return (
    <View style={{ flex: 1 }}>
      <PerfDrawn name="rankings" />
      <ListScreen
        head={head}
        foot={panelFoot}
        data={lines}
        keyOf={keyOf}
        item={item}
        // Always a list, named by its ranking once it has lines: a list that came and went would make the page another box each time on the web's
        // renderer (react-native-web draws a list as a `ul`), which the tests draw on, and every box of its head and foot anew with it.
        role="list"
        label={ranked > 0 ? (kind === 'challenge' ? challenge('rankingTitle') : t(kind)) : undefined}
        contentStyle={{ paddingBottom: 40 }}
      />
      {community !== null ? <RunSheet community={community} row={opened} nameOf={nameOf} onClose={() => setOpened(null)} /> : null}
      {/* A friend, or a request the player sent: their rat, and the one thing to do, which ends it for both. */}
      <Sheet open={friend !== null} onClose={friends.close} title={friend ? nameOf(friend.friend) : ''} closeLabel={common('close')}>
        {friend ? (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <RatAvatar look={ratLookOf(friend.friend.avatar, friend.friend.userId)} size="lg" />
            {friend.waiting ? (
              <ReadText size={13} tone="ink-300">{t('pending')}</ReadText>
            ) : (
              <ReadText size={13} tone="ink-300" lineHeight={13 * SNUG} style={{ textAlign: 'center' }}>{t('unfriendAbout')}</ReadText>
            )}
            <Button variant="danger" wide disabled={friends.busy} onPress={() => void friends.end(friend.friend)}>
              {t(friend.waiting ? 'cancelRequest' : 'unfriend')}
            </Button>
          </View>
        ) : null}
      </Sheet>
      <Toast message={told} onDone={() => setTold(null)} />
    </View>
  );
}
