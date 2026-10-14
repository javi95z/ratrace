'use client';

import { assetKind, debtArt, itemArt, propertyArt } from '@ratrace/content';
import { assetYieldBp, cashflowLines, debtRateBp, depositRateBp, homeOf, netWorth, quoteOwnedProperty, realNetWorth } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import type { ReactNode } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { ageAt, debtLabel } from '@/game/present';
import { Bare, Panel, Row, Tag, TickerBadge } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { WorthGraph } from './WorthGraph';

/** The lines of the balance sheet. Each opens what it is made of. */
export type BalanceLine = 'cash' | 'savings' | 'pension' | 'investments' | 'homes' | 'businesses' | 'things' | 'debts' | 'netWorth';

/** The groups the market files investments under, in its order, with the name each has there. */
const KINDS = [
  ['fund', 'funds'],
  ['bond', 'bonds'],
  ['stock', 'stocks'],
  ['crypto', 'crypto'],
  ['gold', 'gold'],
] as const;

const About = ({ children }: { children: ReactNode }) => <p className="text-[14px] leading-snug">{children}</p>;
const Note = ({ children }: { children: ReactNode }) => <p className="text-[12px] leading-snug text-ink-300">{children}</p>;
const Empty = ({ children }: { children: ReactNode }) => <p className="frame bg-night-700 px-3 py-2 text-[14px] text-ink-300">{children}</p>;
/** A gain in green, a loss in red, with its sign. */
const Gain = ({ cents, text }: { cents: number; text: string }) => <span className={cents < 0 ? 'text-wine-300' : 'text-teal-300'}>{text}</span>;

/**
 * One line of the balance sheet, opened: what it is, and everything it is made of. To be read:
 * buying, selling and repaying are done in the finances. `onItem` opens one thing of those owned.
 */
