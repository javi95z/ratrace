import { CHALLENGE_ART, ratArt } from '@ratrace/content';
import { ratLookOf } from '@ratrace/core/game/avatar';
import { ageAt } from '@ratrace/core/game/present';
import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { sheetsGone } from '../../ui/back';
import { GOLD } from '../../ui/frames';
import { Button, Notice, Panel, Raised, reach, usePress } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { adjustedRead } from '../../ui/fonts';
import { Loading } from '../../ui/Loading';
import { RatAvatar } from '../../ui/RatAvatar';
import { Screen } from '../../ui/Page';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { useAccount, useAccountOffer, useCommunity, useGame, useRuns, useSaving, useSignedIn, useUntilFresh, useWords } from '../context';
import { useAskedWhenShown } from '../askedWhenShown';
import { useT } from '../words';
import { useOwnT } from '../ownWords';
import { useThisWeek, WeeklyChallengeCard } from './Challenge';
import { RoomCard, useRoomLive } from './Room';
import { HomePreferences, HomeSettingsPanel, LanguageMenu } from './Settings';
import { PerfDrawn } from '../../ui/perf';
import { useGo } from '../pages';

/** The letter spacing of a pixel button set in the page's 15: 0.03 of it. */
const BUTTON_SPACING = 15 * 0.03;

