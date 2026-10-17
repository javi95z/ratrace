'use client';

import { useEffect, useState } from 'react';
import { avatarOf, RAT_COLOURS, ratColourOf } from '@/game/avatar';
import type { RatColour } from '@/game/avatar';
import { useAccount, useCommunity, useT } from '@/game/context';
import { Link } from '@/i18n/navigation';
import { Button, Panel } from '@/ui/kit';
import { Toast } from '@/ui/overlay';
import { RatAvatar } from '@/ui/RatAvatar';
import { FIELD, NAME } from './Rankings';

/** Each colour, by the word for it: the key of each is written out. */
const COLOUR_NAME: Record<RatColour, string> = {
  gold: 'colours.gold',
  teal: 'colours.teal',
  wine: 'colours.wine',
  sky: 'colours.sky',
  coral: 'colours.coral',
  emerald: 'colours.emerald',
  cream: 'colours.cream',
  slate: 'colours.slate',
};

/**
 * How the others see the player: the rat they play as, in rooms and rankings, and the name under
 * it. Only for someone signed in, whose profile the server keeps.
 */
export function PlayerProfile() {
  const t = useT('player');
  const ranks = useT('rankings');
  const common = useT('common');
  const { state } = useAccount();
  const community = useCommunity();
  const [me, setMe] = useState<{ nickname: string | null; friendCode: string; avatar: string | null } | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<'invalid' | 'taken' | 'refused' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const [told, setTold] = useState<string | null>(null);

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
  const header = (
    <div className="flex items-center gap-2">
      <Link href="/" aria-label={common('back')} className="pixel frame-raised flex size-11 items-center justify-center bg-night-700 text-[18px] text-ink-200">
        ←
      </Link>
      <h1 className="pixel text-[24px] text-gold-500">{t('title')}</h1>
    </div>
  );
  if (userId === null || community === null) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-3 pb-10 pt-4">
        {header}
        <p className="frame bg-night-700 p-3 text-[14px] text-ink-200">{t('signIn')}</p>
      </main>
    );
  }

  const colour = ratColourOf(me?.avatar, userId);
  const pick = async (next: RatColour) => {
    const avatar = avatarOf(next);
    const before = me;
    // Shown at once; put back if the server would not keep it.
    setMe((was) => (was ? { ...was, avatar } : was));
    if (await community.setAvatar(avatar)) setTold(t('saved'));
    else {
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
    setMe((was) => (was ? { ...was, nickname: asked } : was));
    setTold(t('saved'));
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-3 pb-10 pt-4">
      {header}
      {me === undefined ? <p className="pixel text-center text-ink-300">{common('loading')}</p> : null}
      <section aria-label={t('preview')} className="flex flex-col items-center gap-2 py-2">
        <RatAvatar colour={colour} size="lg" />
        <p className="pixel text-[20px]">{me?.nickname ?? t('noName')}</p>
        {me?.friendCode ? <p className="text-[12px] text-ink-300">{ranks('code')}: <span className="pixel text-ink-200">{me.friendCode}</span></p> : null}
        <p className="text-center text-[13px] leading-snug text-ink-300">{t('about')}</p>
      </section>

      <Panel title={t('rat')} label={t('rat')}>
        <div role="radiogroup" aria-label={t('rat')} className="grid grid-cols-4 gap-2">
          {RAT_COLOURS.map((each) => (
            <button
              key={each}
              type="button"
              role="radio"
              aria-checked={each === colour}
              aria-label={t(COLOUR_NAME[each])}
              onClick={() => void pick(each)}
              className={`frame-raised flex min-h-14 items-center justify-center bg-night-700 p-1.5 ${each === colour ? 'outline outline-2 outline-gold-500' : ''}`}
            >
              <RatAvatar colour={each} size="md" />
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={ranks('name')} label={ranks('name')}>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void rename();
          }}
        >
          <input aria-label={ranks('name')} value={name} onChange={(event) => setName(event.target.value)} maxLength={16} autoComplete="off" autoCapitalize="off" spellCheck={false} className={FIELD} />
          {problem ? (
            <p role="alert" className="text-[13px] text-wine-300">
              {ranks(problem)}
            </p>
          ) : null}
          <Button variant="primary" wide type="submit" disabled={busy || name.trim() === (me?.nickname ?? '')}>
            {ranks('save')}
          </Button>
        </form>
      </Panel>
      <Toast message={told} onDone={() => setTold(null)} />
    </main>
  );
}
