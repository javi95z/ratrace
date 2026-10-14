'use client';

import { careerArt, cityIcon, lives } from '@ratrace/content';
import { useEffect, useId, useState } from 'react';
import { useCommunity, useT, useWords } from '@/game/context';
import { Link } from '@/i18n/navigation';
import { ageAt } from '@/game/present';
import type { Community, Friend, RankedLifeDetail, RankingRow } from '@/online/types';
import { Bare, Button, Panel, Row } from '@/ui/kit';
import { Sheet, Tabs } from '@/ui/overlay';
import { Picker } from '@/ui/Picker';
import { Sprite } from '@/ui/Sprite';
import { Medal } from './Medal';
import { WorthGraph } from './WorthGraph';

type Kind = 'all' | 'week' | 'friends';
const KINDS: readonly Kind[] = ['all', 'week', 'friends'];
/** How a name is written. The database checks it again, and what it says. */
const NAME = /^[A-Za-z0-9_]{3,16}$/;
const FIELD = 'sunk min-h-11 w-full bg-night-900 px-3 text-[16px] text-cream';

/** What a player with no name is told apart by: the start of their id. */
const tagOf = (userId: string) => userId.slice(0, 4).toUpperCase();

/** The player's own name, and the code a friend follows them with. Nothing, where theirs could not be read. */
function You({ community, onRenamed }: { community: Community; onRenamed(): void }) {
  const t = useT('rankings');
  const [me, setMe] = useState<{ nickname: string | null; friendCode: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<'invalid' | 'taken' | 'refused' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let wanted = true;
    void community.me().then((mine) => {
      if (wanted) setMe(mine);
    });
    return () => {
      wanted = false;
    };
  }, [community]);

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
    <Panel title={t('you')} label={t('you')}>
      <div className="flex flex-col gap-2">
        {/* The name and the code on one line each: the way to change the name sits beside it. */}
        {editing ? null : (
          <div className="flex items-center justify-between gap-3">
            <p className={me.nickname ? 'pixel min-w-0 truncate text-[18px]' : 'min-w-0 text-[13px] leading-snug text-ink-200'}>{me.nickname ?? t('noName')}</p>
            <Button variant="quiet" className="shrink-0 text-[14px]" onClick={open}>
              {me.nickname ? t('changeName') : t('chooseName')}
            </Button>
          </div>
        )}
        {editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label className="flex flex-col gap-1 text-[13px] text-ink-200">
              {t('name')}
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} autoComplete="off" autoCapitalize="off" spellCheck={false} className={FIELD} />
            </label>
            {problem ? (
              <p role="alert" className="frame bg-wine-900 px-3 py-2 text-[13px]">
                {t(problem)}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" type="submit" disabled={busy}>
                {t('save')}
              </Button>
              <Button variant="quiet" onClick={() => setEditing(false)}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        ) : null}
        <p className="text-[12px] text-ink-300" title={t('codeHint')}>
          {t('code')}: <span className="pixel select-all text-[15px] tracking-[0.12em] text-gold-500">{me.friendCode}</span> · {t('codeHint')}
        </p>
      </div>
    </Panel>
  );
}

const FOLLOW_PROBLEM = { unknown: 'followUnknown', self: 'followSelf', full: 'followFull', failed: 'followFailed' } as const;