/** The front door: carry on with the life in progress, or start another. */
export function Home() {
  const t = useT('home');
  const meta = useT('meta');
  const settings = useT('settings');
  const legal = useT('legal');
  const phone = useOwnT();
  const common = useT('common');
  const { content, text, names } = useWords();
  // Only what the door draws: the round and the city of the life, not the whole view that changes with every step of it.
  const status = useGame((s) => s.status);
  const lost = useGame((s) => s.lost);
  const lifeId = useGame((s) => s.lifeId);
  const round = useGame((s) => s.view?.round ?? null);
  const cityId = useGame((s) => s.view?.player.cityId ?? null);
  const finished = useGame((s) => s.view?.finished === true);
  const atEnd = useGame((s) => s.stage === 'end');
  const moved = useGame((s) => s.moved);
  const ranked = useGame((s) => s.ranked);
  const challenge = useGame((s) => s.challenge);
  const saving = useSaving();
  const go = useGo();
  const open = status === 'playing' && lifeId !== null && round !== null && cityId !== null;
  const inProgress = open && !atEnd;
  // Whoever has played before knows the game: the rat and its line make way for what they came for.
  const runs = useRuns();
  const returning = inProgress || (runs !== null && runs.length > 0);
  // A life that is over stays on the device until another begins, so its score can still be looked at.
  const over = open && finished;
  // The week's challenge has one button: carrying on with a life of it stands for it, attempt or practice.
  const week = useThisWeek();
  const challengeInProgress = inProgress && challenge !== null && challenge === week?.week;
  // A game with others that is not over comes before everything else, in gold.
  const turn = useRoomLive();
  // Continue acts on the newest copy of the life the account knows of: pressed while the account signs in or is read at a start, it waits for it,
  // a second and a half at most (`useUntilFresh`), the button still drawn, its detail the web's word for loading. Past that, the phone's copy is
  // played; a further one the account brings later replaces it then, as on the web. Once the wait is over, it goes on only if the player is still at
  // the front door with a life to continue: one who went elsewhere meanwhile is not taken to Play.
  const untilFresh = useUntilFresh();
  const [continuing, setContinuing] = useState(false);
  const here = useRef(true);
  useFocusEffect(
    useCallback(() => {
      here.current = true;
      return () => {
        here.current = false;
      };
    }, []),
  );
  const stillInProgress = useRef(inProgress);
  stillInProgress.current = inProgress;
  const carryOn = () => {
    if (continuing) return;
    const waiting = untilFresh();
    if (waiting === null) return go.push('play');
    setContinuing(true);
    void waiting.then(() => {
      setContinuing(false);
      if (here.current && stillInProgress.current) go.push('play');
    });
  };

  return (
    <Screen contentStyle={{ flexGrow: 1, alignItems: 'center', gap: returning ? 16 : 20, paddingTop: returning ? 24 : 40, paddingBottom: FOOT }}>
      <PerfDrawn name={status === 'booting' ? 'home: booting' : 'home'} />
      <View style={{ position: 'absolute', top: 16, right: 12, flexDirection: 'row', gap: 8, zIndex: 20 }}>
        <LanguageMenu />
        <HomePreferences />
      </View>
      {/* A first visit meets the mascot; someone coming back is waved at. */}
      {returning ? (
        <Sprite id={ratArt('wave')} fallback={{ w: 128, h: 128 }} style={{ marginBottom: -4 }} />
      ) : (
        <Sprite id="brand.mascot" fallback={{ w: 256, h: 256 }} style={{ marginBottom: -8 }} />
      )}
      <View style={{ alignItems: 'center' }}>
        <View accessibilityRole="header">
          <PixelText size={returning ? 28 : 34} tone="gold-500" lineHeight={returning ? 28 : 34}>{meta('title')}</PixelText>
        </View>
        {returning ? null : (
          <ReadText tone="ink-200" style={{ marginTop: 8, textAlign: 'center' }}>{meta('description')}</ReadText>
        )}
      </View>

      <View style={{ width: '100%', gap: 12 }}>
        {status === 'booting' ? (
          <Loading>{common('loading')}</Loading>
        ) : (
          <>
            {turn ? <RoomCard primary /> : null}
            {inProgress ? (
              <Raised
                role="link"
                tone={turn ? {} : GOLD}
                bg={turn ? 'night-600' : 'gold-500'}
                style={{ minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' }}
                onPress={carryOn}
              >
                {challenge !== null ? (
                  // A life of the weekly challenge says so before anything else: the attempt that counts, or a practice.
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Sprite id={CHALLENGE_ART.icon} size={{ w: 16, h: 16 }} />
                    <PixelText size={11} tone={turn ? 'gold-500' : 'ink-700'} lineHeight={11} style={{ letterSpacing: 11 * 0.05, textTransform: 'uppercase' }}>
                      {t(ranked ? 'continueChallenge' : 'continuePractice')}
                    </PixelText>
                  </View>
                ) : null}
                {/* The button is a pixel one, set in the 15 of the page: the letter spacing it gives (0.03 em) is 0.45, and its title, its label and its detail keep that length, not 0.03 of their own size. */}
                <PixelText size={19} tone={turn ? 'cream' : 'ink-900'} style={{ textAlign: 'center', letterSpacing: BUTTON_SPACING }}>{t('continue')}</PixelText>
                {/* The detail is Chakra Petch inside that pixel text: it keeps its font-size-adjust (so it is drawn larger than 13) and its 1.1 line. */}
                <ReadText size={adjustedRead(13)} tone={turn ? 'ink-200' : 'ink-700'} lineHeight={13 * 1.1} style={{ textAlign: 'center', letterSpacing: BUTTON_SPACING }}>
                  {continuing ? common('loading') : t('continueDetail', { life: text.lives[lifeId].name, age: ageAt(content, round), city: names.cities[cityId] })}
                </ReadText>
              </Raised>
            ) : null}
            <AccountLifeOffer endsLife={inProgress ? lifeId : null} endsRound={inProgress ? round : null} />
            <Raised
              role="link"
              tone={inProgress || turn ? {} : GOLD}
              bg={inProgress || turn ? 'night-600' : 'gold-500'}
              style={{ minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => go.push('new')}
            >
              <PixelText size={19} tone={inProgress || turn ? 'cream' : 'ink-900'} style={{ textAlign: 'center' }}>{t('newLife')}</PixelText>
            </Raised>
            {challengeInProgress ? null : <WeeklyChallengeCard />}
            {turn ? null : <RoomCard />}
            <FriendRequests />
            {over ? (
              <Raised role="link" bg="night-600" style={{ paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' }} onPress={() => go.push('play')}>
                <PixelText size={15} tone="cream" style={{ textAlign: 'center' }}>{t('lastLife')}</PixelText>
              </Raised>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Raised
                role="link"
                bg="night-700"
                place={{ flex: 1 }}
                style={{ flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8 }}
                onPress={() => go.push('collection')}
              >
                <Sprite id="icon.star" />
                <PixelText size={15} tone="ink-200">{t('collection')}</PixelText>
              </Raised>
              <Raised
                role="link"
                bg="night-700"
                place={{ flex: 1 }}
                style={{ flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8 }}
                onPress={() => go.push('records')}
              >
                <Sprite id="icon.trophy" />
                <PixelText size={15} tone="ink-200">{t('records')}</PixelText>
              </Raised>
            </View>
            {/* The rankings are the other players': there is a way to them only where someone is signed in to ask. Across the row, the web's `col-span-2`. */}
            <RankingsLink />
            {/* The web's words for a life that is newer, or waiting, or gone from another tab, tell of a page and a connection: the phone's own say update the app. */}
            {lost ? <Notice role="status">{lost === 'newer' ? phone('lostNewer') : lost === 'waiting' ? phone('lostWaiting') : t(lost === 'outdated' ? 'lostOutdated' : 'lostDamaged')}</Notice> : null}
            {moved && status === 'none' ? (
              <Notice role="status" bg="night-700">
                {phone('movedGone')}
              </Notice>
            ) : null}
          </>
        )}
      </View>

      {/* At the foot, as it always was: the settings, also behind the gear above. */}
      <View style={{ width: '100%', marginTop: 'auto' }}>
        <Panel label={settings('title')}>
          <HomeSettingsPanel profile={<ProfileLink />} />
        </Panel>
      </View>
      {/* What could not be kept is said where it is seen; where things are kept is said in the settings. */}
      {saving ? null : (
        <Notice role="alert" size={13} style={{ width: '100%' }}>
          {phone('notSaved')}
        </Notice>
      )}

      {/* The small print, out of the way: only here, at the very foot. */}
      <SmallPrint label={legal('link')} onPress={() => go.push('legal')} above={returning ? 16 : 20} />
    </Screen>
  );
}

/**
 * What the front door has open at the start, for a scene (`home-offer`: the question of the life waiting in the account), as a screen's initial state:
 * a scene is shot from a link, which cannot tap. The web's page presses the button instead.
 */
export const HomeOpened = createContext<{ offer?: boolean }>({});

/**
 * The life waiting in the account, lived on another device: a button under the life in progress, and the question it opens. It is taken or ended
 * only when the player says so. The question is about one life, by its id: it is never open for another one, and does not open by itself for a life
 * the account brings later. A leaf of its own, with the offer alone: the front door is not drawn again as the account's copy goes and comes with each
 * step of a life. `endsLife` and `endsRound` are the life on this phone that taking it would end, if there is one.
 */
function AccountLifeOffer({ endsLife, endsRound }: { endsLife: string | null; endsRound: number | null }) {
  const t = useT('home');
  const common = useT('common');
  const { content, text, names } = useWords();
  const { offer, takeOffer, declineOffer } = useAccountOffer();
  const go = useGo();
  const opened = useContext(HomeOpened);
  // The life in the account the player has asked about, by its id.
  const [asking, setAsking] = useState<string | null>(() => (opened.offer ? (offer?.gameId ?? null) : null));
  const [busy, setBusy] = useState(false);
  const life = offer === null ? null : { life: text.lives[offer.lifeId]?.name ?? '', age: ageAt(content, offer.round), city: names.cities[offer.cityId] ?? '' };

  // The sheet closes once the account has answered, and the game is opened once it has gone: a screen changed under a sheet still leaving is left with it.
  const answer = (how: () => Promise<unknown>, then?: () => void) => () => {
    setBusy(true);
    void how()
      .then(async () => {
        setBusy(false);
        setAsking(null);
        if (!then) return;
        await sheetsGone();
        then();
      })
      .catch(() => {
        setBusy(false);
        setAsking(null);
      });
  };

  return (
    <>
      {offer !== null && life !== null ? (
        <Raised
          bg="night-600"
          style={{ minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setAsking(offer.gameId)}
        >
          <PixelText size={16} tone="cream" style={{ textAlign: 'center', letterSpacing: BUTTON_SPACING }}>{t('accountLife')}</PixelText>
          <ReadText size={adjustedRead(13)} tone="ink-200" lineHeight={13 * 1.1} style={{ textAlign: 'center', letterSpacing: BUTTON_SPACING }}>
            {t('continueDetail', life)}
          </ReadText>
        </Raised>
      ) : null}
      {/* Held while it closes, the life gone from under it or answered: a sheet taken away whole is not one that has left. */}
      <Sheet open={offer !== null && asking === offer.gameId} onClose={() => setAsking(null)} title={t('accountLifeTitle')} closeLabel={common('close')}>
        {life !== null ? (
          <>
            <ReadText size={15} tone="ink-200" lineHeight={15 * SNUG}>{t('accountLifeBody', life)}</ReadText>
            {endsLife !== null && endsRound !== null ? (
              <ReadText size={14} tone="wine-300" lineHeight={14 * SNUG} style={{ marginTop: 8 }}>
                {t('accountLifeEnds', { life: text.lives[endsLife]?.name ?? '', age: ageAt(content, endsRound) })}
              </ReadText>
            ) : null}
            <View style={{ marginTop: 16, gap: 12 }}>
              <Button variant="primary" wide disabled={busy} onPress={answer(takeOffer, () => go.push('play'))}>
                {t('accountLifeTake')}
              </Button>
              <Button variant="danger" wide disabled={busy} onPress={answer(declineOffer)}>
                {t('accountLifeEnd')}
              </Button>
            </View>
          </>
        ) : null}
      </Sheet>
    </>
  );
}

/** The way to the rankings, where someone is signed in to ask the others (a leaf of its own: the connection coming and going draws nothing). */
function RankingsLink() {
  const t = useT('home');
  const go = useGo();
  const signedIn = useSignedIn();
  if (!signedIn) return null;
  return (
    <Raised
      role="link"
      bg="night-700"
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8 }}
      onPress={() => go.push('rankings')}
    >
      <Sprite id="icon.status" />
      <PixelText size={15} tone="ink-200">{t('rankings')}</PixelText>
    </Raised>
  );
}

/**
 * Friend requests waiting on the player, as a line that leads to them: there only when there are any, for someone signed in. Asked each time the
 * front door is shown (`useAskedWhenShown`), and again whenever who is signed in changes.
 */
function FriendRequests() {
  const t = useT('home');
  const { state } = useAccount();
  const community = useCommunity();
  const go = useGo();
  const userId = state.kind === 'member' || state.kind === 'guest' ? state.userId : null;
  // Asked each time the front door is shown: it stays drawn under the screens over it (the requests answered on the rankings' page), where the web's
  // is drawn anew on every visit.
  const ask = useMemo(() => (userId === null || community === null ? null : () => community.friends().then((found) => found?.incoming.length ?? 0)), [userId, community]);
  const waiting = useAskedWhenShown(ask, 0);
  if (waiting === 0) return null;
  return (
    <Raised
      role="link"
      tone={GOLD}
      bg="night-600"
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}
      onPress={() => go.push('rankings', { hash: 'friends' })}
    >
      <Sprite id="icon.multiplayer" />
      <PixelText size={15} tone="gold-500" style={{ flexShrink: 1, textAlign: 'center' }}>{t('friendRequests', { n: waiting })}</PixelText>
    </Raised>
  );
}

/** The way to the player's profile, with their rat on it: there for someone signed in with Google, whose profile the others see, and for nobody else. */
function ProfileLink() {
  const t = useT('home');
  const { state } = useAccount();
  const community = useCommunity();
  const go = useGo();
  const userId = state.kind === 'member' ? state.userId : null;
  // Asked each time the front door is shown (the rat may have been dressed on the profile's page over it), as `FriendRequests` asks.
  const ask = useMemo(() => (userId === null || community === null ? null : () => community.me().then((me) => me?.avatar ?? null)), [userId, community]);
  const avatar = useAskedWhenShown(ask, null);
  if (userId === null) return null;
  return (
    <Raised
      role="link"
      bg="night-700"
      style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8 }}
      onPress={() => go.push('player')}
    >
      <RatAvatar look={ratLookOf(avatar, userId)} size="sm" />
      <PixelText size={15} tone="ink-200">{t('profile')}</PixelText>
    </Raised>
  );
}

/** The room under the last thing of the page (the web's `pb-8`). */
const FOOT = 32;

/**
 * A line of small print that leads somewhere, plain: its touch is the 44 a thumb needs, though the line is not. Its box reaches up into the page's gap
 * (`above`) and down into its foot, over nothing that is pressed, and takes no room; it is wider than a thumb in every language.
 */
function SmallPrint({ label, onPress, above }: { label: string; onPress: () => void; above: number }) {
  const press = usePress({ onPress });
  return (
    <Pressable accessibilityRole="link" style={reach(12 * 1.45, { above, below: FOOT }).style} onPress={press}>
      <ReadText size={12} tone="ink-300">{label}</ReadText>
    </Pressable>
  );
}
