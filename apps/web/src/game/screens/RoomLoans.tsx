'use client';

import { Explain } from './Explain';
import { applyBp } from '@ratrace/engine';
import { useState } from 'react';
import { useGame, useRoom, useT, useWords } from '@/game/context';
import { LOAN_MAX, LOAN_MIN, LOAN_RATES_BP, LOAN_ROUNDS } from '@ratrace/core/game/room';
import type { RoomLoan, RoomMember, RoomState } from '@ratrace/core/game/room';
import { Button, Panel, Segmented } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';

/** What became of an offer, told from the player's side: as the one who lends, or the one who borrows. Each key written out. */
const STATE = {
  open: { lend: 'state.open.lend', borrow: 'state.open.borrow' },
  accepted: { lend: 'state.accepted.lend', borrow: 'state.accepted.borrow' },
  refused: { lend: 'state.refused.lend', borrow: 'state.refused.borrow' },
  paid: { lend: 'state.paid.lend', borrow: 'state.paid.borrow' },
  failed: { lend: 'state.failed.lend', borrow: 'state.failed.borrow' },
  expired: { lend: 'state.expired.lend', borrow: 'state.expired.borrow' },
} as const;

/** Amounts offered with one tap, in dollars. Any other can be typed. */
const AMOUNTS = [1_000, 5_000, 10_000, 25_000] as const;

/**
 * What a loan costs whoever owes it, paid as the game pays every loan: each round the interest on
 * what is still owed, and a share of it back, the rest at the last. In cents.
 */
export function loanCost(amount: number, rateBp: number, rounds: number, yearsPerRound: number): { first: number; total: number } {
  let owed = amount;
  let total = 0;
  let first = 0;
  for (let left = rounds; left >= 1; left--) {
    const due = left <= 1 ? owed : Math.ceil(owed / left);
    const paid = applyBp(owed, rateBp * yearsPerRound) + due;
    if (left === rounds) first = paid;
    total += paid;
    owed -= due;
  }
  return { first, total };
}

/** A loan in a line: how much, at what rate (or none), for how long. */
function useTerms() {
  const t = useT('room.loan');
  const { fmt } = useWords();
  return (loan: { amount: number; rateBp: number; rounds: number }) => loan.rateBp === 0 ? t('termsFree', { amount: fmt.money(loan.amount), rounds: loan.rounds }) : t('terms', { amount: fmt.money(loan.amount), rate: fmt.rate(loan.rateBp), rounds: loan.rounds });
}

/**
 * The offers of the round that wait on the player, each with its answer; and what became of the
 * player's own, in a line each. Nothing at all when there are none.
 */
