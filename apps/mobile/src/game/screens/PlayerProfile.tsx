import { progressOf } from '@ratrace/content';
import { avatarOf, ratLookOf } from '@ratrace/core/game/avatar';
import type { RatLook } from '@ratrace/core/game/avatar';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedRef, useSharedValue } from 'react-native-reanimated';
import { copy } from '../../ui/copy';
import { Framed } from '../../ui/Frame';
import { Button, Panel, pressDown, Raised, usePress } from '../../ui/kit';
import { Toast } from '../../ui/overlay';
import { SCREEN_TOP, Screen } from '../../ui/Page';
import { RAT_GROUND } from '../../ui/rat';
import { RatLayers } from '../../ui/RatAvatar';
import { PageScroll } from '../../ui/Sticky';
import { PixelText, ReadText, SNUG, TIGHT } from '../../ui/text';
import { TextField } from '../../ui/TextField';
import { COLORS } from '../../ui/theme';
import { useAccount, useAccountSettled, useCommunity, useProfile, useRuns, useT, useWords } from '../context';
import { BackLink } from './BackLink';
import { RankCard, useRankName } from './RankCard';
import { RatEditor } from './RatEditor';

// The same rule as Rankings' NAME; one copy once both screens are in.
const NAME = /^[A-Za-z0-9_]{3,16}$/;

/** The page's head: the way back and the title (the web's `size-11` arrow and `pixel text-[24px] text-gold-500`). */
function Head({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <BackLink />
      <View accessibilityRole="header" style={{ flexShrink: 1 }}>
        <PixelText size={24} tone="gold-500">{title}</PixelText>
      </View>
    </View>
  );
}

/** A way to the rest of the player's game (the web's `frame-raised min-h-11 bg-night-700 px-2 text-[13px]`), a third of the row. */
function More({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Raised role="link" bg="night-700" onPress={onPress} place={{ flex: 1, minWidth: 0 }} style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
      <ReadText size={13} style={{ textAlign: 'center' }}>{label}</ReadText>
    </Raised>
  );
}

/** The name as the others see it, pressed to change it (the web's `min-h-11 px-2` button, a pencil beside the name). */
function NameButton({ name, label, onPress }: { name: string; label: string; onPress: () => void }) {
  const press = usePress({ onPress });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={press} style={({ pressed }) => ({ ...pressDown(pressed), minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 })}>
      <PixelText size={24} lineHeight={24}>{name}</PixelText>
      <View aria-hidden importantForAccessibility="no-hide-descendants">
        <ReadText size={14} tone="ink-300">{'✎'}</ReadText>
      </View>
    </Pressable>
  );
}

/**
 * How the others see the player: the rat they play as, in rooms and rankings, and the name under
 * it. Only for someone signed in, whose profile the server keeps. `copied` is the friend code just copied, its toast up from the start (a
 * scene's initial state; the player copies it by a tap).
 */