/** Whom the player follows, the way to follow one more by their code, and the way to stop. */
function Following({ community, onChanged }: { community: Community; onChanged(): void }) {
  const t = useT('rankings');
  /** `undefined` until the answer comes; null when it could not be read. */
  const [friends, setFriends] = useState<Friend[] | null | undefined>(undefined);
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<(typeof FOLLOW_PROBLEM)[keyof typeof FOLLOW_PROBLEM] | null>(null);
  const [busy, setBusy] = useState(false);
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    let wanted = true;
    void community.friends().then((list) => {
      if (wanted) setFriends(list);
    });
    return () => {
      wanted = false;
    };
  }, [community, turn]);

  const changed = () => {
    setTurn((n) => n + 1);
    onChanged();
  };
  const follow = async () => {
    const asked = code.trim();
    if (asked === '') return;
    setBusy(true);
    const answer = await community.follow(asked);
    setBusy(false);
    if (answer !== 'ok') return setProblem(FOLLOW_PROBLEM[answer]);
    setCode('');
    setProblem(null);
    changed();
  };
  const nameOf = (friend: Friend) => friend.nickname ?? t('nameless', { tag: tagOf(friend.userId) });

  return (
    <Panel title={t('following')} label={t('following')}>
      <div className="flex flex-col gap-2">
        {friends === null ? <p className="text-[13px] text-ink-200">{t('friendsUnreachable')}</p> : null}
        {friends?.length === 0 ? <p className="text-[13px] text-ink-200">{t('nobody')}</p> : null}
        {friends && friends.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {friends.map((friend) => (
              <li key={friend.userId} className="bevel flex items-center justify-between gap-2 bg-night-700 px-3 py-1.5">
                <span className="min-w-0 truncate text-[14px]">{nameOf(friend)}</span>
                <Button variant="quiet" className="shrink-0 text-[13px]" aria-label={t('stop', { name: nameOf(friend) })} onClick={() => void community.unfollow(friend.userId).then(changed)}>
                  {t('stopShort')}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void follow();
          }}
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-ink-200">
            {t('friendCode')}
            <input value={code} onChange={(event) => setCode(event.target.value)} maxLength={12} autoComplete="off" autoCapitalize="characters" spellCheck={false} className={`${FIELD} uppercase tracking-[0.12em]`} />
          </label>
          <Button variant="primary" type="submit" disabled={busy}>
            {t('follow')}
          </Button>
        </form>
        {problem ? (
          <p role="alert" className="frame bg-wine-900 px-3 py-2 text-[13px]">
            {t(problem)}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

/** The gold, silver and bronze of the first three places. */
const PLACE: Record<number, string> = { 1: 'text-gold-500', 2: 'text-ink-100', 3: 'text-[#c98a4b]' };

/** The sign of a starting life: the sign of the career it begins in. */
function lifeIcon(lifeId: string): string {
  const career = lives.find((life) => life.id === lifeId)?.start.life?.career?.id;
  return career ? careerArt(career) : 'icon.job';
}

/**
 * The life behind a line of a ranking, as anyone may see it: how it ended, what it was worth year
 * by year, the cities it was lived in and the badges it earned. Asked of the cloud when opened.
 */
function RunSheet({ community, row, name, onClose }: { community: Community; row: RankingRow; name: string; onClose(): void }) {
  const t = useT('rankings');
  const end = useT('end');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  /** `undefined` while it is on its way; null when it could not be read. */
  const [life, setLife] = useState<RankedLifeDetail | null | undefined>(undefined);
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
    <Sheet open onClose={onClose} title={name} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Bare className="size-10">
            <Sprite id={lifeIcon(row.lifeId)} />
          </Bare>
          <div className="min-w-0 flex-1">
            <p className="pixel truncate text-[16px]">{text.lives[row.lifeId]?.name ?? row.lifeId}</p>
            <p className="text-[12px] text-ink-300">{t('place', { place: row.place, day: fmt.day(row.finishedAt) })}</p>
          </div>
          <p className="pixel text-[26px] text-gold-500">{fmt.number(row.score)}</p>
        </div>
        {life === undefined ? <p className="pixel animate-blink text-center text-ink-300">{common('loading')}</p> : null}
        {life === null ? <p className="text-[13px] text-ink-200">{t('runUnreachable')}</p> : null}
        {life ? (
          <>
            <div>
              <Row left={end('netWorth')} right={<span className="text-gold-500">{fmt.money(life.netWorth)}</span>} />
              <Row left={t('runStatus')} right={fmt.number(life.status)} />
              <Row left={t('runEscape')} right={life.escapedAtRound === null ? t('runNever') : t('runAge', { age: ageAt(content, life.escapedAtRound) })} />
              <Row left={t('runBankruptcies')} right={fmt.number(life.bankruptcies)} />
            </div>
            {life.history.length > 1 ? <WorthGraph history={life.history} label={end('graph')} height={72} /> : null}
            {life.cities.length > 0 ? (
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-200">
                {t('runCities')}:
                {life.cities.map((city) => (
                  <span key={city} className="flex items-center gap-1">
                    <Sprite id={cityIcon(city)} />
                    {names.cities[city] ?? city}
                  </span>
                ))}
              </p>
            ) : null}
            {life.badges.length > 0 ? (
              <ul aria-label={t('runBadges')} className="flex flex-wrap gap-1">
                {life.badges.map((id) => (
                  <li key={id} title={text.badges[id]?.name ?? id}>
                    <Medal badgeId={id} size="sm" alt={text.badges[id]?.name ?? id} />
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </Sheet>
  );
}

/**
 * The rankings: the best ranked life of each player, of all time, of this week, or among the
 * people the player follows, of any starting life or of one. Only lives the server played are in
 * them, so every line can be set beside every other. Everything here is asked of the cloud and
 * shown as it answers.
 */
export function Rankings() {
  const t = useT('rankings');
  const common = useT('common');
  const { text, fmt } = useWords();
  const community = useCommunity();
  const ids = useId();
  const [kind, setKind] = useState<Kind>('all');
  const [lifeId, setLifeId] = useState<string | null>(null);
  /** The last answer, and what it answers: a ranking is shown only for what is being asked now. */
  const [answer, setAnswer] = useState<{ to: string; rows: RankingRow[] | null } | null>(null);
  const [turn, setTurn] = useState(0);
  const [opened, setOpened] = useState<RankingRow | null>(null);
  const asking = `${kind} ${lifeId ?? ''}`;
  const nameOf = (row: RankingRow) => row.nickname ?? t('nameless', { tag: tagOf(row.userId) });
  /** `undefined` while the answer is on its way; null when it could not be read. */
  const rows = answer?.to === asking ? answer.rows : undefined;

  useEffect(() => {
    if (community === null) return;
    let wanted = true;
    void community.ranking({ period: kind === 'week' ? 'week' : 'all', friends: kind === 'friends', lifeId }).then((found) => {
      if (wanted) setAnswer({ to: asking, rows: found });
    });
    return () => {
      wanted = false;
    };
  }, [community, kind, lifeId, asking, turn]);
  // Asked again after a change of name or of friends, the ranking on screen stays until the new one comes.
  const again = () => setTurn((n) => n + 1);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 px-3 pb-10 pt-4">
      <div className="flex items-center gap-2">
        <Link href="/" aria-label={common('back')} className="pixel frame-raised flex size-11 items-center justify-center bg-night-700 text-[18px] text-ink-200">
          ←
        </Link>
        <h1 className="pixel text-[24px] text-gold-500">{t('title')}</h1>
      </div>

      {community === null ? (
        <p className="frame bg-night-700 p-3 text-[14px] text-ink-200">{t('needAccount')}</p>
      ) : (
        <>
          <You community={community} onRenamed={again} />

          <div>
            <div className="-mx-3">
              <Tabs<Kind> label={t('kinds')} idPrefix={ids} tabs={KINDS.map((id) => ({ id, label: t(id) }))} value={kind} onChange={setKind} />
            </div>
            <div role="tabpanel" id={`${ids}-panel-${kind}`} aria-labelledby={`${ids}-tab-${kind}`} className="flex flex-col gap-2 pt-1">
              <p className="text-[12px] text-ink-300">{t('hint')}</p>
              <Picker<string | null>
                label={t('life')}
                value={lifeId}
                onChange={setLifeId}
                closeLabel={common('close')}
                options={[{ value: null, label: t('anyLife'), icon: 'icon.trophy' }, ...lives.map((life) => ({ value: life.id, label: text.lives[life.id]?.name ?? life.id, icon: lifeIcon(life.id) }))]}
              />
              {rows === undefined ? <p className="pixel animate-blink text-center text-ink-300">{common('loading')}</p> : null}
              {rows === null ? (
                <p role="status" className="frame bg-wine-900 px-3 py-2 text-[14px]">
                  {t('unreachable')}
                </p>
              ) : null}
              {rows?.length === 0 ? <p className="frame bg-night-700 p-3 text-[14px] text-ink-200">{t('empty')}</p> : null}
              {rows && rows.length > 0 ? (
                <ol aria-label={t(kind)} className="flex flex-col gap-1.5">
                  {rows.map((row) => (
                    <li key={row.userId} aria-current={row.mine ? 'true' : undefined}>
                      {/* A line opens the life behind it. */}
                      <button type="button" aria-haspopup="dialog" onClick={() => setOpened(row)} className={`bevel flex w-full items-center gap-3 px-3 py-2 text-left ${row.mine ? 'frame-gold bg-night-600' : 'bg-night-700'}`}>
                        <span className={`pixel w-8 shrink-0 text-right text-[17px] ${PLACE[row.place] ?? 'text-ink-200'}`}>{row.place}</span>
                        <Bare className="size-8">
                          <Sprite id={lifeIcon(row.lifeId)} />
                        </Bare>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px]">{nameOf(row)}</span>
                          <span className="block truncate text-[12px] text-ink-300">
                            {text.lives[row.lifeId]?.name ?? row.lifeId} · {fmt.day(row.finishedAt)}
                          </span>
                        </span>
                        <span className="pixel shrink-0 text-[18px]">{fmt.number(row.score)}</span>
                        <span aria-hidden className="text-[11px] text-ink-300">
                          ▸
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </div>

          {kind === 'friends' ? <Following community={community} onChanged={again} /> : null}
          {opened ? <RunSheet community={community} row={opened} name={nameOf(opened)} onClose={() => setOpened(null)} /> : null}
        </>
      )}
    </main>
  );
}