export function LoanOffers({ room, nameOf }: { room: RoomState; nameOf(member: RoomMember): string }) {
  const t = useT('room.loan');
  const { content, fmt } = useWords();
  const answer = useRoom((s) => s.answerLoan);
  const [busy, setBusy] = useState<string | null>(null);
  const terms = useTerms();
  const who = (loan: RoomLoan) => {
    const member = room.members.find((each) => each.userId === loan.other);
    return member ? nameOf(member) : '?';
  };
  const asked = room.loans.filter((loan) => loan.round === room.round && !loan.mine && loan.status === 'open');
  const told = room.loans.filter((loan) => (loan.round === room.round && (loan.mine || loan.status === 'accepted')) || (loan.round < room.round && loan.status === 'failed'));
  if (room.status !== 'playing' || (asked.length === 0 && told.length === 0)) return null;
  const reply = async (loan: RoomLoan, yes: boolean) => {
    setBusy(loan.id);
    await answer(loan.id, yes);
    setBusy(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {asked.map((loan) => {
        const cost = loanCost(loan.amount, loan.rateBp, loan.rounds, content.yearsPerRound);
        return (
          <Panel key={loan.id} title={t(loan.lend ? 'askedTitle' : 'offeredTitle', { who: who(loan) })} label={t(loan.lend ? 'askedTitle' : 'offeredTitle', { who: who(loan) })}>
            <p className="pixel flex items-center gap-2 text-[17px] text-gold-500">
              <Sprite id="icon.room_loan" />
              {terms(loan)}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-ink-200">
              {loan.lend ? t('youWouldGet', { total: fmt.money(cost.total) }) : t('youWouldPay', { first: fmt.money(cost.first), total: fmt.money(cost.total) })}
            </p>
            <p className="mt-1 text-[12px] text-ink-300">{t('untilTurn')}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="primary" wide disabled={busy !== null} onClick={() => void reply(loan, true)}>
                {t('accept')}
              </Button>
              <Button wide disabled={busy !== null} onClick={() => void reply(loan, false)}>
                {t('refuse')}
              </Button>
            </div>
          </Panel>
        );
      })}
      {told.map((loan) => (
        <div key={loan.id} role="status" className="frame flex items-center gap-2 bg-night-800 px-3 py-2 text-[13px]">
          <span className="min-w-0 flex-1 leading-snug">
            {t(STATE[loan.status][loan.lend ? 'lend' : 'borrow'], { who: who(loan) })} <span className="text-ink-300">· {terms(loan)}</span>
          </span>
          {loan.mine && loan.status === 'open' ? (
            <button type="button" disabled={busy !== null} onClick={() => void reply(loan, false)} className="min-h-11 shrink-0 px-2 text-[13px] text-ink-300 underline underline-offset-4">
              {t('withdraw')}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Another player of the room, from the room's order: who they are, and a loan to offer them, either
 * way. Shown only while the game is played and both are in it.
 */
export function PlayerSheet({ member, nameOf, onClose }: { member: RoomMember | null; nameOf(member: RoomMember): string; onClose(): void }) {
  const t = useT('room.loan');
  const common = useT('common');
  const { fmt, names, text } = useWords();
  const [lend, setLend] = useState<boolean | null>(null);
  const standing = member?.standing ?? null;
  const close = () => {
    setLend(null);
    onClose();
  };
  return (
    <>
      <Sheet open={member !== null && lend === null} onClose={close} title={member ? nameOf(member) : ''} closeLabel={common('close')}>
        {member && standing ? (
          <p className="text-[14px] leading-snug text-ink-200">
            {[standing.cityId ? names.cities[standing.cityId] : null, standing.career ? text.careers[standing.career.id]?.levels[standing.career.level] : null].filter(Boolean).join(' · ')}
            {standing.cityId || standing.career ? ' · ' : ''}
            {t('worth', { worth: fmt.compact(standing.netWorth) })}
          </p>
        ) : null}
        <Explain className="mt-2">{t('about')}</Explain>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" wide onClick={() => setLend(true)}>
            {t('offer')}
          </Button>
          <Button wide onClick={() => setLend(false)}>
            {t('ask')}
          </Button>
        </div>
      </Sheet>
      {member && lend !== null ? <LoanSheet member={member} lend={lend} nameOf={nameOf} onClose={close} /> : null}
    </>
  );
}

/** The terms of a loan to offer: how much, at what rate, for how many rounds; what it comes to; and the offer sent. */
function LoanSheet({ member, lend, nameOf, onClose }: { member: RoomMember; lend: boolean; nameOf(member: RoomMember): string; onClose(): void }) {
  const t = useT('room.loan');
  const common = useT('common');
  const { content, fmt } = useWords();
  const offer = useRoom((s) => s.offerLoan);
  const cash = useGame((s) => s.view?.player.cash ?? 0);
  const [dollars, setDollars] = useState<number>(AMOUNTS[1]);
  const [rateBp, setRateBp] = useState<number>(500);
  const [rounds, setRounds] = useState<number>(3);
  const [state, setState] = useState<'idle' | 'sending' | 'failed'>('idle');
  const amount = Math.round(dollars * 100);
  const valid = Number.isFinite(amount) && amount >= LOAN_MIN && amount <= LOAN_MAX;
  const cost = valid ? loanCost(amount, rateBp, rounds, content.yearsPerRound) : null;
  const name = nameOf(member);
  const send = async () => {
    setState('sending');
    const said = await offer({ to: member.userId, lend, amount, rateBp, rounds });
    if (said === 'ok') onClose();
    else setState('failed');
  };

  return (
    <Sheet open onClose={onClose} title={t(lend ? 'offerTitle' : 'askTitle', { who: name })} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-ink-200">{t('amount')}</span>
          <input
            type="number"
            inputMode="numeric"
            min={LOAN_MIN / 100}
            max={LOAN_MAX / 100}
            step={100}
            value={dollars}
            onChange={(event) => setDollars(Number(event.target.value))}
            className="frame min-h-11 bg-night-900 px-3 text-[18px] text-cream"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {AMOUNTS.map((each) => (
            <button key={each} type="button" onClick={() => setDollars(each)} className={`frame-raised min-h-11 px-3 text-[14px] ${dollars === each ? 'bg-gold-500 text-ink-900' : 'bg-night-600'}`}>
              {fmt.money(each * 100)}
            </button>
          ))}
        </div>
        {lend && amount > cash ? <p className="text-[12px] text-wine-300">{t('moreThanCash', { cash: fmt.money(cash) })}</p> : null}
        <Segmented<number> label={t('rate')} value={rateBp} onChange={setRateBp} options={LOAN_RATES_BP.map((bp) => ({ value: bp, label: fmt.rate(bp) }))} gridClassName="grid-cols-4" />
        <Segmented<number> label={t('rounds')} value={rounds} onChange={setRounds} options={LOAN_ROUNDS.map((n) => ({ value: n, label: String(n) }))} />
        {cost ? (
          <p className="text-[13px] leading-snug text-ink-200">
            {lend ? t('theyPay', { who: name, first: fmt.money(cost.first), total: fmt.money(cost.total) }) : t('youPay', { first: fmt.money(cost.first), total: fmt.money(cost.total) })}
          </p>
        ) : (
          <p className="text-[12px] text-wine-300">{t('amountRange', { min: fmt.money(LOAN_MIN), max: fmt.money(LOAN_MAX) })}</p>
        )}
        <Explain>{t('rules')}</Explain>
        {state === 'failed' ? <p role="alert" className="text-[13px] text-wine-300">{t('failed')}</p> : null}
        <Button variant="primary" wide disabled={!valid || state === 'sending'} onClick={() => void send()}>
          {t(lend ? 'sendOffer' : 'sendAsk', { who: name })}
        </Button>
      </div>
    </Sheet>
  );
}
