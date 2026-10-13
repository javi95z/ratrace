'use client';

import { familyArt, insuranceArt, itemArt, lifestyleArt, propertyArt, rentTierIcon } from '@ratrace/content';
import { cashflow, focusLeft, homeOf, netWorth, quoteItem, quoteLiving, quoteOwnedProperty } from '@ratrace/engine';
import type { GameView, InsuranceKind, LifestyleTier, OwnedItem, RentTier } from '@ratrace/engine';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useGame, useSaving, useT, useWords } from '@/game/context';
import { insuranceCover } from '@/game/present';
import { Link } from '@/i18n/navigation';
import { Bare, Panel, Row, Tag } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { BalanceSheet } from './Balance';
import type { BalanceLine } from './Balance';
import { useShown } from './Hud';
import { ItemCost } from './ItemCost';

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
  const [about, setAbout] = useState<About | null>(null);
  const [line, setLine] = useState<BalanceLine | null>(null);
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
        {/* Each of these opens what it is, what it costs and what it gives. Changing it is done in the finances. */}
        <button type="button" aria-haspopup="dialog" onClick={() => setAbout('lifestyle')} className="block w-full text-left">
          <Row left={t('lifestyle')} right={<>{text.lifestyleTiers[p.lifestyleTier]}<More /></>} />
        </button>
        <button type="button" aria-haspopup="dialog" onClick={() => setAbout('home')} className="block w-full text-left">
          <Row left={t('home')} sub={names.cities[p.cityId]} right={<>{home ? text.propertyTypes[home.typeId] : text.rentTiers[life.rentTier]}<More /></>} />
        </button>
        <button type="button" aria-haspopup="dialog" onClick={() => setAbout('insurance')} className="block w-full text-left">
          <Row left={t('insurance')} right={<>{insured.length > 0 ? <span className="font-sans text-[13px]">{insured.join(', ')}</span> : t('uninsured')}<More /></>} />
        </button>
      </Panel>
      {about ? <AboutSheet about={about} shown={shown} onClose={() => setAbout(null)} /> : null}

      <Panel title={t('income')}>
        <Row left={t('salary')} right={<span className="text-teal-300">{fmt.signed(flow.salaryAnnual)}</span>} />
        <Row left={t('passive')} right={<span className="text-teal-300">{fmt.signed(flow.passiveAnnual)}</span>} />
        <Row left={t('expenses')} right={<span className="text-wine-300">{fmt.signed(-flow.expensesAnnual)}</span>} />
      </Panel>

      <Panel title={t('balance')} label={t('balance')}>
        {/* Every line opens what it is made of. */}
        {(
          [
            ['cash', t('cash'), fmt.money(p.cash)],
            ['savings', t('savings'), fmt.money(p.deposit)],
            ['pension', t('pension'), fmt.money(p.pension)],
            ['investments', t('investments'), fmt.money(invested)],
            ['homes', t('homes'), fmt.money(homes)],
            ['things', t('things'), fmt.money(things)],
          ] as const
        ).map(([line, label, amount]) => (
          <button key={line} type="button" aria-haspopup="dialog" onClick={() => setLine(line)} className="block w-full text-left">
            <Row left={label} right={<>{amount}<More /></>} />
          </button>
        ))}
        <button type="button" aria-haspopup="dialog" onClick={() => setLine('debts')} className="block w-full text-left">
          <Row left={t('debts')} right={<><span className={owed > 0 ? 'text-wine-300' : ''}>{fmt.money(-owed)}</span><More /></>} />
        </button>
        <button type="button" aria-haspopup="dialog" onClick={() => setLine('netWorth')} className="block w-full text-left">
          <Row
            className="mt-1 border-t-2 border-night-900 pt-2"
            left={<span className="pixel text-[17px]">{t('netWorth')}</span>}
            right={<><span className="text-[19px] text-gold-500">{fmt.money(netWorth(p))}</span><More /></>}
          />
        </button>
      </Panel>
      {/* One of the things owned is opened from the list of them: the list gives way to it. */}
      {line ? <BalanceSheet line={line} shown={shown} onClose={() => setLine(null)} onItem={(itemId) => (setLine(null), setOpen(itemId))} /> : null}

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

type About = 'lifestyle' | 'home' | 'insurance';

/** The mark of a row that opens. */
const More = () => (
  <span aria-hidden className="ml-1.5 text-[11px] text-ink-300">
    ▸
  </span>
);

/** One choice among several, as a line: its picture, its name, what it costs a year and what it gives. */
function Choice({ icon, name, cost, status, on, onLabel, onPick, disabled = false, children }: { icon: string; name: string; cost: string; status?: number; on: boolean; onLabel: string; onPick?: () => void; disabled?: boolean; children?: ReactNode }) {
  const shop = useT('finance.shop');
  const look = `flex w-full items-start gap-3 px-2.5 py-2 text-left ${on ? 'bevel frame-gold bg-night-600' : 'frame bg-night-700'}`;
  const body = (
    <>
      <Bare className="size-9">
        <Sprite id={icon} />
      </Bare>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="pixel text-[16px]">{name}</span>
          <span className="pixel shrink-0 text-[15px] text-gold-500">{cost}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {on ? <Tag tone="good">{onLabel}</Tag> : null}
          {status ? <Tag tone={status > 0 ? 'good' : 'bad'}>{status > 0 ? shop('status', { n: status }) : shop('statusDown', { n: -status })}</Tag> : null}
        </div>
        {children}
      </div>
    </>
  );
  // While the finances are open the line is the choice itself; at any other time it is only to be read.
  return (
    <li aria-current={on ? 'true' : undefined}>
      {onPick ? (
        <button type="button" aria-pressed={on} disabled={disabled} onClick={onPick} className={`${look} transition-transform active:translate-y-[2px] disabled:opacity-50`}>
          {body}
        </button>
      ) : (
        <div className={look}>{body}</div>
      )}
    </li>
  );
}

