'use client';

import { assetKind, itemArt, propertyArt, focusArt, insuranceArt, lifestyleArt, rentTierIcon } from '@ratrace/content';
import type { AssetKind } from '@ratrace/content';
import { assetYieldBp, debtRateBp, depositRateBp, effectiveTax, focusLeft, homeOf, indexed, quoteItem, quoteLiving, quoteLoan, quoteMove, quoteProperty } from '@ratrace/engine';
import type { AssetDef, Debt, FocusAction, InsuranceKind, ItemDef, LifestyleTier, Order, RentTier } from '@ratrace/engine';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { ageAt, orderLabel, priceHistory } from '@/game/present';
import { Bar, Bare, Button, Panel, Row, Segmented, Tag, TickerBadge, TILE, Toggle } from '@/ui/kit';
import { Sheet, Tabs, Toast } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { AmountSheet } from './AmountSheet';
import { useShown } from './Hud';

type TabId = 'portfolio' | 'market' | 'property' | 'debt' | 'lifestyle' | 'shop' | 'taxes';
const TABS: TabId[] = ['portfolio', 'market', 'property', 'debt', 'lifestyle', 'shop', 'taxes'];
const KINDS: AssetKind[] = ['fund', 'bond', 'stock', 'crypto', 'gold'];
const KIND_TITLE: Record<AssetKind, string> = { fund: 'funds', bond: 'bonds', stock: 'stocks', crypto: 'crypto', gold: 'gold' };
const INSURANCES: InsuranceKind[] = ['health', 'home', 'life', 'liability'];

/** The game before this round's orders, the game with them applied, and the preview of the round. */
function useRound() {
  const view = useGame((s) => s.view);
  const preview = useGame((s) => s.preview);
  const shown = useShown();
  if (!view || !preview) throw new Error('the finance phase needs a view and a preview');
  return { view, shown, preview, world: view.timeline[view.round], p: shown.player };
}

// ------------------------------------------------------------------------------------------------
// Portfolio

type Move = { kind: 'save' } | { kind: 'withdraw' } | { kind: 'pension' } | { kind: 'sell'; asset: AssetDef };

