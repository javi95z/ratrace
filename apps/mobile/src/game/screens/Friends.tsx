import { ratLookOf } from '@ratrace/core/game/avatar';
import type { Community, Friend, Friends, RankingRow } from '@ratrace/online/types';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { copy } from '../../ui/copy';
import { Framed } from '../../ui/Frame';
import { LEVEL_3 } from '../../ui/headingLevel';
import { Button, Notice, Panel, pressDown, usePress } from '../../ui/kit';
import { Loading } from '../../ui/Loading';
import { Sheet } from '../../ui/overlay';
import { QrCode } from '../../ui/QrCode';
import { RatAvatar } from '../../ui/RatAvatar';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { TextField } from '../../ui/TextField';
import { COLORS, type ColorToken } from '../../ui/theme';
import { useCommunity, useSettings, useTrack, useWords } from '../context';
import { friendLink } from '../roomLink';
import { canShareLink, shareLink } from '../sharing';
import { useT } from '../words';
import { LifeFace } from './LifeFace';

/*
 * The player's friends, beside the ways to play with them (the games with others' page, `Room.tsx`): the player's own friend code (its QR code, its
 * link to share), the requests waiting on them, their friends with the game each is in now, and the requests they sent; a friend opened in a sheet of
 * their own, from which they are joined or asked into a game; and the friends asked into a lobby (`InviteFriends`). Everything here is asked of the
 * cloud and shown as it answers.
 */

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

/** How another player stands to the player: a friend, a request waiting on the player, or one the player sent. */
type Bond = 'friend' | 'incoming' | 'outgoing';

/** What a player with no name is told apart by: the start of their id. */
const tagOf = (userId: string) => userId.slice(0, 4).toUpperCase();

/** A player's name as the friends show it: theirs, or the rat their id makes of them. */
export function useFriendName(): (friend: { userId: string; nickname: string | null }) => string {
  const t = useT('rankings');
  return useCallback((friend) => friend.nickname ?? t('nameless', { tag: tagOf(friend.userId) }), [t]);
}

/**
 * The player's friends, both ways: the list (`undefined` until it is read, null where it could not be), what the panel says of the last thing done,
 * whether an answer is on its way, and what can be done: ask by a code, answer a request, end a friendship, read them again. `turn` reads them again
 * when it moves (a request answered from a notice's button elsewhere on the page).
 */
export function useFriendships(community: Community | null, turn = 0) {
  const [list, setList] = useState<Friends | null | undefined>(undefined);
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState(0);

  useEffect(() => {
    if (community === null) return;
    let wanted = true;
    void community.friends().then((found) => {
      if (wanted) setList(found);
    });
    return () => {
      wanted = false;
    };
  }, [community, turn, mine]);

  const latest = useRef(community);
  latest.current = community;
  const changed = useCallback(() => setMine((n) => n + 1), []);
  /** Asks the player a code is theirs; true where the code is done with (asked, or friends already), for the field to be emptied. */
  const ask = useCallback(
    async (code: string): Promise<boolean> => {
      const asking = latest.current;
      const asked = code.trim();
      if (asked === '' || asking === null) return false;
      setBusy(true);
      const answer = await asking.befriend(asked);
      setBusy(false);
      const good = answer === 'sent' || answer === 'accepted' || answer === 'pending' || answer === 'friends';
      setSaid({ key: ASKED[answer], bad: !good });
      if (good) changed();
      return good;
    },
    [changed],
  );
  const answer = useCallback(
    async (userId: string, yes: boolean) => {
      const asking = latest.current;
      if (asking === null) return;
      setBusy(true);
      const answered = await asking.answerFriend(userId, yes);
      setBusy(false);
      if (answered === 'accepted') setSaid({ key: 'nowFriends', bad: false });
      else if (answered === 'gone') setSaid({ key: 'answerGone', bad: true });
      else if (answered === 'full' || answered === 'failed') setSaid({ key: answered === 'full' ? 'followFull' : 'followFailed', bad: true });
      else setSaid(null);
      changed();
    },
    [changed],
  );
  /** Ends a friendship, for both, or takes back a request; true once it is done. */
  const end = useCallback(
    async (userId: string): Promise<boolean> => {
      const asking = latest.current;
      if (asking === null) return false;
      setBusy(true);
      const done = await asking.unfriend(userId);
      setBusy(false);
      if (!done) setSaid({ key: 'followFailed', bad: true });
      changed();
      return done;
    },
    [changed],
  );
  /** Reads the friends again (a page pulled down), the list on screen kept until the new one comes. */
  const reload = useCallback(async () => {
    const asking = latest.current;
    if (asking === null) return;
    setList(await asking.friends());
  }, []);
  return { list, said, busy, ask, answer, end, reload };
}