/**
 * How the player lives, where, and what they are insured against: every choice there is, what
 * each costs a year and what it gives, the one in force marked. To be read; the finances change it.
 */
function AboutSheet({ about, shown, onClose }: { about: About; shown: GameView; onClose(): void }) {
  const t = useT('profile');
  const common = useT('common');
  const life = useT('finance.lifestyle');
  const estate = useT('finance.property');
  const { content, text, names, fmt } = useWords();
  const p = shown.player;
  const living = quoteLiving(content, shown);
  const perYear = (cents: number) => common('perYear', { amount: fmt.money(cents) });
  const home = homeOf(p, content);
  // A choice is an order like any other: it can be given only while the finances are open, and it
  // is judged against the life as it is, so choosing what is already so takes the order back.
  const view = useGame((s) => s.view);
  const stage = useGame((s) => s.stage);
  const setOrder = useGame((s) => s.setOrder);
  const now = stage === 'finance' && view ? view.player : null;

  let body: ReactNode;
  if (about === 'lifestyle') {
    body = (
      <>
        <p className="text-[14px] leading-snug">{t('aboutLifestyle')}</p>
        <ul className="flex flex-col gap-2">
          {text.lifestyleTiers.map((name, tier) => (
            <Choice key={tier} icon={lifestyleArt[tier]} name={name} cost={perYear(living.tiers[tier])} status={content.life.lifestyleStatus[tier]} on={tier === p.lifestyleTier} onLabel={t('yours')}
              disabled={tier < p.life.minLifestyleTier}
              onPick={now ? () => setOrder((order) => order.type === 'setLifestyle', tier === now.lifestyleTier ? null : { type: 'setLifestyle', tier: tier as LifestyleTier }) : undefined}
            >
              {tier < p.life.minLifestyleTier ? <p className="mt-1 text-[12px] text-wine-300">{life('tierFloor')}</p> : null}
            </Choice>
          ))}
        </ul>
      </>
    );
  } else if (about === 'home') {
    const owned = home ? quoteOwnedProperty(content, shown, home.id) : null;
    body = home && owned ? (
      <>
        <div className="flex justify-center">
          <Bare className="p-1 leading-[0]">
            <Sprite id={propertyArt(home.typeId)} fallback={{ w: 128, h: 128 }} />
          </Bare>
        </div>
        <p className="text-center text-[14px] leading-snug">{life('ownerNote')}</p>
        <Panel>
          <Row left={text.propertyTypes[home.typeId]} sub={names.cities[home.cityId]} right={owned.status > 0 ? <Tag tone="good">{estate('status', { n: owned.status })}</Tag> : undefined} />
          <Row left={estate('worth')} right={<span className="text-gold-500">{fmt.money(owned.value)}</span>} />
          <Row left={estate('owed')} right={<span className={owned.mortgage ? 'text-wine-300' : ''}>{fmt.money(owned.mortgage?.principal ?? 0)}</span>} />
        </Panel>
      </>
    ) : (
      <>
        <p className="text-[14px] leading-snug">{t('aboutRent', { city: names.cities[p.cityId] })}</p>
        <ul className="flex flex-col gap-2">
          {text.rentTiers.map((name, tier) => (
            <Choice key={tier} icon={rentTierIcon[tier]} name={name} cost={living.rentTiers ? perYear(living.rentTiers[tier]) : ''} status={content.life.rentTierStatus[tier]} on={tier === p.life.rentTier} onLabel={t('yours')}
              onPick={now ? () => setOrder((order) => order.type === 'setRentTier', tier === now.life.rentTier ? null : { type: 'setRentTier', tier: tier as RentTier }) : undefined}
            />
          ))}
        </ul>
        <p className="text-[12px] text-ink-300">{t('rentCost')}</p>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-[14px] leading-snug">{t('aboutInsurance')}</p>
        <ul className="flex flex-col gap-2">
          {INSURANCES.map((kind) => {
            const cover = insuranceCover(content, kind);
            return (
              <Choice key={kind} icon={insuranceArt[kind]} name={text.insurance[kind]} cost={perYear(living.insurance[kind])} on={p.life.insurance[kind]} onLabel={t('insured')}
                onPick={now ? () => setOrder((order) => order.type === 'setInsurance' && order.insurance === kind, !p.life.insurance[kind] === now.life.insurance[kind] ? null : { type: 'setInsurance', insurance: kind, on: !p.life.insurance[kind] }) : undefined}
              >
                <ul className="mt-1.5 flex flex-col gap-0.5 text-[13px] leading-snug text-ink-200">
                  {cover.pays.map(({ cardId, pct }) => (
                    <li key={cardId}>{t('pays', { pct, card: text.cards[cardId].title })}</li>
                  ))}
                  {cover.opens.map((cardId) => (
                    <li key={cardId}>{t('opens', { card: text.cards[cardId].title })}</li>
                  ))}
                </ul>
              </Choice>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <Sheet open onClose={onClose} title={t(about === 'lifestyle' ? 'lifestyle' : about === 'home' ? 'home' : 'insurance')} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        {body}
        <p className="text-center text-[12px] text-ink-300">{now && !(about === 'home' && home) ? t('pickHere') : t('changedIn')}</p>
      </div>
    </Sheet>
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
        <ItemCost quote={quote} />
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