function Portfolio() {
  const t = useT('finance.portfolio');
  const amount = useT('finance.amount');
  const { content, names, fmt } = useWords();
  const { p, world, preview } = useRound();
  const addOrder = useGame((s) => s.addOrder);
  const [move, setMove] = useState<Move | null>(null);
  const held = content.assets.filter((asset) => Object.hasOwn(p.positions, asset.id));
  // The most the pension takes this round, from the engine: its cap, the cash there is, and solvency.
  const pensionRoom = preview.pensionRoom;

  const sheet = (() => {
    if (!move) return null;
    const close = () => setMove(null);
    if (move.kind === 'save') return <AmountSheet title={amount('save')} max={p.cash} onClose={close} onConfirm={(a) => addOrder({ type: 'depositIn', amount: a })} />;
    if (move.kind === 'withdraw') return <AmountSheet title={amount('withdraw')} max={p.deposit} onClose={close} onConfirm={(a) => addOrder({ type: 'depositOut', amount: a })} />;
    if (move.kind === 'pension') return <AmountSheet title={amount('pension')} max={pensionRoom} onClose={close} onConfirm={(a) => addOrder({ type: 'pensionIn', amount: a })} />;
    const name = names.assets[move.asset.id].name;
    return (
      <AmountSheet
        title={amount('sell', { name })}
        max={p.positions[move.asset.id]?.value ?? 0}
        onClose={close}
        onConfirm={(a) => addOrder({ type: 'sell', assetId: move.asset.id, amount: a })}
      />
    );
  })();

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <Row left={t('cash')} sub={t('cashHint')} right={fmt.money(p.cash)} />
        <div className="my-1 h-[2px] bg-night-900" />
        <Row left={t('savings')} sub={t('savingsRate', { rate: fmt.rate(depositRateBp(content, world)) })} right={fmt.money(p.deposit)} />
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Button onClick={() => setMove({ kind: 'save' })} disabled={p.cash <= 0}>
            {t('save')}
          </Button>
          <Button onClick={() => setMove({ kind: 'withdraw' })} disabled={p.deposit <= 0}>
            {t('withdraw')}
          </Button>
        </div>
        <div className="my-3 h-[2px] bg-night-900" />
        <Row left={t('pension')} sub={t('pensionHint')} right={fmt.money(p.pension)} />
        <p className="text-[12px] text-ink-300">{pensionRoom > 0 ? t('pensionRoom', { amount: fmt.money(pensionRoom) }) : t('pensionFull')}</p>
        <Button className="mt-2" wide onClick={() => setMove({ kind: 'pension' })} disabled={pensionRoom <= 0}>
          {t('add')}
        </Button>
      </Panel>

      <Panel title={t('holdings')}>
        {held.length === 0 ? <p className="text-[14px] text-ink-300">{t('none')}</p> : null}
        {held.map((asset) => {
          const position = p.positions[asset.id];
          const gain = position.value - position.basis;
          return (
            <div key={asset.id} className="flex items-center gap-3 py-1.5">
              <TickerBadge ticker={names.assets[asset.id].ticker} kind={asset.class} />
              <div className="min-w-0 flex-1">
                <div className="truncate">{names.assets[asset.id].name}</div>
                <div className={`text-[12px] ${gain >= 0 ? 'text-teal-300' : 'text-wine-300'}`}>
                  {t(gain >= 0 ? 'gain' : 'loss', { amount: fmt.money(Math.abs(gain)) })}
                </div>
              </div>
              <div className="pixel text-right">{fmt.money(position.value)}</div>
              <Button onClick={() => setMove({ kind: 'sell', asset })}>{t('sell')}</Button>
            </div>
          );
        })}
      </Panel>
      {sheet}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Market

/** The price of an asset since the start of the life, as a stepped pixel line. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 280;
  const h = 48;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 1);
  const span = max - min || 1;
  const stepX = values.length > 1 ? w / (values.length - 1) : w;
  let path = '';
  values.forEach((value, i) => {
    const x = Math.round(i * stepX);
    const y = Math.round(h - 4 - ((value - min) / span) * (h - 8));
    path += i === 0 ? `M0 ${y}` : ` H${x} V${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="frame w-full bg-night-900" shapeRendering="crispEdges">
      <path d={path} fill="none" stroke="var(--color-gold-500)" strokeWidth="2" />
    </svg>
  );
}

function Market() {
  const t = useT('finance.market');
  const amount = useT('finance.amount');
  const { content, text, names, fmt } = useWords();
  const { view, p, world } = useRound();
  const addOrder = useGame((s) => s.addOrder);
  const [buying, setBuying] = useState<AssetDef | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {KINDS.map((kind) => (
        <Panel key={kind} title={t(KIND_TITLE[kind])}>
          {content.assets
            .filter((asset) => assetKind(asset) === kind)
            .map((asset) => {
              const need = asset.minFinanceSkill ?? 0;
              const locked = need > p.life.financeSkill;
              const change = world.assetReturnBp[asset.id];
              const pays = assetYieldBp(asset, world);
              return (
                <button
                  key={asset.id}
                  type="button"
                  disabled={locked}
                  onClick={() => setBuying(asset)}
                  className="flex min-h-11 w-full items-center gap-3 py-1.5 text-left"
                >
                  {/* Only the badge is dimmed for a locked asset: its name and what unlocks it must stay readable. */}
                  <span className={locked ? 'opacity-50' : ''}>
                    <TickerBadge ticker={names.assets[asset.id].ticker} kind={asset.class} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${locked ? 'text-ink-200' : ''}`}>{names.assets[asset.id].name}</span>
                    <span className={`block text-[12px] ${locked ? 'text-gold-200' : 'text-ink-300'}`}>{locked ? t('needsSkill', { level: need }) : pays > 0 ? t('yield', { rate: fmt.rate(pays) }) : ' '}</span>
                  </span>
                  <span className={`pixel text-right ${view.round === 0 ? 'text-ink-300' : change >= 0 ? 'text-teal-300' : 'text-wine-300'}`}>
                    {view.round === 0 ? '—' : fmt.change(change)}
                  </span>
                </button>
              );
            })}
        </Panel>
      ))}

      {buying ? (
        <AmountSheet
          title={amount('buy', { name: names.assets[buying.id].name })}
          max={p.cash}
          onClose={() => setBuying(null)}
          onConfirm={(a) => addOrder({ type: 'buy', assetId: buying.id, amount: a })}
        >
          <p className="mb-2 text-[14px] text-ink-200">{text.assets[buying.id].blurb}</p>
          <Sparkline values={priceHistory(view, buying.id)} label={t('history')} />
          <div className="mb-3 mt-1 flex justify-between text-[12px] text-ink-300">
            <span>{t('history')}</span>
            {Object.hasOwn(p.positions, buying.id) ? <span>{t('youHold', { amount: fmt.money(p.positions[buying.id].value) })}</span> : null}
          </div>
        </AmountSheet>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Property

function BuyHome({ typeId, onClose }: { typeId: string; onClose(): void }) {
  const t = useT('finance.property');
  const common = useT('common');
  const { content, text, fmt } = useWords();
  const { shown } = useRound();
  const addOrder = useGame((s) => s.addOrder);
  const quote = quoteProperty(content, shown, typeId);
  const [mortgage, setMortgage] = useState<'fixed' | 'variable' | 'none'>(quote.canBorrow ? 'fixed' : 'none');
  const [down, setDown] = useState(quote.minDown);
  // What nobody can live in is bought to let, and there is nothing to choose.
  const [rented, setRented] = useState(quote.rentalOnly);
  const cashDown = mortgage === 'none' ? quote.price : down;
  const step = Math.max(100_000, Math.round(quote.price / 100 / 100_000) * 100_000);

  return (
    <Sheet open onClose={onClose} title={t(quote.rentalOnly ? 'buyLetTitle' : 'buyTitle', { home: text.propertyTypes[typeId] })} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <div className="flex justify-center">
          <Bare className="p-1 leading-[0]">
            <Sprite id={propertyArt(typeId)} fallback={{ w: 128, h: 128 }} />
          </Bare>
        </div>
        <Panel>
          <Row left={t('price')} right={fmt.money(quote.price)} />
          <Row left={t('purchaseTax')} right={fmt.money(quote.purchaseTax)} />
          {rented ? <Row left={t('rent')} right={<span className="text-teal-300">{fmt.signed(quote.rentAnnual)}</span>} /> : null}
        </Panel>

        <div>
          <h3 className="pixel mb-1.5 text-[14px] uppercase tracking-wider text-ink-200">{t('mortgage')}</h3>
          <Segmented<'fixed' | 'variable' | 'none'>
            label={t('mortgage')}
            value={mortgage}
            onChange={setMortgage}
            options={[
              { value: 'fixed', label: t('fixed'), hint: t('rateNow', { rate: fmt.rate(quote.fixedRateBp) }), disabled: !quote.canBorrow },
              { value: 'variable', label: t('variable'), hint: t('rateNow', { rate: fmt.rate(quote.variableRateBp) }), disabled: !quote.canBorrow },
              { value: 'none', label: t('noMortgage') },
            ]}
          />
        </div>

        {mortgage === 'none' ? null : (
          <div>
            <div className="flex items-baseline justify-between">
              <h3 className="pixel text-[14px] uppercase tracking-wider text-ink-200">{t('down')}</h3>
              <span className="pixel text-[17px]">{fmt.money(down)}</span>
            </div>
            <input
              type="range"
              className="range"
              aria-label={t('down')}
              min={quote.minDown}
              max={quote.price - 1}
              step={step}
              value={down}
              onChange={(event) => setDown(Math.max(quote.minDown, Math.min(quote.price - 1, Number(event.target.value))))}
            />
          </div>
        )}

        <div>
          {quote.rentalOnly ? null : (
            <>
              <h3 className="pixel mb-1.5 text-[14px] uppercase tracking-wider text-ink-200">{t('use')}</h3>
              <Segmented<'live' | 'rent'>
                label={t('use')}
                value={rented ? 'rent' : 'live'}
                onChange={(value) => setRented(value === 'rent')}
                options={[
                  { value: 'live', label: t('liveIn') },
                  { value: 'rent', label: t('rentOut'), disabled: !quote.canRentOut },
                ]}
              />
            </>
          )}
          {quote.canRentOut ? null : <p className="mt-1.5 text-[13px] text-ink-200">{t('rentOutLocked', { level: content.life.rentOutMinFinanceSkill })}</p>}
        </div>

        <p className="pixel text-center text-[17px] text-gold-500">{t('payNow', { amount: fmt.money(cashDown + quote.purchaseTax) })}</p>
        <Button
          variant="primary"
          wide
          // Something only a landlord can own is not for sale to anyone else: the line above says why.
          disabled={quote.rentalOnly && !quote.canRentOut}
          onClick={() => {
            if (addOrder({ type: 'buyProperty', typeId, downPayment: mortgage === 'none' ? 0 : down, mortgage, rented })) onClose();
          }}
        >
          {t('buy')}
        </Button>
      </div>
    </Sheet>
  );
}

function PropertyTab() {
  const t = useT('finance.property');
  const { content, text, names, fmt } = useWords();
  const { view, shown, p } = useRound();
  const setOrder = useGame((s) => s.setOrder);
  const addOrder = useGame((s) => s.addOrder);
  const [buying, setBuying] = useState<string | null>(null);
  const home = homeOf(p, content);

  // A home put up for sale this round stays in its place until the round is played: were it to
  // vanish, the next one would slide under the thumb that just pressed "Sell".
  const selling = view.player.properties.filter((before) => !p.properties.some((now) => now.id === before.id));
  const listed = [...view.player.properties.map((before) => p.properties.find((now) => now.id === before.id) ?? before), ...p.properties.filter((now) => !view.player.properties.some((before) => before.id === now.id))];

  return (
    <div className="flex flex-col gap-3">
      <Panel title={t('owned')} label={t('owned')}>
        {listed.length === 0 ? <p className="text-[14px] text-ink-300">{t('ownedNone')}</p> : null}
        {listed.map((property) => {
          const original = view.player.properties.find((x) => x.id === property.id);
          const sold = selling.some((x) => x.id === property.id);
          const mortgage = (sold ? view.player.debts : p.debts).find((d) => d.id === property.mortgageId);
          // Which home the player lives in is the engine's to say: it is one, however many they own in town.
          const state = property.rented ? t('rented') : home?.id === property.id ? t('livedIn') : t('empty');
          const same = (order: Order) => order.type === 'setRented' && order.propertyId === property.id;
          const letOnly = content.propertyTypes.some((type) => type.id === property.typeId && type.rentalOnly === true);
          return (
            <div key={property.id} className="border-b-2 border-night-900 py-2 last:border-b-0">
              <div className="flex items-center gap-3">
                <Bare className="shrink-0">
                  <Sprite id={propertyArt(property.typeId)} fallback={{ w: 128, h: 128 }} />
                </Bare>
                <div className="min-w-0 flex-1">
                  <div className="pixel text-[17px]">{text.propertyTypes[property.typeId]}</div>
                  <div className="text-[13px] text-ink-200">{names.cities[property.cityId]}</div>
                  <div className="pixel mt-1 text-[17px] text-gold-500">{fmt.money(property.value)}</div>
                  <div className="mt-1 text-[12px] text-ink-300">
                    {state}
                    {mortgage ? ` · ${t('mortgageLeft', { amount: fmt.money(mortgage.principal) })}` : ''}
                  </div>
                </div>
              </div>
              {sold ? (
                <Button className="mt-2" wide disabled>
                  {t('selling')}
                </Button>
              ) : original ? (
                <div className={`mt-2 grid gap-2 ${letOnly ? '' : 'grid-cols-2'}`}>
                  {/* What nobody can live in is let for as long as it is owned: there is nothing to switch. */}
                  {letOnly ? null : (
                    <Button onClick={() => setOrder(same, original.rented === !property.rented ? null : { type: 'setRented', propertyId: property.id, rented: !property.rented })}>
                      {property.rented ? t('stopRenting') : t('startRenting')}
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => addOrder({ type: 'sellProperty', propertyId: property.id })}>
                    {t('sell', { amount: fmt.compact(property.value) })}
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </Panel>

      <Panel title={t('title', { city: names.cities[p.cityId] })} label={t('title', { city: names.cities[p.cityId] })}>
        {/* Two side by side on a phone, each drawn whole at its own size; more where the column is wider. */}
        <div className="grid grid-cols-2 gap-2 @min-[560px]:grid-cols-3">
          {content.propertyTypes.map((type) => {
            const quote = quoteProperty(content, shown, type.id);
            return (
              <button key={type.id} type="button" onClick={() => setBuying(type.id)} className={TILE}>
                <Bare className="w-full py-1">
                  <Sprite id={propertyArt(type.id)} fallback={{ w: 128, h: 128 }} />
                </Bare>
                <span className="mt-0.5 text-[14px] leading-tight">{text.propertyTypes[type.id]}</span>
                <span className="pixel text-[18px] text-gold-500">{fmt.compact(quote.price)}</span>
                <span className="text-[11px] leading-tight text-ink-200">{t('minDown', { amount: fmt.compact(quote.minDown + quote.purchaseTax) })}</span>
                {/* A home says what living in it is worth; what cannot be lived in says what it lets for. */}
                {quote.rentalOnly ? (
                  <>
                    <span className="text-[11px] leading-tight text-teal-300">{t('lets', { amount: fmt.compact(quote.rentAnnual) })}</span>
                    <Tag>{t('letOnly')}</Tag>
                  </>
                ) : (
                  <Tag tone="good">{t('status', { n: type.status })}</Tag>
                )}
              </button>
            );
          })}
        </div>
      </Panel>
      {buying ? <BuyHome typeId={buying} onClose={() => setBuying(null)} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Debt

function DebtTab() {
  const t = useT('finance.debt');
  const amount = useT('finance.amount');
  const { content, text, fmt } = useWords();
  const { shown, p, world } = useRound();
  const addOrder = useGame((s) => s.addOrder);
  const [repaying, setRepaying] = useState<Debt | null>(null);
  const [borrowing, setBorrowing] = useState(false);
  const loan = quoteLoan(content, shown);
  let total = 0;
  for (const debt of p.debts) total += debt.principal;

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        {p.debts.length === 0 ? <p className="text-[14px] text-ink-300">{t('none')}</p> : <Row left={t('total')} right={fmt.money(total)} />}
        {p.debts.map((debt) => (
          <div key={debt.id} className="flex items-center gap-3 border-t-2 border-night-900 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate">{text.debts[debt.kind]}</div>
              <div className="text-[12px] text-ink-300">
                {t('rate', { rate: fmt.rate(debtRateBp(debt, content, world, p)) })} · {t('left', { rounds: debt.kind === 'creditCard' ? 0 : debt.roundsLeft })}
              </div>
            </div>
            <div className="pixel">{fmt.money(debt.principal)}</div>
            <Button onClick={() => setRepaying(debt)} disabled={p.cash <= 0}>
              {t('repay')}
            </Button>
          </div>
        ))}
      </Panel>

      <Panel>
        {loan.lockedUntilRound !== null ? (
          <p className="text-[14px] text-wine-300">{t('noCredit', { age: ageAt(content, loan.lockedUntilRound) })}</p>
        ) : loan.room <= 0 ? (
          <p className="text-[14px] text-ink-300">{t('borrowNone')}</p>
        ) : (
          <>
            <p className="mb-2 text-[14px] text-ink-200">
              {t('borrowHint', { amount: fmt.money(loan.room), rate: fmt.rate(loan.rateBp), years: loan.termRounds * content.yearsPerRound })}
            </p>
            <Button wide onClick={() => setBorrowing(true)}>
              {t('borrow')}
            </Button>
          </>
        )}
      </Panel>

      {repaying ? (
        <AmountSheet
          title={amount('repay', { name: text.debts[repaying.kind] })}
          max={Math.min(repaying.principal, p.cash)}
          onClose={() => setRepaying(null)}
          onConfirm={(a) => addOrder({ type: 'repay', debtId: repaying.id, amount: a })}
        />
      ) : null}
      {borrowing ? <AmountSheet title={amount('borrow')} max={loan.room} onClose={() => setBorrowing(false)} onConfirm={(a) => addOrder({ type: 'borrow', amount: a })} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Lifestyle

function MoveSheet({ onClose }: { onClose(): void }) {
  const t = useT('finance.lifestyle');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const { shown, p, world } = useRound();
  const setOrder = useGame((s) => s.setOrder);

  return (
    <Sheet open onClose={onClose} title={t('moveTitle')} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        {content.cities.map((city) => {
          const here = city.id === p.cityId;
          const tax = effectiveTax(city, world);
          const { cost } = quoteMove(content, shown, city.id);
          return (
            <Panel key={city.id}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="pixel text-[17px]">{names.cities[city.id]}</h3>
                {here ? <Tag tone="good">{t('here')}</Tag> : null}
              </div>
              <p className="mb-2 text-[13px] text-ink-300">{text.cities[city.id].tagline}</p>
              <Row left={t('medianSalary')} right={fmt.money(indexed(city.medianSalaryAnnual, world))} />
              <Row left={t('livingCost')} right={fmt.money(indexed(city.livingCostAnnual, world))} />
              <Row left={t('incomeTax')} right={tax.incomeRatesBp.map((rate) => fmt.rate(rate)).join(' · ')} />
              <Row left={t('gainsTax')} right={fmt.rate(tax.capitalGainsBp)} />
              {here ? null : (
                <>
                  <p className="mb-2 mt-1 text-[12px] text-ink-300">{t('moveCost', { amount: fmt.money(cost) })}</p>
                  <Button
                    wide
                    onClick={() => {
                      if (setOrder((order) => order.type === 'moveCity', { type: 'moveCity', cityId: city.id })) onClose();
                    }}
                  >
                    {t('moveHere')}
                  </Button>
                </>
              )}
            </Panel>
          );
        })}
      </div>
    </Sheet>
  );
}

function Lifestyle() {
  const t = useT('finance.lifestyle');
  const { content, text, names, fmt } = useWords();
  const { view, shown, p } = useRound();
  const orders = useGame((s) => s.orders);
  const setOrder = useGame((s) => s.setOrder);
  const [moving, setMoving] = useState(false);
  const living = quoteLiving(content, shown);
  const career = p.life.career ? content.careers.find((c) => c.id === p.life.career?.id) : undefined;
  const has = (action: FocusAction) => orders.some((order) => order.type === 'focus' && order.action === action);
  const focus = (action: FocusAction) => (on: boolean) =>
    setOrder((order) => order.type === 'focus' && order.action === action, on ? { type: 'focus', action } : null);
  const left = focusLeft(p);
  const moveOrdered = orders.some((order) => order.type === 'moveCity');
  const common = useT('common');
  const perYear = (cents: number) => common('perYear', { amount: fmt.compact(cents) });

  return (
    <div className="flex flex-col gap-3">
      <Panel title={t('work')}>
        {career ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-ink-300">{t('focusLeft', { left, total: p.life.focusBase })}</p>
            <Toggle on={has('overtime')} onChange={focus('overtime')} disabled={!has('overtime') && left < 1} label={t('overtime')} hint={t('overtimeHint', { pct: career.overtimePct })} icon={focusArt.overtime} />
            <Toggle on={has('studyCareer')} onChange={focus('studyCareer')} disabled={!has('studyCareer') && left < 1} label={t('study')} hint={t('studyHint', { n: content.life.studySkill })} icon={focusArt.studyCareer} />
            <Toggle on={has('jobHunt')} onChange={focus('jobHunt')} disabled={!has('jobHunt') && left < 1} label={t('hunt')} hint={t('huntHint', { pct: content.life.jobHuntChancePct })} icon={focusArt.jobHunt} />
          </div>
        ) : (
          <p className="text-[14px] text-ink-300">{t('noJob')}</p>
        )}
      </Panel>

      <Panel title={t('tier')}>
        <Segmented<LifestyleTier>
          label={t('tier')}
          value={p.lifestyleTier}
          onChange={(tier) => setOrder((order) => order.type === 'setLifestyle', tier === view.player.lifestyleTier ? null : { type: 'setLifestyle', tier })}
          options={([0, 1, 2, 3] as const).map((tier) => ({
            value: tier,
            label: text.lifestyleTiers[tier],
            icon: lifestyleArt[tier],
            hint: perYear(living.tiers[tier]),
            disabled: tier < p.life.minLifestyleTier,
          }))}
        />
        {p.life.minLifestyleTier > 0 ? <p className="mt-2 text-[12px] text-ink-300">{t('tierFloor')}</p> : null}
      </Panel>

      <Panel title={t('home')}>
        {living.rentTiers ? (
          <Segmented<RentTier>
            label={t('home')}
            value={p.life.rentTier}
            onChange={(tier) => setOrder((order) => order.type === 'setRentTier', tier === view.player.life.rentTier ? null : { type: 'setRentTier', tier })}
            options={([0, 1] as const).map((tier) => ({ value: tier, label: text.rentTiers[tier], icon: rentTierIcon[tier], hint: perYear(living.rentTiers?.[tier] ?? 0) }))}
          />
        ) : (
          <p className="text-[14px] text-ink-300">{t('ownerNote')}</p>
        )}
      </Panel>

      <Panel title={t('insurance')}>
        <div className="flex flex-col gap-2">
          {INSURANCES.map((kind) => (
            <Toggle
              key={kind}
              on={p.life.insurance[kind]}
              onChange={(on) =>
                setOrder((order) => order.type === 'setInsurance' && order.insurance === kind, on === view.player.life.insurance[kind] ? null : { type: 'setInsurance', insurance: kind, on })
              }
              label={text.insurance[kind]}
              icon={insuranceArt[kind]}
              hint={common('perYear', { amount: fmt.money(living.insurance[kind]) })}
            />
          ))}
        </div>
      </Panel>

      <Panel title={t('city')}>
        <div className="mb-2 flex items-center gap-3">
          <Bare className="size-9">
            <Sprite id="icon.city" />
          </Bare>
          <div className="min-w-0">
            <div className="pixel text-[18px]">{names.cities[p.cityId]}</div>
            <p className="text-[13px] leading-snug text-ink-200">{text.cities[p.cityId].tagline}</p>
          </div>
        </div>
        {p.life.movingTo ? (
          <>
            <p className="mb-2 text-[14px] text-gold-500">{t('moving', { city: names.cities[p.life.movingTo] })}</p>
            {moveOrdered ? (
              <Button wide onClick={() => setOrder((order) => order.type === 'moveCity', null)}>
                {t('stay')}
              </Button>
            ) : null}
          </>
        ) : (
          <Button wide onClick={() => setMoving(true)}>
            {t('move')}
          </Button>
        )}
      </Panel>
      {moving ? <MoveSheet onClose={() => setMoving(false)} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Shop

function ItemSheet({ item, onClose }: { item: ItemDef; onClose(): void }) {
  const t = useT('finance.shop');
  const common = useT('common');
  const { content, names, fmt } = useWords();
  const { shown, p } = useRound();
  const orders = useGame((s) => s.orders);
  const addOrder = useGame((s) => s.addOrder);
  const setOrder = useGame((s) => s.setOrder);
  const quote = quoteItem(content, shown, item.id);
  const held = p.life.items.find((owned) => owned.itemId === item.id);
  const inBasket = orders.some((order) => order.type === 'buyItem' && order.itemId === item.id);
  const years = content.yearsPerRound;
  const done = (ok: boolean) => {
    if (ok) onClose();
  };

  return (
    <Sheet open onClose={onClose} title={names.items[item.id]} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <div className="flex justify-center">
          <Bare className="p-2 leading-[0]">
            <Sprite id={itemArt(item.id)} scale={2} fallback={{ w: 64, h: 64 }} />
          </Bare>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          <Tag tone="good">{t('status', { n: item.status })}</Tag>
          {quote.upkeepAnnual > 0 ? <Tag tone="bad">{t('upkeep', { amount: fmt.money(quote.upkeepAnnual) })}</Tag> : null}
          {item.kind === 'experience' ? <Tag>{t('lasts', { years: item.boostRounds * years })}</Tag> : null}
        </div>
        {item.kind === 'durable' && !held && quote.forSale ? <p className="text-center text-[13px] text-ink-300">{t('resale', { amount: fmt.money(quote.resale) })}</p> : null}

        {inBasket ? (
          <Button wide onClick={() => done(setOrder((order) => order.type === 'buyItem' && order.itemId === item.id, null))}>
            {common('cancel')}
          </Button>
        ) : held ? (
          quote.sellable ? (
            <Button variant="danger" wide onClick={() => done(addOrder({ type: 'sellItem', itemId: item.id }))}>
              {item.kind === 'membership' ? t('cancel') : t('sell', { amount: fmt.money(held.value) })}
            </Button>
          ) : held.roundsLeft !== null ? (
            <p className="text-center text-[14px] text-ink-300">{t('spent', { years: held.roundsLeft * years })}</p>
          ) : (
            // What only life can give, a degree for one, is not the player's to sell.
            <p className="text-center text-[14px] text-ink-300">{t('cardOnly')}</p>
          )
        ) : quote.forSale ? (
          <Button variant="primary" wide onClick={() => done(addOrder({ type: 'buyItem', itemId: item.id }))}>
            {t('buy', { amount: fmt.money(quote.price) })}
          </Button>
        ) : (
          <p className="text-center text-[14px] text-ink-300">{t('cardOnly')}</p>
        )}
      </div>
    </Sheet>
  );
}

function Shop() {
  const t = useT('finance.shop');
  const { content, text, names, fmt } = useWords();
  const { shown, p } = useRound();
  const [open, setOpen] = useState<ItemDef | null>(null);
  const ladders = [...new Set(content.items.map((item) => item.ladder))];

  return (
    <div className="flex flex-col gap-3">
      {ladders.map((ladder) => (
        <Panel key={ladder} title={text.ladders[ladder]}>
          <div className="grid grid-cols-2 gap-2">
            {content.items
              .filter((item) => item.ladder === ladder)
              .map((item) => {
                const owned = p.life.items.some((x) => x.itemId === item.id);
                return (
                  // What is already owned wears a gold edge, so the shelf shows at a glance what is left to want.
                  <button key={item.id} type="button" onClick={() => setOpen(item)} className={`${TILE} ${owned ? 'frame-gold' : ''}`}>
                    <Bare className="w-full py-1.5">
                      <Sprite id={itemArt(item.id)} fallback={{ w: 64, h: 64 }} />
                    </Bare>
                    <span className="mt-0.5 line-clamp-2 min-h-[2.4em] text-[13px] leading-tight">{names.items[item.id]}</span>
                    <span className={`pixel text-[16px] ${owned ? 'text-teal-300' : 'text-gold-500'}`}>{owned ? t('owned') : fmt.compact(quoteItem(content, shown, item.id).price)}</span>
                    <Tag tone="good">{t('status', { n: item.status })}</Tag>
                  </button>
                );
              })}
          </div>
        </Panel>
      ))}
      {open ? <ItemSheet item={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Taxes: the round as it will resolve

function Taxes() {
  const t = useT('finance.taxes');
  const { text, fmt } = useWords();
  const { preview, p } = useRound();
  const line = (label: ReactNode, amount: number, key: string) => (amount === 0 ? null : <Row key={key} left={label} right={fmt.signed(amount)} />);
  const { income, expenses, tax, escape } = preview;

  return (
    <div className="flex flex-col gap-3">
      <Panel title={t('income')}>
        {line(text.ledger.salary, income.salary, 'salary')}
        {line(text.ledger.dividends, income.dividends, 'dividends')}
        {line(text.ledger.interest, income.interest, 'interest')}
        {line(text.ledger.rent, income.rent, 'rent')}
        {line(text.ledger.otherPassive, income.otherPassive, 'other')}
      </Panel>
      <Panel title={t('expenses')}>
        {line(text.ledger.living, -expenses.living, 'living')}
        {line(text.ledger.otherExpenses, -expenses.other, 'other')}
        {line(text.ledger.debtInterest, -expenses.debtInterest, 'interest')}
        {line(text.ledger.debtPrincipal, -expenses.debtPrincipal, 'principal')}
      </Panel>
      <Panel title={t('tax')}>
        <Row left={t('incomeTax')} right={fmt.signed(-tax.income)} />
        <Row left={t('investmentTax')} right={fmt.signed(-tax.investment)} />
        <Row left={t('propertyTax')} right={fmt.signed(-tax.property)} />
        {preview.purchaseTaxPaid > 0 ? <Row left={t('purchaseTax')} right={fmt.signed(-preview.purchaseTaxPaid)} /> : null}
      </Panel>
      <Panel>
        <Row left={t('cashNow')} right={fmt.money(p.cash)} />
        <Row left={<span className="pixel text-[17px]">{t('cashAfter')}</span>} right={<span className={`text-[19px] ${preview.cashAfter < 0 ? 'text-wine-300' : 'text-gold-500'}`}>{fmt.money(preview.cashAfter)}</span>} />
        {preview.cashAfter < 0 ? <p className="mt-1 text-[13px] text-wine-300">{t('shortfall')}</p> : null}
        <p className="mt-2 text-[12px] text-ink-300">{t('exact')}</p>
      </Panel>
      <Panel title={t('escapeTitle')}>
        <div className="mb-1.5 flex justify-between text-[14px]">
          <span className="pixel">{fmt.money(escape.passiveAfterTax)}</span>
          <span className="pixel text-ink-300">{fmt.money(escape.outgoings)}</span>
        </div>
        <Bar value={escape.passiveAfterTax} max={escape.outgoings} label={t('escapeTitle')} />
        <p className="mt-2 text-[12px] text-ink-300">{t('escapeHint')}</p>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

/** The orders of the round so far, in the order they will run, each removable. */
export function BasketList() {
  const t = useT('finance');
  const labels = useT('orders');
  const words = useWords();
  const view = useGame((s) => s.view);
  const orders = useGame((s) => s.orders);
  const removeOrder = useGame((s) => s.removeOrder);
  if (!view) return null;
  if (orders.length === 0) return <p className="py-1 text-[14px] text-ink-300">{t('basketEmpty')}</p>;

  return (
    <ol aria-label={t('basketTitle')} className="flex flex-col gap-2">
      {orders.map((order, i) => {
        const label = orderLabel(words, labels, view.player, order);
        return (
          <li key={i} className="frame flex items-center justify-between gap-3 bg-night-600 py-1 pl-3 pr-1">
            <span className="min-w-0 truncate">{label}</span>
            <button type="button" onClick={() => removeOrder(i)} aria-label={`${t('remove')}: ${label}`} className="pixel flex size-11 shrink-0 items-center justify-center text-[18px] text-wine-300">
              ✕
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** The orders of the round in a sheet, for a phone. */
export function Basket({ onClose }: { onClose(): void }) {
  const t = useT('finance');
  const common = useT('common');
  return (
    <Sheet open onClose={onClose} title={t('basketTitle')} closeLabel={common('close')}>
      <BasketList />
    </Sheet>
  );
}

/** The finance phase: seven tabs over one basket of orders. */
export function Finance() {
  const t = useT('finance');
  const { text } = useWords();
  const refusal = useGame((s) => s.refusal);
  const clearRefusal = useGame((s) => s.clearRefusal);
  const alsoRemoved = useGame((s) => s.alsoRemoved);
  const clearAlsoRemoved = useGame((s) => s.clearAlsoRemoved);
  const [tab, setTab] = useState<TabId>('portfolio');
  const ids = useId();

  return (
    <div>
      <div className="sticky top-0 z-10 bg-night-800">
        <Tabs<TabId> label={t('tabsLabel')} idPrefix={ids} tabs={TABS.map((id) => ({ id, label: t(`tabs.${id}`) }))} value={tab} onChange={setTab} />
      </div>
      <div role="tabpanel" id={`${ids}-panel-${tab}`} aria-labelledby={`${ids}-tab-${tab}`} className="px-3 pt-1">
        {tab === 'portfolio' ? <Portfolio /> : null}
        {tab === 'market' ? <Market /> : null}
        {tab === 'property' ? <PropertyTab /> : null}
        {tab === 'debt' ? <DebtTab /> : null}
        {tab === 'lifestyle' ? <Lifestyle /> : null}
        {tab === 'shop' ? <Shop /> : null}
        {tab === 'taxes' ? <Taxes /> : null}
      </div>
      <Toast message={refusal ? `${t('refused')}: ${text.reasons[refusal]}` : null} onDone={clearRefusal} />
      {/* Taking one order out can take others with it; that must not happen without a word. */}
      <Toast message={alsoRemoved > 0 && !refusal ? t('alsoRemoved', { count: alsoRemoved }) : null} onDone={clearAlsoRemoved} ms={4_000} />
    </div>
  );
}
