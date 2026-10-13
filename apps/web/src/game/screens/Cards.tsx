'use client';

import { cardArt } from '@ratrace/content';
import { previewCard } from '@ratrace/engine';
import type { CardDef, GameEvent, OptionPreview, WorldState } from '@ratrace/engine';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { useMemo, useState } from 'react';
import { useGame, useSettings, useT, useWords } from '@/game/context';
import { chancePct, effectTags } from '@/game/present';
import type { EffectTag } from '@/game/present';
import { Button, Panel, Tag } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { Celebrations } from './Celebrations';

/** How far a card must be dragged before letting go answers it. */
const SWIPE = 90;

function Tags({ cash, tags, empty, className = '' }: { cash: number; tags: EffectTag[]; empty?: string; className?: string }) {
  const { fmt } = useWords();
  if (cash === 0 && tags.length === 0) return empty ? <span className={`text-[12px] text-ink-300 ${className}`}>{empty}</span> : null;
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {cash !== 0 ? <Tag tone={cash > 0 ? 'good' : 'bad'}>{fmt.signed(cash)}</Tag> : null}
      {tags.map((tag, i) => (
        <Tag key={i} tone={tag.tone}>
          {tag.text}
        </Tag>
      ))}
    </span>
  );
}

/** What one option of a card offers: its label, what it costs and does, and the odds of each thing it may bring. */
function Offer({ def, index, preview, world }: { def: CardDef; index: number; preview: OptionPreview; world: WorldState }) {
  const t = useT('cards');
  const effects = useT('effects');
  const words = useWords();
  const option = def.options[index];
  const written = words.text.cards[def.id].options[index];
  let total = 0;
  for (const outcome of preview.outcomes) total += outcome.weight;
  // What cannot be chosen is dimmed part by part, not as a whole: the reason it is locked must stay easy to read.
  const dim = preview.available ? '' : 'opacity-50';

  return (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className={`pixel text-[16px] ${dim}`}>{written.label}</span>
        {preview.available ? null : <Tag tone="bad">{t('locked')}</Tag>}
      </span>
      {/* Why it is locked is the engine's to say. */}
      {preview.lock ? <span className="text-[13px] leading-snug text-cream">{words.text.optionLocks[preview.lock]}</span> : null}
      <Tags cash={preview.cash} tags={effectTags(words, effects, world, option.effects)} className={dim} />
      {(option.outcomes ?? []).map((outcome, k) => (
        <span key={k} className={`flex items-start gap-2 ${dim}`}>
          <span className="pixel w-12 shrink-0 text-right text-[13px] text-gold-500">{t('chance', { pct: chancePct(preview.outcomes[k].weight, total) })}</span>
          <Tags cash={preview.outcomes[k].cash} tags={effectTags(words, effects, world, outcome.effects)} empty={t('nothing')} />
        </span>
      ))}
    </>
  );
}

/** One option of a card, to be chosen. */
function Option({ def, index, preview, onPick, disabled }: { def: CardDef; index: number; preview: OptionPreview; onPick(): void; disabled: boolean }) {
  const world = useGame((s) => s.view?.timeline[s.view.round]);
  if (!world) return null;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled || !preview.available}
      className="frame-raised flex min-h-11 w-full flex-col gap-1.5 bg-night-700 px-3 py-2 text-left transition-transform enabled:active:translate-y-[2px]"
    >
      <Offer def={def} index={index} preview={preview} world={world} />
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

/**
 * What the card just answered did: its picture again, the choice made and what followed from it,
 * what the dice said when there were dice, everything it changed, and, for whoever wants to know,
 * what the other options offered. Nothing is worked out here: the figures are the engine's.
 */
export function Outcome() {
  const t = useT('cards');
  const effects = useT('effects');
  const common = useT('common');
  const words = useWords();
  const { content, text, fmt } = words;
  const events = useGame((s) => s.cardEvents);
  const offered = useGame((s) => s.offered);
  const [others, setOthers] = useState(false);
  const cards = events.filter((e): e is Extract<GameEvent, { kind: 'card' }> => e.kind === 'card');
  const money = events.filter((e): e is Extract<GameEvent, { kind: 'ledger' }> => e.kind === 'ledger');

  return (
    <div className="flex flex-col gap-3 px-3">
      <h2 className="pixel text-center text-[20px] text-gold-500">{t('results')}</h2>
      <Celebrations />
      {cards.map((event) => {
        const def = content.cards.find((card) => card.id === event.cardId);
        const written = text.cards[event.cardId];
        const option = written.options[event.option];
        const chosen = def?.options[event.option];
        const rolled = event.outcome === null ? undefined : chosen?.outcomes?.[event.outcome];
        // The card as it stood when it was answered. Without it, as after a reload, the result is told without the odds.
        const was = offered && offered.cardId === event.cardId ? offered : null;
        const world = was?.world;
        const odds = was?.options[event.option]?.outcomes ?? [];
        let total = 0;
        for (const outcome of odds) total += outcome.weight;
        const tags = world ? [...effectTags(words, effects, world, chosen?.effects), ...effectTags(words, effects, world, rolled?.effects)] : [];
        const rest = def && was ? def.options.map((_, i) => i).filter((i) => i !== event.option) : [];

        return (
          <div key={event.cardId} className="flex flex-col gap-3">
            {/* As wide as its picture, like the card it was. */}
            <article className="frame frame-cream mx-auto max-w-full animate-rise bg-cream text-ink-900" style={{ width: 'calc(288px * var(--art) + 4px)' }}>
              <div className="border-2 border-cream leading-[0]">
                <Sprite id={cardArt[event.cardId] ?? ''} scale="art" fallback={{ w: 288, h: 120 }} />
              </div>
              <div className="px-3 pb-3 pt-2">
                <h3 className="pixel text-[19px]">{written.title}</h3>
                <p className="pixel mt-0.5 text-[13px] uppercase tracking-wider text-ink-500">{t('chose', { label: option.label })}</p>
                {/* What followed: the line of the outcome the dice gave, or the line of the choice itself. */}
                <p className="mt-2 text-[15px] leading-snug">{event.outcome !== null ? option.outcomes[event.outcome] : option.after}</p>
                {event.outcome !== null && total > 0 ? (
                  <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-700">
                    <span className="pixel bg-ink-900 px-1.5 py-0.5 text-[13px] text-gold-500">{t('chance', { pct: chancePct(odds[event.outcome]?.weight ?? 0, total) })}</span>
                    {t('rolled')}
                  </p>
                ) : null}
              </div>
            </article>

            <Panel title={t('changes')} label={t('changes')} className="animate-rise">
              <Tags cash={event.cash} tags={tags} empty={t('nothing')} />
            </Panel>

            {rest.length > 0 && def && was ? (
              <>
                <Button variant="quiet" wide aria-haspopup="dialog" onClick={() => setOthers(true)} className="text-[15px]">
                  {t('others')}
                </Button>
                <Sheet open={others} onClose={() => setOthers(false)} title={t('others')} closeLabel={common('close')}>
                  <p className="mb-3 text-[13px] text-ink-300">{t('othersHint')}</p>
                  <ul className="flex flex-col gap-2.5">
                    {rest.map((i) => (
                      <li key={i} className="frame flex flex-col gap-1.5 bg-night-700 px-3 py-2">
                        <Offer def={def} index={i} preview={was.options[i]} world={was.world} />
                      </li>
                    ))}
                  </ul>
                </Sheet>
              </>
            ) : null}
          </div>
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
