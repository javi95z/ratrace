'use client';

import { ratColourOf } from '@/game/avatar';
import { RatAvatar } from '@/ui/RatAvatar';
import { topicArt } from '@ratrace/content';
import type { Headline } from '@ratrace/engine';
import { useGame, useT, useWords } from '@/game/context';
import { ageAt, headlineText } from '@/game/present';
import { rivalNews } from '@/game/rivals';
import { roomStory, useRoomPaper } from '@/game/roomStory';
import type { RoomStory } from '@/game/roomStory';
import { useRivals } from '@/game/useRivals';
import { Panel } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { CityBanner } from './CityBanner';
import { CrisisBar } from './Crisis';

/**
 * One gauge of the economy, as a dial sunk into the panel: an icon, where it stands, and what it is.
 * A gauge that reads as a word takes the whole width: "Desaceleración" does not fit beside another
 * gauge in a side column, and a reading is never cut short.
 */
function Gauge({ icon, label, value, wide = false }: { icon: string; label: string; value: string; wide?: boolean }) {
  return (
    <div data-gauge className={`sunk flex min-w-0 items-center gap-2 bg-night-900 p-1.5 ${wide ? 'col-span-2' : ''}`}>
      <Sprite id={icon} />
      <div className="min-w-0">
        <div className="pixel text-[16px] leading-tight">{value}</div>
        <div className="text-[11px] leading-tight text-ink-200">{label}</div>
      </div>
    </div>
  );
}

/** The colour of the block a clipping's picture sits on, by what the headline is about. */
const TOPIC: Record<Headline['topic'], string> = {
  regime: 'bg-gold-500',
  crypto: 'bg-gold-700',
  rates: 'bg-sky-300',
  inflation: 'bg-wine-300',
  property: 'bg-teal-300',
  asset: 'bg-teal-500',
  taxes: 'bg-wine-500',
  noise: 'bg-ink-300',
  government: 'bg-sky-200',
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
  const name = (member: { name: string | null; userId: string }) => member.name ?? t('nameless', { tag: member.userId.slice(0, 4).toUpperCase() });
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
  if (!view) return null;
  const world = view.timeline[view.round];
  // In a game with friends the paper tells of the players themselves; alone, of the people the player grew up with, now and then.
  const story = players ? roomStory(players) : null;
  const gossip = players === null && people ? rivalNews(people.rivals, history, view.round) : null;
  const told = story ? storyText(room, story, view.round) : gossip && people ? r(`stories.${gossip.story}`, { who: people.who(gossip.rival) }) : null;

  return (
    <div className="flex flex-col gap-3">
      <CrisisBar crisis={world.crisis} />
      {/* A newspaper, thrown onto the table once a round, spinning: masthead, the double rule of its border, and its stories. */}
      <section key={view.round} aria-label={t('title')} className="animate-paper border-2 border-ink-900 bg-cream px-3.5 pb-2 pt-2.5 text-ink-900 shadow-[inset_0_0_0_3px_var(--color-cream),inset_0_0_0_4px_var(--color-ink-900),4px_4px_0_rgb(0_0_0/0.45)]">
        <h2 className="sr-only">{t('title')}</h2>
        <header className="text-center">
          <p className="pixel text-[26px] leading-none tracking-wide">{t('paper')}</p>
          <div aria-hidden className="mt-1.5 h-[3px] bg-ink-900" />
          <p className="pixel flex justify-between py-0.5 text-[12px] uppercase tracking-[0.12em] text-ink-500">
            <span>{names.cities[view.player.cityId]}</span>
            <span>{t('issue', { n: view.round + 1 })}</span>
          </p>
          <div aria-hidden className="h-px bg-ink-900" />
        </header>
        <ul>
          {world.news.map((h, i) => (
            // One story after another, each under a rule, as the columns of a page.
            <li key={i} className={`flex items-center gap-2.5 py-1.5 ${i > 0 ? 'border-t border-dashed border-ink-300' : ''}`}>
              <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center overflow-hidden border border-ink-900 p-1 ${TOPIC[h.topic]}`}>
                <Sprite id={topicArt[h.topic]} />
              </span>
              <span className="min-w-0">
                <span data-topic className="pixel block text-[11px] uppercase leading-none tracking-[0.12em] text-ink-500">
                  {t(`topics.${h.topic}`)}
                </span>
                <span className="mt-0.5 block text-[15px] font-semibold leading-tight">{headlineText(words, h, view.round + i)}</span>
              </span>
            </li>
          ))}
          {told ? (
            <li className="flex items-center gap-2.5 border-t border-dashed border-ink-300 py-1.5">
              {/* A story of the game with friends shows the rat it is about. */}
              {story ? (
                <RatAvatar colour={ratColourOf(story.who.avatar, story.who.userId)} size="md" />
              ) : (
                <span aria-hidden className="flex size-11 shrink-0 items-center justify-center overflow-hidden border border-ink-900 bg-gold-200 p-1">
                  <Sprite id="icon.percentile" />
                </span>
              )}
              <span className="min-w-0">
                <span data-topic className="pixel block text-[11px] uppercase leading-none tracking-[0.12em] text-ink-500">
                  {story ? room('paperTopic') : r('topic')}
                </span>
                <span className="mt-0.5 block text-[15px] font-semibold leading-tight">{told}</span>
              </span>
            </li>
          ) : null}
        </ul>
      </section>

      <Panel>
        <div className="grid grid-cols-2 gap-2">
          <Gauge icon="icon.rates" label={t('rates')} value={fmt.rate(world.policyRateBp)} />
          <Gauge icon="icon.inflation" label={t('inflation')} value={fmt.rate(world.inflationBp)} />
          <Gauge icon="icon.mood" label={t('economy')} value={text.regimes[world.regime]} wide />
          <Gauge icon="icon.crypto" label={t('crypto')} value={text.cryptoPhases[world.cryptoPhase]} wide />
        </div>
      </Panel>
    </div>
  );
}

/** The news as a phone shows it: the headlines and the gauges. How the last ones turned out is for the player to work out. */
export function NewsPanel() {
  return <Headlines />;
}

/** How a round opens on a wide screen, where the headlines already sit at the side. */
export function RoundOpener() {
  const t = useT('news');
  const common = useT('common');
  const { content, names } = useWords();
  const view = useGame((s) => s.view);
  if (!view) return null;

  return (
    <div className="flex flex-col gap-3">
      <CityBanner cityId={view.player.cityId} light="day" />
      <Panel className="text-center">
        <p className="pixel text-[13px] uppercase tracking-wider text-ink-300">{common('round', { n: view.round + 1, total: content.rounds })}</p>
        <p className="pixel mt-1 text-[32px] leading-none text-gold-500">{common('age', { age: ageAt(content, view.round) })}</p>
        <p className="mt-1 text-ink-200">{names.cities[view.player.cityId]}</p>
        <p className="mx-auto mt-3 max-w-sm text-[13px] text-ink-300">{t('opener')}</p>
      </Panel>
    </div>
  );
}