export function BalanceSheet({ line, shown, onClose, onItem }: { line: BalanceLine; shown: GameView; onClose(): void; onItem(itemId: string): void }) {
  const t = useT('balance');
  const profile = useT('profile');
  const common = useT('common');
  const market = useT('finance.market');
  const estate = useT('finance.property');
  const debtText = useT('finance.debt');
  const end = useT('end');
  const words = useWords();
  const { content, text, names, fmt } = words;
  const history = useGame((s) => s.history);
  const p = shown.player;
  const world = shown.timeline[shown.round];
  const flows = cashflowLines(content, shown);
  const perYear = (cents: number) => common('perYear', { amount: fmt.money(cents) });

  let body: ReactNode;
  switch (line) {
    case 'cash':
      body = (
        <>
          <About>{t('cash.about')}</About>
          <Panel>
            <Row left={profile('cash')} right={fmt.money(p.cash)} />
          </Panel>
          <Note>{t('cash.note')}</Note>
        </>
      );
      break;

    case 'savings':
      body = (
        <>
          <About>{t('savings.about')}</About>
          <Panel>
            <Row left={t('balance')} right={fmt.money(p.deposit)} />
            <Row left={t('savings.rate')} right={t('rate', { rate: fmt.rate(depositRateBp(content, world)) })} />
            <Row left={t('savings.earns')} right={<Gain cents={flows.interest} text={perYear(flows.interest)} />} />
          </Panel>
          <Note>{t('savings.note')}</Note>
        </>
      );
      break;

    case 'pension':
      body = (
        <>
          <About>{t('pension.about')}</About>
          <Panel>
            <Row left={t('balance')} right={fmt.money(p.pension)} />
            <Row left={t('pension.follows')} right={<span className="font-sans text-[13px]">{names.assets[content.pensionAssetId].name}</span>} />
            <Row left={t('pension.unlocks')} right={common('age', { age: ageAt(content, content.rounds) })} />
          </Panel>
          <Note>{t('pension.note')}</Note>
        </>
      );
      break;

    case 'investments': {
      const held = content.assets.filter((asset) => Object.hasOwn(p.positions, asset.id) && p.positions[asset.id].value > 0);
      body = (
        <>
          <About>{t('investments.about')}</About>
          {held.length === 0 ? <Empty>{t('investments.none')}</Empty> : null}
          {KINDS.map(([kind, name]) => {
            const group = held.filter((asset) => assetKind(asset) === kind);
            if (group.length === 0) return null;
            return (
              <Panel key={kind} title={market(name)} label={market(name)}>
                <ul className="flex flex-col gap-2">
                  {group.map((asset) => {
                    const position = p.positions[asset.id];
                    const gain = position.value - position.basis;
                    const pays = assetYieldBp(asset, world);
                    return (
                      <li key={asset.id} className="flex items-center gap-3">
                        <TickerBadge ticker={names.assets[asset.id].ticker} kind={asset.class} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{names.assets[asset.id].name}</div>
                          <div className="text-[12px]">
                            <Gain cents={gain} text={t(gain < 0 ? 'investments.loss' : 'investments.gain', { amount: fmt.money(Math.abs(gain)) })} />
                            {pays > 0 ? <span className="text-ink-300"> · {market('yield', { rate: fmt.rate(pays) })}</span> : null}
                          </div>
                        </div>
                        <span className="pixel shrink-0">{fmt.money(position.value)}</span>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            );
          })}
          <Note>{t('investments.note')}</Note>
        </>
      );
      break;
    }

    case 'homes': {
      const home = homeOf(p, content);
      body = (
        <>
          <About>{t('homes.about')}</About>
          {p.properties.length === 0 ? <Empty>{estate('ownedNone')}</Empty> : null}
          <ul className="flex flex-col gap-2">
            {p.properties.map((property) => {
              const quote = quoteOwnedProperty(content, shown, property.id);
              if (!quote) return null;
              return (
                <li key={property.id} className="frame flex items-center gap-3 bg-night-700 p-2">
                  <Bare className="shrink-0">
                    <Sprite id={propertyArt(property.typeId)} fallback={{ w: 128, h: 128 }} />
                  </Bare>
                  <div className="min-w-0 flex-1">
                    <div className="pixel text-[16px]">{text.propertyTypes[property.typeId]}</div>
                    <div className="text-[12px] text-ink-300">
                      {names.cities[property.cityId]} · {property.rented ? estate('rented') : home?.id === property.id ? estate('livedIn') : estate('empty')}
                    </div>
                    <Row className="!py-0.5" left={estate('worth')} right={<span className="text-gold-500">{fmt.money(quote.value)}</span>} />
                    {quote.mortgage ? <Row className="!py-0.5" left={estate('owed')} right={<span className="text-wine-300">{fmt.money(quote.mortgage.principal)}</span>} /> : null}
                    {quote.rented ? <Row className="!py-0.5" left={estate('rent')} right={<span className="text-teal-300">{fmt.signed(quote.rentAnnual)}</span>} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <Note>{t('homes.note')}</Note>
        </>
      );
      break;
    }

    case 'businesses':
      body = (
        <>
          <About>{t('businesses.about')}</About>
          {p.businesses.length === 0 ? <Empty>{profile('nothing')}</Empty> : null}
          <ul className="flex flex-col gap-1.5">
            {p.businesses.map((business) => (
              <li key={business.id} className="frame flex min-h-11 items-center gap-3 bg-night-700 px-2 py-1">
                <Bare className="size-9">
                  <Sprite id="icon.business" />
                </Bare>
                <span className="min-w-0 flex-1 truncate">{text.businessTypes[business.typeId].name}</span>
                <span className="pixel shrink-0">{fmt.money(business.capital)}</span>
              </li>
            ))}
          </ul>
          <Note>{t('businesses.note')}</Note>
        </>
      );
      break;

    case 'things': {
      const owned = [...p.life.items].sort((a, b) => b.value - a.value);
      body = (
        <>
          <About>{t('things.about')}</About>
          {owned.length === 0 ? <Empty>{profile('nothing')}</Empty> : null}
          <ul className="flex flex-col gap-1.5">
            {owned.map((item) => (
              <li key={item.itemId}>
                <button type="button" aria-haspopup="dialog" onClick={() => onItem(item.itemId)} className="frame flex min-h-11 w-full items-center gap-3 bg-night-700 px-2 py-1 text-left">
                  <Bare className="size-10 overflow-hidden">
                    <Sprite id={itemArt(item.itemId)} fallback={{ w: 64, h: 64 }} className="max-h-full max-w-full object-contain" />
                  </Bare>
                  <span className="min-w-0 flex-1 truncate">{names.items[item.itemId]}</span>
                  <span className="pixel shrink-0">{item.value > 0 ? fmt.money(item.value) : t('things.noValue')}</span>
                </button>
              </li>
            ))}
          </ul>
          <Note>{t('things.note')}</Note>
        </>
      );
      break;
    }

    case 'debts':
      body = (
        <>
          <About>{t('debts.about')}</About>
          {p.debts.length === 0 ? <Empty>{debtText('none')}</Empty> : null}
          <ul className="flex flex-col gap-2">
            {p.debts.map((debt) => (
              <li key={debt.id} className="frame bg-night-700 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <Bare className="size-8">
                      <Sprite id={debtArt(debt)} />
                    </Bare>
                    <span className="pixel min-w-0 text-[16px]">{debtLabel(words, debt, p.properties)}</span>
                  </span>
                  <span className="pixel text-wine-300">{fmt.money(debt.principal)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Tag tone="bad">{t('rate', { rate: fmt.rate(debtRateBp(debt, content, world, p)) })}</Tag>
                  <Tag>{debtText('left', { rounds: debt.kind === 'creditCard' ? 0 : debt.roundsLeft })}</Tag>
                </div>
              </li>
            ))}
          </ul>
          {p.debts.length > 0 ? (
            <Panel>
              <Row left={t('debts.yearly')} right={<span className="text-wine-300">{perYear(flows.debt)}</span>} />
            </Panel>
          ) : null}
          <Note>{t('debts.note')}</Note>
        </>
      );
      break;

    case 'netWorth':
      body = (
        <>
          <About>{t('netWorth.about')}</About>
          <Panel>
            <Row left={profile('netWorth')} right={<span className="text-gold-500">{fmt.money(netWorth(p))}</span>} />
            <Row left={end('realNetWorth')} sub={t('netWorth.realHint')} right={fmt.money(realNetWorth(shown))} />
          </Panel>
          {history.length > 1 ? (
            <Panel>
              <WorthGraph history={history} label={end('graph')} />
              <p className="mt-2 text-center text-[12px] text-ink-300">{end('graph')}</p>
            </Panel>
          ) : null}
        </>
      );
      break;
  }

  return (
    <Sheet open onClose={onClose} title={t(`${line}.title`)} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">{body}</div>
    </Sheet>
  );
}
