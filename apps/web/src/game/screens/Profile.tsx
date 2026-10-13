'use client';

import { familyArt, itemArt } from '@ratrace/content';
import { cashflow, focusLeft, homeOf, netWorth, quoteItem } from '@ratrace/engine';
import type { GameView, InsuranceKind, OwnedItem } from '@ratrace/engine';
import { useState } from 'react';
import { useSaving, useT, useWords } from '@/game/context';
import { Link } from '@/i18n/navigation';
import { Bare, Panel, Row, Tag } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { useShown } from './Hud';

const INSURANCES: InsuranceKind[] = ['health', 'home', 'life', 'liability'];

/**
 * Who the player is: their job and skills, their family, an income statement and a balance sheet.
 * In the finance phase it already counts the orders in the basket, as every other figure does.
 */
export function ProfileBody() {
  const t = useT('profile');
  const { content, text, names, fmt } = useWords();
  const shown = useShown();
  const p = shown.player;
  const life = p.life;

  const career = life.career ? content.careers.find((c) => c.id === life.career?.id) : undefined;
  const next = career && life.career ? career.levels.at(life.career.level + 1) : undefined;
  const home = homeOf(p, content);
  const insured = INSURANCES.filter((kind) => life.insurance[kind]).map((kind) => text.insurance[kind]);
  const flow = cashflow(content, shown);
  const [open, setOpen] = useState<string | null>(null);
  // Looked up afresh on every draw: a thing sold or lapsed while its sheet is open closes it.
  const opened = life.items.find((owned) => owned.itemId === open);

  let invested = 0;
  for (const held of Object.values(p.positions)) invested += held.value;
  let homes = 0;
  for (const property of p.properties) homes += property.value;
  let things = 0;
  for (const owned of life.items) things += owned.value;
  let owed = 0;
  for (const debt of p.debts) owed += debt.principal;

  return (
    <div className="flex flex-col gap-3">
      <Panel title={t('job')}>
        <Row
          left={<span className="pixel text-[17px]">{life.career ? text.careers[life.career.id].levels[life.career.level] : t('noJob')}</span>}
          sub={life.career ? text.careers[life.career.id].name : undefined}
        />
        {life.career ? <Row left={t('careerSkill')} sub={next ? t('nextLevel', { skill: next.minSkill }) : t('topLevel')} right={fmt.number(life.careerSkill)} /> : null}
        <Row left={t('financeSkill')} right={`${life.financeSkill}/2`} />
        <Row left={t('focus')} right={`${focusLeft(p)}/${life.focusBase}`} />
      </Panel>

      <Panel title={t('family')}>
        <Row
          left={
            <span className="flex items-center gap-2">
              {familyArt({ partner: life.partner, married: Object.hasOwn(life.flags, 'married'), dating: Object.hasOwn(life.flags, 'dating'), children: life.children, childRounds: content.life.childRounds }).map((sprite) => (
                <Sprite key={sprite} id={sprite} />
              ))}
              {/* The words follow the picture: seeing someone is not yet living with them, and neither is being married. */}
              {t(life.partner ? (Object.hasOwn(life.flags, 'married') ? 'married' : 'partner') : Object.hasOwn(life.flags, 'dating') ? 'dating' : 'single')}
            </span>
          }
          right={life.children.length > 0 ? t('children', { count: life.children.length }) : undefined} />
        <Row left={t('lifestyle')} right={text.lifestyleTiers[p.lifestyleTier]} />
        <Row left={t('home')} sub={names.cities[p.cityId]} right={home ? text.propertyTypes[home.typeId] : text.rentTiers[life.rentTier]} />
        <Row left={t('insurance')} right={insured.length > 0 ? <span className="font-sans text-[13px]">{insured.join(', ')}</span> : t('uninsured')} />
      </Panel>

      <Panel title={t('income')}>
        <Row left={t('salary')} right={<span className="text-teal-300">{fmt.signed(flow.salaryAnnual)}</span>} />
        <Row left={t('passive')} right={<span className="text-teal-300">{fmt.signed(flow.passiveAnnual)}</span>} />
        <Row left={t('expenses')} right={<span className="text-wine-300">{fmt.signed(-flow.expensesAnnual)}</span>} />
      </Panel>

      <Panel title={t('balance')}>
        <Row left={t('cash')} right={fmt.money(p.cash)} />
        <Row left={t('savings')} right={fmt.money(p.deposit)} />
        <Row left={t('pension')} right={fmt.money(p.pension)} />
        <Row left={t('investments')} right={fmt.money(invested)} />
        <Row left={t('homes')} right={fmt.money(homes)} />
        <Row left={t('things')} right={fmt.money(things)} />
        <Row left={t('debts')} right={<span className={owed > 0 ? 'text-wine-300' : ''}>{fmt.money(-owed)}</span>} />
        <Row
          className="mt-1 border-t-2 border-night-900 pt-2"
          left={<span className="pixel text-[17px]">{t('netWorth')}</span>}
          right={<span className="text-[19px] text-gold-500">{fmt.money(netWorth(p))}</span>}
        />
      </Panel>

      <Panel title={t('owned')}>
        {life.items.length === 0 ? (
          <p className="text-[14px] text-ink-300">{t('nothing')}</p>
        ) : (
          <ul className="grid grid-cols-4 gap-2">
            {life.items.map((owned) => (
              <li key={owned.itemId}>
                {/* A tap opens what the thing is, what it gives and what it is worth. Buying and selling stay in the shop. */}
                <button type="button" aria-haspopup="dialog" title={names.items[owned.itemId]} onClick={() => setOpen(owned.itemId)} className="block w-full">
                  <Bare className="aspect-square w-full overflow-hidden">
                    <Sprite id={itemArt(owned.itemId)} alt={names.items[owned.itemId]} fallback={{ w: 64, h: 64 }} className="max-w-full" />
                  </Bare>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {opened ? <OwnedSheet owned={opened} shown={shown} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

/** One thing the player owns, looked at closely: what it is, what it gives, what it costs to keep and what it would fetch. */
function OwnedSheet({ owned, shown, onClose }: { owned: OwnedItem; shown: GameView; onClose(): void }) {
  const t = useT('profile');
  const shop = useT('finance.shop');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const item = content.items.find((x) => x.id === owned.itemId);
  if (!item) return null;
  const quote = quoteItem(content, shown, item.id);

  return (
    <Sheet open onClose={onClose} title={names.items[item.id]} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <div className="flex justify-center">
          <Bare className="p-2 leading-[0]">
            <Sprite id={itemArt(item.id)} scale={2} fallback={{ w: 64, h: 64 }} />
          </Bare>
        </div>
        <p className="pixel text-center text-[13px] uppercase tracking-wider text-ink-300">{text.ladders[item.ladder]}</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          <Tag tone="good">{shop('status', { n: item.status })}</Tag>
          {quote.upkeepAnnual > 0 ? <Tag tone="bad">{shop('upkeep', { amount: fmt.money(quote.upkeepAnnual) })}</Tag> : null}
        </div>
        {item.kind === 'durable' ? <p className="text-center text-[14px]">{t('itemWorth', { amount: fmt.money(quote.resale) })}</p> : null}
        {owned.roundsLeft !== null ? <p className="text-center text-[14px] text-ink-300">{shop('spent', { years: owned.roundsLeft * content.yearsPerRound })}</p> : null}
        {quote.local ? <p className="text-center text-[13px] text-ink-300">{shop('local', { city: names.cities[shown.player.cityId] })}</p> : null}
        <p className="text-center text-[12px] text-ink-300">{t(quote.sellable ? 'itemWhere' : 'itemKept')}</p>
      </div>
    </Sheet>
  );
}

/** The profile in a sheet, for a phone, with the way back to the front door. */
export function ProfileSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT('profile');
  const common = useT('common');
  return (
    <Sheet open={open} onClose={onClose} title={t('title')} closeLabel={common('close')}>
      <ProfileBody />
      <Leave />
    </Sheet>
  );
}

/** The way out of a life in progress. Nothing is lost by taking it. */
export function Leave() {
  const t = useT('profile');
  const common = useT('common');
  const saving = useSaving();
  return (
    <div className="mt-3">
      <Link href="/" className="pixel frame-raised flex min-h-11 items-center justify-center bg-night-600 px-3 text-[15px] text-ink-200">
        {t('leave')}
      </Link>
      {saving ? (
        <p className="mt-1.5 text-center text-[12px] text-ink-300">{t('leaveHint')}</p>
      ) : (
        <p role="alert" className="frame mt-2 bg-wine-900 px-3 py-2 text-[13px]">
          {common('notSaved')}
        </p>
      )}
    </div>
  );
}
