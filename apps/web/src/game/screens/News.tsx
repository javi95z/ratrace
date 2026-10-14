'use client';

import { topicArt } from '@ratrace/content';
import type { Headline } from '@ratrace/engine';
import { useGame, useT, useWords } from '@/game/context';
import { ageAt, headlineText } from '@/game/present';
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
};

/** How many columns of opinion there are to take turns. */
const GOSSIP = 8;

/** The headlines about the next two years, and the gauges of the economy. */
export function Headlines({ hint = true }: { hint?: boolean }) {
  const t = useT('news');
  const words = useWords();
  const { text, fmt } = words;
  const view = useGame((s) => s.view);
  if (!view) return null;
  const world = view.timeline[view.round];

  return (
    <div className="flex flex-col gap-3">
      <CrisisBar crisis={world.crisis} />
      <Panel title={t('title')} label={t('title')}>
        <ul className="flex flex-col gap-2.5">
          {world.news.map((h, i) => (
            // A newspaper clipping: what it is about on the left, in a picture, and the headline beside it.
            <li key={i} className="frame frame-cream flex bg-cream text-ink-900">
              <span aria-hidden className={`flex w-11 shrink-0 items-center justify-center ${TOPIC[h.topic]}`}>
                <Sprite id={topicArt[h.topic]} />
              </span>
              <span className="min-w-0 px-2.5 py-2">
                <span data-topic className="pixel block text-[13px] uppercase tracking-[0.1em] text-ink-500">
                  {t(`topics.${h.topic}`)}
                </span>
                <span className="block text-[15px] font-semibold leading-snug">{headlineText(words, h)}</span>
              </span>
            </li>
          ))}
        </ul>
        {/* One column of opinion under the news, for a smile: it is not news, and says nothing of what is coming. */}
        <p className="mt-2.5 border-l-4 border-ink-500 pl-2.5 text-[13px] leading-snug">
          <span className="pixel block text-[12px] uppercase tracking-[0.1em] text-ink-300">{t('gossip.label')}</span>
          <span className="italic text-ink-200">{t(`gossip.${view.round % GOSSIP}`)}</span>
        </p>
        {hint ? <p className="mt-2.5 text-[12px] text-ink-200">{t('hint')}</p> : null}
      </Panel>

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