/** The line of a friend (the web's `bevel flex min-h-11 w-full items-center gap-2 bg-night-700 px-2 py-1.5`). */
const LINE = { backgroundColor: COLORS['night-700'], minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 } as const;

/** Where a friend is now, in a word: in a game waiting for its players, in one under way, or nowhere (null). */
function usePlaying(): (friend: Friend) => { text: string; tone: ColorToken } | null {
  const t = useT('friends');
  return useCallback((friend) => (friend.playing?.status === 'open' ? { text: t('waiting'), tone: 'teal-300' } : friend.playing?.status === 'playing' ? { text: t('playing'), tone: 'gold-200' } : null), [t]);
}

/**
 * Another player in the friends' panel: their rat, their name and, for a friend, the game they are in now. A request waiting on the player is answered
 * on its line (`busy` while an answer is on its way); a friend, or a request the player sent, opens its sheet. Drawn again only when what it shows changes.
 */
const FriendLine = memo(function FriendLine({ friend, name, bond, busy, onAnswer, onOpen }: { friend: Friend; name: string; bond: Bond; busy: boolean; onAnswer(userId: string, yes: boolean): void; onOpen(friend: Friend, bond: Bond): void }) {
  const t = useT('rankings');
  const playingOf = usePlaying();
  const look = useMemo(() => ratLookOf(friend.avatar, friend.userId), [friend.avatar, friend.userId]);
  const press = usePress({ onPress: () => onOpen(friend, bond) });
  if (bond === 'incoming') {
    return (
      <Framed kind="bevel" style={LINE}>
        <RatAvatar look={look} size="sm" />
        <ReadText size={14} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{name}</ReadText>
        <Button variant="primary" size={13} disabled={busy} onPress={() => onAnswer(friend.userId, true)}>
          {t('accept')}
        </Button>
        <Button variant="quiet" size={13} disabled={busy} onPress={() => onAnswer(friend.userId, false)}>
          {t('decline')}
        </Button>
      </Framed>
    );
  }
  const now = bond === 'friend' ? playingOf(friend) : null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[name, bond === 'outgoing' ? t('pending') : now?.text].filter(Boolean).join(', ')} onPress={press} style={({ pressed }) => pressDown(pressed)}>
      <Framed kind="bevel" style={LINE}>
        <RatAvatar look={look} size="sm" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <ReadText size={14} tone={bond === 'outgoing' ? 'ink-200' : 'cream'} numberOfLines={1}>{name}</ReadText>
          {now ? <ReadText size={12} tone={now.tone} numberOfLines={1}>{now.text}</ReadText> : null}
        </View>
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

/** The heading of a group of the panel (the web's `pixel text-[12px] uppercase tracking-[0.1em]`), under the panel's tab (on the web an `<h3>`). */
function GroupHeading({ tone, children }: { tone: ColorToken; children: string }) {
  return (
    <View accessibilityRole="header" {...LEVEL_3}>
      <PixelText size={12} tone={tone} style={{ letterSpacing: 12 * 0.1, textTransform: 'uppercase' }}>{children}</PixelText>
    </View>
  );
}

/**
 * The foot of the friends' panel: a friend code to ask with, and what the panel says of the last thing done. The code is its own while it is typed,
 * and emptied once it is done with. A friend's link (their QR code, `friendLink`) brings it written in (`initial`), for the player to send.
 */
function FriendForm({ busy, said, onAsk, initial = '' }: { busy: boolean; said: Said | null; onAsk(code: string): Promise<boolean>; initial?: string }) {
  const t = useT('rankings');
  const [code, setCode] = useState(initial);
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
 * The player's friend code, pressed: as a QR code another phone's camera reads (the games with others' page with the code ready to send,
 * `friendLink`, which Android opens in the app), as words and a link for the phone's share sheet, or copied.
 */
function FriendInvite({ code, onClose, onTold }: { code: string; onClose(): void; onTold(message: string): void }) {
  const t = useT('rankings');
  const room = useT('room');
  const player = useT('player');
  const common = useT('common');
  const { locale } = useSettings();
  const track = useTrack();
  const { width } = useWindowDimensions();
  const url = friendLink(locale, code);
  const share = async () => {
    try {
      if (await shareLink(t('code'), t('inviteText', { code }), url)) track({ name: 'share', what: 'invite' });
    } catch {
      // The share sheet would not open: the code is on screen, and it can be copied.
    }
  };
  const copied = () => {
    onClose();
    onTold(player('copied'));
  };
  return (
    <Sheet open onClose={onClose} title={t('code')} closeLabel={common('close')}>
      <View style={{ alignItems: 'center', gap: 12, paddingBottom: 4 }}>
        <QrCode value={url} width={Math.min(240, width - 96)} label={t('inviteScan')} />
        <PixelText size={28} tone="gold-500" lineHeight={28} style={{ letterSpacing: 28 * 0.12 }}>{code}</PixelText>
        <ReadText size={13} tone="ink-300" lineHeight={13 * SNUG} style={{ textAlign: 'center' }}>{t('inviteScan')}</ReadText>
        <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
          {canShareLink() ? (
            <Button variant="primary" cell onPress={() => void share()}>
              {room('share')}
            </Button>
          ) : null}
          <Button variant="secondary" cell onPress={() => void copy(code, copied)}>
            {player('copy')}
          </Button>
        </View>
      </View>
    </Sheet>
  );
}

/** The player's own friend code, on a line of its own, pressed to share it (`FriendInvite`). Nothing until it is read. */
function MyCode({ community, onTold }: { community: Community; onTold(message: string): void }) {
  const t = useT('rankings');
  const room = useT('room');
  const [code, setCode] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    let wanted = true;
    void community.me().then((me) => {
      if (wanted) setCode(me?.friendCode ?? null);
    });
    return () => {
      wanted = false;
    };
  }, [community]);
  const press = usePress({ onPress: () => setSharing(true) });
  if (code === null) return null;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('code')}: ${code}`} accessibilityHint={room('invite')} onPress={press} style={({ pressed }) => pressDown(pressed)}>
        <Framed kind="bevel" style={{ ...LINE, backgroundColor: COLORS['night-600'] }}>
          <ReadText size={13} tone="ink-200" style={{ flex: 1, minWidth: 0 }}>{t('code')}</ReadText>
          <PixelText size={15} tone="gold-500" style={{ letterSpacing: 15 * 0.12 }}>{code}</PixelText>
          <View aria-hidden importantForAccessibility="no-hide-descendants">
            <PixelText size={14} tone="ink-300">{'›'}</PixelText>
          </View>
        </Framed>
      </Pressable>
      {sharing ? <FriendInvite code={code} onClose={() => setSharing(false)} onTold={onTold} /> : null}
    </>
  );
}

/**
 * A friend, opened: their rat, the game they are in now, the games played together and their best ranked life; and what can be done with them: join
 * the game they wait in, ask them into one (`onInvite`, where the player can), or end the friendship. A request the player sent: only taking it back.
 */
function FriendSheet({ community, open, onClose, onJoin, onInvite, onEnd, busy }: { community: Community; open: { friend: Friend; bond: Bond } | null; onClose(): void; onJoin(code: string): void; onInvite?: (friend: Friend) => void; onEnd(friend: Friend): void; busy: boolean }) {
  const t = useT('friends');
  const ranks = useT('rankings');
  const common = useT('common');
  const { text, fmt } = useWords();
  const nameOf = useFriendName();
  const playingOf = usePlaying();
  // The last friend shown, kept while the sheet leaves.
  const [last, setLast] = useState(open);
  if (open !== null && open !== last) setLast(open);
  const shown = open ?? last;
  // Their best ranked life, from the ranking among the player's friends: `undefined` while it is asked, null for none.
  const [best, setBest] = useState<RankingRow | null | undefined>(undefined);
  const userId = shown?.friend.userId ?? null;
  useEffect(() => {
    if (open === null || open.bond !== 'friend') return;
    let wanted = true;
    setBest(undefined);
    void community.ranking({ period: 'all', friends: true, lifeId: null }).then((rows) => {
      if (wanted) setBest(rows?.find((row) => row.userId === open.friend.userId) ?? null);
    });
    return () => {
      wanted = false;
    };
  }, [community, open]);
  // Joined, or asked into a game, once the sheet has gone: what it opens is not opened over it.
  const then = useRef<(() => void) | null>(null);
  const after = (run: () => void) => {
    then.current = run;
    onClose();
  };
  const friend = shown?.friend;
  const now = friend && shown?.bond === 'friend' ? playingOf(friend) : null;
  const joinable = friend?.playing?.status === 'open' ? friend.playing.code : null;
  return (
    <Sheet
      open={open !== null}
      onClose={onClose}
      onGone={() => {
        const run = then.current;
        then.current = null;
        run?.();
      }}
      title={friend ? nameOf(friend) : ''}
      closeLabel={common('close')}
    >
      {friend && userId ? (
        <View style={{ gap: 12 }}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <RatAvatar look={ratLookOf(friend.avatar, userId)} size="lg" />
            {now ? <ReadText size={13} tone={now.tone}>{now.text}</ReadText> : null}
            {shown?.bond === 'outgoing' ? <ReadText size={13} tone="ink-300">{ranks('pending')}</ReadText> : null}
          </View>
          {shown?.bond === 'friend' ? (
            <>
              <ReadText size={13} tone="ink-200" style={{ textAlign: 'center' }}>{t('together', { n: friend.together ?? 0 })}</ReadText>
              <View style={{ gap: 6 }}>
                <ReadText size={12} tone="ink-300" style={{ textTransform: 'uppercase', letterSpacing: 12 * 0.05 }}>{t('best')}</ReadText>
                {best === undefined ? <Loading>{common('loading')}</Loading> : null}
                {best === null ? <ReadText size={13} tone="ink-200">{t('noBest')}</ReadText> : null}
                {best ? (
                  <Framed kind="bevel" style={{ ...LINE, gap: 12 }}>
                    <LifeFace lifeId={best.lifeId} />
                    <ReadText size={14} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{text.lives[best.lifeId]?.name ?? best.lifeId}</ReadText>
                    <PixelText size={17}>{fmt.number(best.score)}</PixelText>
                  </Framed>
                ) : null}
              </View>
              {joinable ? (
                <Button variant="primary" wide onPress={() => after(() => onJoin(joinable))}>
                  {t('join')}
                </Button>
              ) : onInvite && friend.playing?.status !== 'playing' ? (
                <Button variant="primary" wide onPress={() => after(() => onInvite(friend))}>
                  {t('invite')}
                </Button>
              ) : null}
            </>
          ) : null}
          {shown?.bond === 'friend' ? <ReadText size={12} tone="ink-300" lineHeight={12 * SNUG} style={{ textAlign: 'center' }}>{ranks('unfriendAbout')}</ReadText> : null}
          <Button variant="danger" wide disabled={busy} onPress={() => onEnd(friend)}>
            {ranks(shown?.bond === 'outgoing' ? 'cancelRequest' : 'unfriend')}
          </Button>
        </View>
      ) : null}
    </Sheet>
  );
}

/**
 * The friends' panel: the player's own code, the requests waiting on them, their friends (each with the game they are in now) and the requests they
 * sent, a code to ask with; a friend opened in their sheet, joined in the game they wait in (`onJoin`) or asked into one (`onInvite`). `initial` is a
 * friend's code a link brought; `turn` reads the friends again when it moves. Nothing without an account to ask with.
 */
export function FriendsPanel({ onJoin, onInvite, onTold, initial, turn = 0 }: { onJoin(code: string): void; onInvite?: (friend: Friend) => void; onTold(message: string): void; initial?: string; turn?: number }) {
  const t = useT('rankings');
  const common = useT('common');
  const community = useCommunity();
  const friends = useFriendships(community, turn);
  const nameOf = useFriendName();
  const [open, setOpen] = useState<{ friend: Friend; bond: Bond } | null>(null);
  const opening = useCallback((friend: Friend, bond: Bond) => setOpen({ friend, bond }), []);
  if (community === null) return null;
  const list = friends.list;
  const line = (friend: Friend, bond: Bond) => (
    <FriendLine key={`${bond}-${friend.userId}`} friend={friend} name={nameOf(friend)} bond={bond} busy={bond === 'incoming' && friends.busy} onAnswer={(id, yes) => void friends.answer(id, yes)} onOpen={opening} />
  );
  return (
    <View role="region" aria-label={t('following')}>
      <Panel title={t('following')} label={t('following')}>
        <View style={{ gap: 8 }}>
          <MyCode community={community} onTold={onTold} />
          {list === undefined ? <Loading>{common('loading')}</Loading> : null}
          {list && list.incoming.length > 0 ? (
            <View style={{ gap: 6 }}>
              <GroupHeading tone="gold-200">{t('requests')}</GroupHeading>
              {list.incoming.map((friend) => line(friend, 'incoming'))}
            </View>
          ) : null}
          {list && list.friends.length === 0 && list.incoming.length === 0 ? <ReadText size={13} tone="ink-200">{t('nobody')}</ReadText> : null}
          {list && list.friends.length > 0 ? <View style={{ gap: 6 }}>{list.friends.map((friend) => line(friend, 'friend'))}</View> : null}
          {list && list.outgoing.length > 0 ? (
            <View style={{ gap: 6 }}>
              <GroupHeading tone="ink-300">{t('sent')}</GroupHeading>
              {list.outgoing.map((friend) => line(friend, 'outgoing'))}
            </View>
          ) : null}
          <FriendForm key={initial ?? ''} busy={friends.busy} said={friends.said} onAsk={friends.ask} initial={initial} />
        </View>
        <FriendSheet
          community={community}
          open={open}
          onClose={() => setOpen(null)}
          onJoin={onJoin}
          onInvite={onInvite}
          busy={friends.busy}
          onEnd={(friend) => void friends.end(friend.userId).then((done) => done && setOpen(null))}
        />
      </Panel>
    </View>
  );
}

/**
 * The player's friends, to ask into the game waiting for its players (the lobby): each friend not in it, with the way to ask them, said once asked.
 * Nothing while they are read, nor for a player with no friends.
 */
export function InviteFriends({ here, onInvite }: { here: readonly string[]; onInvite(userId: string): Promise<'sent' | 'here' | 'failed'> }) {
  const t = useT('friends');
  const community = useCommunity();
  const friends = useFriendships(community);
  const nameOf = useFriendName();
  const playingOf = usePlaying();
  const [asked, setAsked] = useState<Readonly<Record<string, 'sent' | 'failed' | 'asking'>>>({});
  const list = friends.list?.friends.filter((friend) => !here.includes(friend.userId)) ?? [];
  if (list.length === 0) return null;
  const invite = async (userId: string) => {
    setAsked((was) => ({ ...was, [userId]: 'asking' }));
    const said = await onInvite(userId);
    setAsked((was) => ({ ...was, [userId]: said === 'failed' ? 'failed' : 'sent' }));
  };
  return (
    <View role="region" aria-label={t('inviteTitle')}>
      <Panel title={t('inviteTitle')} label={t('inviteTitle')}>
        <View style={{ gap: 6 }}>
          {list.map((friend) => {
            const state = asked[friend.userId];
            const now = playingOf(friend);
            return (
              <Framed key={friend.userId} kind="bevel" style={LINE}>
                <RatAvatar look={ratLookOf(friend.avatar, friend.userId)} size="sm" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ReadText size={14} numberOfLines={1}>{nameOf(friend)}</ReadText>
                  {state === 'failed' ? (
                    <ReadText size={12} tone="wine-300" numberOfLines={1}>{t('inviteFailed')}</ReadText>
                  ) : now ? (
                    <ReadText size={12} tone={now.tone} numberOfLines={1}>{now.text}</ReadText>
                  ) : null}
                </View>
                {state === 'sent' ? (
                  <ReadText size={12} tone="teal-300" style={{ flexShrink: 0 }}>{t('invited')}</ReadText>
                ) : (
                  <Button variant="secondary" size={13} disabled={state === 'asking'} onPress={() => void invite(friend.userId)}>
                    {t('inviteShort')}
                  </Button>
                )}
              </Framed>
            );
          })}
        </View>
      </Panel>
    </View>
  );
}