export function PlayerProfile({ copied = false }: { copied?: boolean } = {}) {
  const t = useT('player');
  const ranks = useT('rankings');
  const common = useT('common');
  const router = useRouter();
  const { state } = useAccount();
  const settled = useAccountSettled();
  const community = useCommunity();
  const [me, setMe] = useState<{ nickname: string | null; friendCode: string; avatar: string | null } | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<'invalid' | 'taken' | 'refused' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const [told, setTold] = useState<string | null>(() => (copied ? t('copied') : null));
  const [editing, setEditing] = useState(false);
  const runs = useRuns();
  const profile = useProfile();
  const { fmt, text } = useWords();
  const rankName = useRankName();
  // How far the page has scrolled, on the UI thread, and its column: the rat's editor keeps its rat and tabs at the top while its choices scroll.
  const scrollY = useSharedValue(0);
  const column = useAnimatedRef<View>();
  const scrolling = useMemo(() => ({ scrollY, column, top: SCREEN_TOP }), [scrollY, column]);

  useEffect(() => {
    if (community === null) return;
    let live = true;
    void community.me().then((found) => {
      if (!live) return;
      setMe(found);
      setName(found?.nickname ?? '');
    });
    return () => {
      live = false;
    };
  }, [community]);

  const userId = state.kind === 'member' ? state.userId : null;
  const page = (children: ReactNode) => (
    <PageScroll.Provider value={scrolling}>
      <Screen scrollY={scrollY} contentStyle={{ paddingBottom: 40 }} fixed={<Toast message={told} onDone={() => setTold(null)} />}>
        <Animated.View ref={column} collapsable={false} style={{ gap: 16 }}>
          <Head title={t('title')} />
          {children}
        </Animated.View>
      </Screen>
    </PageScroll.Provider>
  );
  if (userId === null || community === null) {
    // Until the account has tried to sign in, nobody being signed in is no reason to ask for it.
    if (!settled && state.kind === 'offline') return page(null);
    return page(
      <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], padding: 12 }}>
        <ReadText size={14} tone="ink-200">{t('signIn')}</ReadText>
      </Framed>,
    );
  }

  const look = ratLookOf(me?.avatar, userId);
  const ground = COLORS[RAT_GROUND[look.colour]];
  const pick = async (next: RatLook) => {
    const avatar = avatarOf(next);
    if (avatar === avatarOf(look)) return;
    const before = me;
    // Shown at once; put back if the server would not keep it.
    setMe((was) => (was ? { ...was, avatar } : was));
    // Kept quietly: the rat above already shows the change. Only a failure is told.
    if (!(await community.setAvatar(avatar))) {
      setMe(before ?? null);
      setTold(t('notSaved'));
    }
  };
  const rename = async () => {
    const asked = name.trim();
    // How it is written is checked here, before anyone is asked. What it says is the database's to judge.
    if (!NAME.test(asked)) return setProblem('invalid');
    setBusy(true);
    const answer = await community.rename(asked);
    setBusy(false);
    if (answer !== 'ok') return setProblem(answer);
    setProblem(null);
    setEditing(false);
    setMe((was) => (was ? { ...was, nickname: asked } : was));
    setTold(t('saved'));
  };
  // Where the phone does not take it, nothing is said: the code is on screen to be copied by hand.
  const copyCode = () => {
    if (me?.friendCode) void copy(me.friendCode, () => setTold(t('copied')));
  };
  const lives = runs ?? [];
  const best = lives.reduce<number | null>((top, run) => (top === null || run.score > top ? run.score : top), null);
  const together = lives.filter((run) => run.room).length;
  const figures = [
    { label: t('lives'), value: fmt.number(lives.length) },
    { label: t('best'), value: best === null ? '—' : fmt.number(best) },
    { label: t('badges'), value: fmt.number(Object.keys(profile.badges).length) },
    { label: t('games'), value: fmt.number(together) },
  ];

  return page(
    <>
      {/* The player as the others see them: their rat on their colour, their name, and the code to be followed by. */}
      <View role="region" aria-label={t('preview')}>
        <Framed kind="bevel" style={{ backgroundColor: COLORS['night-700'], paddingHorizontal: 12, paddingBottom: 16, paddingTop: 20 }}>
          {/* The colour of their ground across the top: inside the frame, which draws round the box and is not cut by it. */}
          <View aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 96, opacity: 0.6, backgroundColor: ground, pointerEvents: 'none' }} />
          <View style={{ alignItems: 'center', gap: 8 }}>
            <View aria-hidden importantForAccessibility="no-hide-descendants">
              <Framed kind="double" tone={{ ring: 'gold-500' }} style={{ backgroundColor: ground }}>
                {/* The rat at the size it was drawn: every pixel of it, none smudged. */}
                <View style={{ opacity: me === undefined ? 0 : 1 }}>
                  <RatLayers look={look} size={128} />
                </View>
              </Framed>
            </View>
            {editing ? (
              <View style={{ alignSelf: 'stretch', gap: 8 }}>
                <TextField label={ranks('name')} value={name} onChangeText={setName} maxLength={16} autoFocus returnKeyType="done" onSubmitEditing={() => void rename()} />
                {problem ? (
                  <View accessibilityRole="alert">
                    <ReadText size={13} tone="wine-300">{ranks(problem)}</ReadText>
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    variant="secondary"
                    cell
                    onPress={() => {
                      setEditing(false);
                      setProblem(null);
                      setName(me?.nickname ?? '');
                    }}
                  >
                    {common('cancel')}
                  </Button>
                  <Button variant="primary" cell disabled={busy} onPress={() => void rename()}>
                    {ranks('save')}
                  </Button>
                </View>
              </View>
            ) : (
              <NameButton name={me === undefined ? ' ' : (me?.nickname ?? t('noName'))} label={t('rename')} onPress={() => setEditing(true)} />
            )}
            {me?.friendCode ? (
              <Raised bg="night-800" onPress={copyCode} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
                <ReadText size={13} tone="ink-200">{ranks('code')}</ReadText>
                <PixelText size={13} tone="gold-500" style={{ letterSpacing: 13 * 0.15 }}>{me.friendCode}</PixelText>
                <ReadText size={13} tone="ink-300">{`· ${t('copy')}`}</ReadText>
              </Raised>
            ) : null}
            <ReadText size={12} tone="ink-300" lineHeight={12 * SNUG} style={{ textAlign: 'center' }}>{t('about')}</ReadText>
          </View>
        </Framed>
      </View>

      <RankCard />

      {/* What the player has lived, at a glance: this device's records. */}
      <View role="region" aria-label={t('figures')} style={{ flexDirection: 'row', gap: 8 }}>
        {figures.map((figure) => (
          <Framed key={figure.label} kind="frame" style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 2, backgroundColor: COLORS['night-800'], paddingHorizontal: 4, paddingVertical: 8 }}>
            <PixelText size={18} tone="gold-500" lineHeight={18}>{figure.value}</PixelText>
            <ReadText size={11} tone="ink-300" lineHeight={11 * TIGHT} style={{ textAlign: 'center' }}>{figure.label}</ReadText>
          </Framed>
        ))}
      </View>

      {/* The rat, a part at a time; the one above shows each choice at once. */}
      <Panel title={t('rat')} label={t('rat')}>
        <RatEditor
          look={look}
          earned={profile.badges}
          rank={progressOf(profile.rank.points).rank}
          badgeName={(id) => text.badges[id]?.name ?? id}
          rankName={rankName}
          onPick={(next) => void pick(next)}
          onLocked={setTold}
        />
      </Panel>

      {/* Where the rest of the player's game is. */}
      <View role="navigation" aria-label={t('more')} style={{ flexDirection: 'row', gap: 8 }}>
        <More label={t('toRecords')} onPress={() => router.push('/records')} />
        <More label={t('toCollection')} onPress={() => router.push('/collection')} />
        <More label={t('toRankings')} onPress={() => router.push('/rankings')} />
      </View>
    </>,
  );
}
