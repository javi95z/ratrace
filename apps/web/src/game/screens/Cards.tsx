'use client';

import { cardArt } from '@ratrace/content';
import { previewCard } from '@ratrace/engine';
import type { CardDef, GameEvent, OptionPreview } from '@ratrace/engine';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { useMemo } from 'react';
import { useGame, useSettings, useT, useWords } from '@/game/context';
import { chancePct, effectTags } from '@/game/present';
import type { EffectTag } from '@/game/present';
import { Panel, Tag } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

/** How far a card must be dragged before letting go answers it. */
const SWIPE = 90;

function Tags({ cash, tags, empty }: { cash: number; tags: EffectTag[]; empty?: string }) {
  const { fmt } = useWords();
  if (cash === 0 && tags.length === 0) return empty ? <span className="text-[12px] text-ink-300">{empty}</span> : null;
  return (
    <span className="flex flex-wrap gap-1">
      {cash !== 0 ? <Tag tone={cash > 0 ? 'good' : 'bad'}>{fmt.signed(cash)}</Tag> : null}
      {tags.map((tag, i) => (
        <Tag key={i} tone={tag.tone}>
          {tag.text}
        </Tag>
      ))}
    </span>
  );
}

/** One option of a card: its label, what it costs and does, and the odds of each thing it may bring. */
function Option({ def, index, preview, onPick, disabled }: { def: CardDef; index: number; preview: OptionPreview; onPick(): void; disabled: boolean }) {
  const t = useT('cards');
  const effects = useT('effects');
  const words = useWords();
  const world = useGame((s) => s.view?.timeline[s.view.round]);
  if (!world) return null;
  const option = def.options[index];
  const written = words.text.cards[def.id].options[index];
  let total = 0;
  for (const outcome of preview.outcomes) total += outcome.weight;

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled || !preview.available}
      className="frame-raised flex min-h-11 w-full flex-col gap-1.5 bg-night-700 px-3 py-2 text-left transition-transform active:translate-y-[2px] disabled:opacity-50"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="pixel text-[16px]">{written.label}</span>
        {preview.available ? null : <Tag tone="bad">{t('locked')}</Tag>}
      </span>
      <Tags cash={preview.cash} tags={effectTags(words, effects, world, option.effects)} />
      {(option.outcomes ?? []).map((outcome, k) => (
        <span key={k} className="flex items-start gap-2">
          <span className="pixel w-12 shrink-0 text-right text-[13px] text-gold-500">{t('chance', { pct: chancePct(preview.outcomes[k].weight, total) })}</span>
          <Tags cash={preview.outcomes[k].cash} tags={effectTags(words, effects, world, outcome.effects)} empty={t('nothing')} />
        </span>
      ))}
    </button>
  );
}

/** The card on screen. A card with two options can be swiped; every card can be answered with a tap. */
export function CardStage() {
  const t = useT('cards');
  const { content, text } = useWords();
  const { reducedMotion } = useSettings();
  const view = useGame((s) => s.view);
  const busy = useGame((s) => s.busy);
  const pick = useGame((s) => s.pick);
  const x = useMotionValue(0);
  const tilt = useTransform(x, [-160, 160], [-6, 6]);

  // The card to answer is the next one of the hand, judged as the player stands after the ones before it.
  const waiting = view !== null && view.phase === 'cards';
  const cardId = waiting ? view.hand[view.answered] : undefined;
  const def = content.cards.find((card) => card.id === cardId);
  const previews = useMemo(() => (view && def && waiting ? previewCard(content, view, def.id) : []), [content, view, def, waiting]);
  if (!view || !def) return null;

  const written = text.cards[def.id];
  const swipeable = def.options.length === 2 && !reducedMotion && !busy;

  return (
    <div className="flex flex-col gap-3 px-3">
      <p className="pixel text-center text-[13px] text-ink-300">
        {t('progress', { n: view.answered + 1, total: view.hand.length })} · {def.category === 'world' ? t('world') : text.categories[def.category]}
      </p>

      <motion.article
        key={def.id}
        drag={swipeable ? 'x' : false}
        dragSnapToOrigin
        dragElastic={0.6}
        style={{ x, rotate: tilt, width: 'calc(288px * var(--art) + 4px)' }}
        onDragEnd={(_, info) => {
          if (info.offset.x > SWIPE && previews[1]?.available) void pick(1);
          else if (info.offset.x < -SWIPE) void pick(0);
        }}
        className="frame frame-cream mx-auto animate-rise touch-pan-y bg-cream text-ink-900"
      >
        <div className="border-2 border-cream leading-[0]">
          <Sprite id={cardArt[def.id] ?? ''} scale="art" fallback={{ w: 288, h: 120 }} />
        </div>
        <div className="px-3 pb-3 pt-2">
          <h2 className="pixel text-[19px]">{written.title}</h2>
          <p className="mt-1 text-[14px] leading-snug text-ink-700">{written.body}</p>
        </div>
      </motion.article>

      <div role="group" aria-label={t('choices', { title: written.title })} className="flex flex-col gap-2.5">
        {def.options.map((_, i) => (
          <Option key={`${def.id}-${i}`} def={def} index={i} preview={previews[i]} onPick={() => void pick(i)} disabled={busy} />
        ))}
      </div>
      {swipeable ? (
        // A swipe cannot be taken back, so each side says what it picks. The buttons above say the same to a screen reader.
        <div aria-hidden className="flex items-start justify-between gap-3 text-[12px] text-ink-300">
          <span className="min-w-0 flex-1 truncate text-left">← {written.options[0].label}</span>
          <span className={`min-w-0 flex-1 truncate text-right ${previews[1]?.available ? '' : 'line-through'}`}>{written.options[1].label} →</span>
        </div>
      ) : null}
      {swipeable ? <p className="text-center text-[12px] text-ink-300">{t('swipe')}</p> : null}
    </div>
  );
}

/** What the card just answered did: the choice made, what the dice said, and the money. */
export function Outcome() {
  const t = useT('cards');
  const { text, fmt } = useWords();
  const events = useGame((s) => s.cardEvents);
  const cards = events.filter((e): e is Extract<GameEvent, { kind: 'card' }> => e.kind === 'card');
  const money = events.filter((e): e is Extract<GameEvent, { kind: 'ledger' }> => e.kind === 'ledger');

  return (
    <div className="flex flex-col gap-3 px-3">
      <h2 className="pixel text-center text-[20px] text-gold-500">{t('results')}</h2>
      {cards.map((event) => {
        const written = text.cards[event.cardId];
        const option = written.options[event.option];
        return (
          <Panel key={event.cardId} className="animate-rise">
            <div className="flex items-start justify-between gap-3">
              <h3 className="pixel text-[16px]">{written.title}</h3>
              {event.cash !== 0 ? <Tag tone={event.cash > 0 ? 'good' : 'bad'}>{fmt.signed(event.cash)}</Tag> : null}
            </div>
            <p className="mt-1 text-[13px] text-ink-300">{t('chose', { label: option.label })}</p>
            {event.outcome !== null ? <p className="mt-1.5 text-[15px] leading-snug">{option.outcomes[event.outcome]}</p> : null}
          </Panel>
        );
      })}
      {money.length > 0 ? (
        <Panel>
          {money.map((event, i) => (
            <div key={i} className="flex justify-between gap-3 py-0.5 text-[14px]">
              <span>{text.ledger[event.line]}</span>
              <span className="pixel">{fmt.signed(event.amount)}</span>
            </div>
          ))}
        </Panel>
      ) : null}
    </div>
  );
}
