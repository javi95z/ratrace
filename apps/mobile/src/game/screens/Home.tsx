import { CHALLENGE_ART, ratArt } from '@ratrace/content';
import { ageAt } from '@ratrace/core/game/present';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { GOLD } from '../../ui/frames';
import { Notice, Panel, Raised, reach, usePress } from '../../ui/kit';
import { adjustedRead } from '../../ui/fonts';
import { Loading } from '../../ui/Loading';
import { Screen } from '../../ui/Page';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText } from '../../ui/text';
import { useGame, useRuns, useSaving, useWords } from '../context';
import { useT } from '../words';
import { useThisWeek, WeeklyChallengeCard } from './Challenge';
import { HomePreferences, HomeSettingsPanel, LanguageMenu } from './Settings';
import { PerfDrawn } from '../../ui/perf';

/** The letter spacing of a pixel button set in the page's 15: 0.03 of it. */
const BUTTON_SPACING = 15 * 0.03;

/** The front door: carry on with the life in progress, or start another. */
export function Home() {
  const t = useT('home');
  const meta = useT('meta');
  const settings = useT('settings');
  const legal = useT('legal');
  const phone = useT('phone');
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
  const router = useRouter();
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
            {inProgress ? (
              <Raised
                role="link"
                tone={GOLD}
                bg="gold-500"
                style={{ minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => router.push('/play')}
              >
                {challenge !== null ? (
                  // A life of the weekly challenge says so before anything else: the attempt that counts, or a practice.
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Sprite id={CHALLENGE_ART.icon} size={{ w: 16, h: 16 }} />
                    <PixelText size={11} tone="ink-700" lineHeight={11} style={{ letterSpacing: 11 * 0.05, textTransform: 'uppercase' }}>
                      {t(ranked ? 'continueChallenge' : 'continuePractice')}
                    </PixelText>
                  </View>
                ) : null}
                {/* The button is a pixel one, set in the 15 of the page: the letter spacing it gives (0.03 em) is 0.45, and its title, its label and its detail keep that length, not 0.03 of their own size. */}
                <PixelText size={19} tone="ink-900" style={{ textAlign: 'center', letterSpacing: BUTTON_SPACING }}>{t('continue')}</PixelText>
                {/* The detail is Chakra Petch inside that pixel text: it keeps its font-size-adjust (so it is drawn larger than 13) and its 1.1 line. */}
                <ReadText size={adjustedRead(13)} tone="ink-700" lineHeight={13 * 1.1} style={{ textAlign: 'center', letterSpacing: BUTTON_SPACING }}>
                  {t('continueDetail', { life: text.lives[lifeId].name, age: ageAt(content, round), city: names.cities[cityId] })}
                </ReadText>
              </Raised>
            ) : null}
            <Raised
              role="link"
              tone={inProgress ? {} : GOLD}
              bg={inProgress ? 'night-600' : 'gold-500'}
              style={{ minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => router.push('/new')}
            >
              <PixelText size={19} tone={inProgress ? 'cream' : 'ink-900'} style={{ textAlign: 'center' }}>{t('newLife')}</PixelText>
            </Raised>
            {challengeInProgress ? null : <WeeklyChallengeCard />}
            {over ? (
              <Raised role="link" bg="night-600" style={{ paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' }} onPress={() => router.push('/play')}>
                <PixelText size={15} tone="cream" style={{ textAlign: 'center' }}>{t('lastLife')}</PixelText>
              </Raised>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Raised
                role="link"
                bg="night-700"
                place={{ flex: 1 }}
                style={{ flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8 }}
                onPress={() => router.push('/collection')}
              >
                <Sprite id="icon.star" />
                <PixelText size={15} tone="ink-200">{t('collection')}</PixelText>
              </Raised>
              <Raised
                role="link"
                bg="night-700"
                place={{ flex: 1 }}
                style={{ flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8 }}
                onPress={() => router.push('/records')}
              >
                <Sprite id="icon.trophy" />
                <PixelText size={15} tone="ink-200">{t('records')}</PixelText>
              </Raised>
            </View>
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
          <HomeSettingsPanel />
        </Panel>
      </View>
      {/* What could not be kept is said where it is seen; where things are kept is said in the settings. */}
      {saving ? null : (
        <Notice role="alert" size={13} style={{ width: '100%' }}>
          {phone('notSaved')}
        </Notice>
      )}

      {/* The small print, out of the way: only here, at the very foot. */}
      <SmallPrint label={legal('link')} onPress={() => router.push('/legal')} above={returning ? 16 : 20} />
    </Screen>
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
