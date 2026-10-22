import { LOAN_MAX, LOAN_MIN, LOAN_RATES_BP, LOAN_ROUNDS } from '@ratrace/core/game/room';
import type { RoomLoan, RoomMember } from '@ratrace/core/game/room';
import { applyBp } from '@ratrace/engine';
import { createContext, useContext, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { Button, Panel, Raised, Segmented, usePress } from '../../ui/kit';
import { LinkText } from '../../ui/LinkText';
import { Sheet } from '../../ui/overlay';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { TextField } from '../../ui/TextField';
import { COLORS, TOUCH } from '../../ui/theme';
import { useGame, useRoom, useT, useWords } from '../context';
import { useRoomSlice } from '../roomSlice';
import { Explain } from './Explain';

/*
 * The web's RoomLoans.tsx, on the phone: the offers of a round that wait on the player and what came of theirs (`LoanOffers`), and another player
 * of the room opened from its order (`PlayerSheet`), with the terms of a loan to offer them (`LoanSheet`). Where the web hands them the room, the
 * phone's read what they draw of it themselves (`useRoomSlice`): the room comes anew at every look, and a piece is drawn again only when what it
 * shows has changed, not for another player's shout or a seat that played.
 */

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
  return (loan: { amount: number; rateBp: number; rounds: number }) =>
    loan.rateBp === 0 ? t('termsFree', { amount: fmt.money(loan.amount), rounds: loan.rounds }) : t('terms', { amount: fmt.money(loan.amount), rate: fmt.rate(loan.rateBp), rounds: loan.rounds });
}

/**
 * A few words that do something, underlined (the web's `min-h-11 px-3 text-[13px] text-ink-300 underline underline-offset-4` button): leaving the
 * game from its order, taking an offer back, reporting a name. 44 tall, as wide as its words and its 12 each side.
 */
export function LinkButton({ onPress, disabled = false, padX = 12, children }: { onPress(): void; disabled?: boolean; padX?: number; children: string }) {
  const press = usePress({ onPress, disabled });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={press}
      style={{ minHeight: TOUCH, paddingHorizontal: padX, justifyContent: 'center', flexShrink: 0, opacity: disabled ? 0.45 : 1 }}
    >
      <LinkText size={13} offset={4} tone="ink-300">{children}</LinkText>
    </Pressable>
  );
}

/** The offer an answer is on its way to, and how to say so: kept above what draws the offers, so a round that moves them keeps it. */
export type LoanReply = [string | null, (id: string | null) => void];
export const LoanReplies = createContext<LoanReply | null>(null);

/** What the offers of the room draw: the round, whether it is played, its loans and who they are with. Plain data, compared as a whole. */
type Offers = { round: number; playing: boolean; loans: RoomLoan[]; who: Record<string, Pick<RoomMember, 'name' | 'bot' | 'userId'>> };

/**
 * The offers of the round that wait on the player, each with its answer; and what became of the player's own, in a line each. Nothing at all when
 * there are none. (The web's takes the room; this one reads its loans, and is drawn again only when they or the names in them change.)
 */
export function LoanOffers({ nameOf }: { nameOf(member: Pick<RoomMember, 'name' | 'bot' | 'userId'>): string }) {
  const t = useT('room.loan');
  const { content, fmt } = useWords();
  const answer = useRoom((s) => s.answerLoan);
  // An answer on its way, kept by whoever holds the bar (`LoanReplies`) where one does, so the bar moving as the round turns does not forget it.
  const own = useState<string | null>(null);
  const [busy, setBusy] = useContext(LoanReplies) ?? own;
  const terms = useTerms();
  const offers = useRoomSlice<Offers | null>(({ room }) => {
    if (room === null) return null;
    const loans = room.loans.filter((loan) => loan.round === room.round || (loan.round < room.round && loan.status === 'failed'));
    const who: Offers['who'] = {};
    for (const loan of loans) {
      const member = room.members.find((each) => each.userId === loan.other);
      if (member) who[member.userId] = { name: member.name, bot: member.bot, userId: member.userId };
    }
    return { round: room.round, playing: room.status === 'playing', loans, who };
  });
  if (offers === null) return null;
  const { round, loans } = offers;
  const whoOf = (loan: RoomLoan) => (offers.who[loan.other] ? nameOf(offers.who[loan.other]) : '?');
  const asked = loans.filter((loan) => loan.round === round && !loan.mine && loan.status === 'open');
  const told = loans.filter((loan) => (loan.round === round && (loan.mine || loan.status === 'accepted')) || (loan.round < round && loan.status === 'failed'));
  if (!offers.playing || (asked.length === 0 && told.length === 0)) return null;
  const reply = async (loan: RoomLoan, yes: boolean) => {
    setBusy(loan.id);
    await answer(loan.id, yes);
    setBusy(null);
  };

  return (
    <View style={{ gap: 8 }}>
      {asked.map((loan) => {
        const cost = loanCost(loan.amount, loan.rateBp, loan.rounds, content.yearsPerRound);
        const title = t(loan.lend ? 'askedTitle' : 'offeredTitle', { who: whoOf(loan) });
        return (
          <View key={loan.id} role="region" aria-label={title}>
            <Panel title={title}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Sprite id="icon.room_loan" />
                <PixelText size={17} tone="gold-500" style={{ flexShrink: 1 }}>{terms(loan)}</PixelText>
              </View>
              <ReadText size={13} tone="ink-200" lineHeight={13 * SNUG} style={{ marginTop: 4 }}>
                {loan.lend ? t('youWouldGet', { total: fmt.money(cost.total) }) : t('youWouldPay', { first: fmt.money(cost.first), total: fmt.money(cost.total) })}
              </ReadText>
              <ReadText size={12} tone="ink-300" style={{ marginTop: 4 }}>{t('untilTurn')}</ReadText>
              <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
                <Button variant="primary" cell disabled={busy !== null} onPress={() => void reply(loan, true)}>
                  {t('accept')}
                </Button>
                <Button variant="secondary" cell disabled={busy !== null} onPress={() => void reply(loan, false)}>
                  {t('refuse')}
                </Button>
              </View>
            </Panel>
          </View>
        );
      })}
      {told.map((loan) => (
        <View key={loan.id} accessible={!(loan.mine && loan.status === 'open')} role="status">
          <Framed kind="frame" style={{ backgroundColor: COLORS['night-800'], flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
            <ReadText size={13} lineHeight={13 * SNUG} style={{ flex: 1, minWidth: 0 }} after={[{ text: ` · ${terms(loan)}`, tone: 'ink-300' }]}>
              {t(STATE[loan.status][loan.lend ? 'lend' : 'borrow'], { who: whoOf(loan) })}
            </ReadText>
            {loan.mine && loan.status === 'open' ? (
              <LinkButton padX={8} disabled={busy !== null} onPress={() => void reply(loan, false)}>
                {t('withdraw')}
              </LinkButton>
            ) : null}
          </Framed>
        </View>
      ))}
    </View>
  );
}

/** What the sheet of another player draws of the room: them as it now shows them, and what may be done with them there. */
type Picked = { member: RoomMember; playing: boolean; over: boolean; public: boolean };

/**
 * Another player of the room, from the room's order: who they are, and what the player may do with them. While the game is played, a loan either
 * way, where its rules have loans; once it is over, to follow them; in a public game, to report their name. (The web's takes the room; this one reads
 * the one player it shows, so a closed sheet draws nothing of the room.)
 */
export function PlayerSheet({ member: picked, nameOf, loans, onClose }: { member: Pick<RoomMember, 'userId'> | null; nameOf(member: Pick<RoomMember, 'name' | 'bot' | 'userId'>): string; loans: boolean; onClose(): void }) {
  const t = useT('room.loan');
  const said = useT('room.player');
  const common = useT('common');
  const { fmt, names, text } = useWords();
  const report = useRoom((s) => s.report);
  const follow = useRoom((s) => s.follow);
  const [lend, setLend] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  // What the last thing asked here came to, said under it until the sheet is closed.
  const [told, setTold] = useState<string | null>(null);
  const pickedId = picked?.userId ?? null;
  // The player as the room now shows them: a name reported, or a player followed, shows at once.
  const shown = useRoomSlice<Picked | null>(({ room }) => {
    if (room === null || pickedId === null) return null;
    const member = room.members.find((one) => one.userId === pickedId);
    if (member === undefined) return null;
    return { member, playing: room.status === 'playing', over: room.status === 'finished', public: room.public };
  });
  const member = shown?.member ?? null;
  const standing = member?.standing ?? null;
  const playing = shown?.playing === true && loans;
  const over = shown?.over === true;
  const close = () => {
    setLend(null);
    setTold(null);
    onClose();
  };
  const ask = async (what: () => Promise<string>) => {
    setBusy(true);
    setTold(await what());
    setBusy(false);
  };
  const where = standing ? [standing.cityId ? names.cities[standing.cityId] : null, standing.career ? text.careers[standing.career.id]?.levels[standing.career.level] : null].filter(Boolean).join(' · ') : '';
  return (
    <>
      <Sheet open={member !== null && lend === null} onClose={close} title={member ? nameOf(member) : ''} closeLabel={common('close')}>
        {member && standing ? (
          <ReadText size={14} tone="ink-200" lineHeight={14 * SNUG}>
            {`${where}${where ? ' · ' : ''}${t('worth', { worth: fmt.compact(standing.netWorth) })}`}
          </ReadText>
        ) : null}
        {playing ? (
          <>
            <Explain style={{ marginTop: 8 }}>{t('about')}</Explain>
            <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
              <Button variant="primary" cell onPress={() => setLend(true)}>
                {t('offer')}
              </Button>
              <Button variant="secondary" cell onPress={() => setLend(false)}>
                {t('ask')}
              </Button>
            </View>
          </>
        ) : null}
        {over && member ? (
          <View style={{ marginTop: 12, gap: 6 }}>
            <Button variant="primary" wide disabled={busy || member.followed} onPress={() => void ask(async () => ({ ok: 'followed', full: 'full', failed: 'failed' })[await follow(member.userId)])}>
              {said(member.friend ? 'friends' : member.followed ? 'following' : 'follow')}
            </Button>
            {member.friend ? null : <ReadText size={13} tone="ink-300" style={{ textAlign: 'center' }}>{said('followAbout')}</ReadText>}
          </View>
        ) : null}
        {shown?.public && member && member.name !== null ? (
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <LinkButton disabled={busy} onPress={() => void ask(async () => ({ ok: 'reported', cleared: 'reported', nameless: 'reported', failed: 'failed' })[await report(member.userId)])}>
              {said('report')}
            </LinkButton>
          </View>
        ) : null}
        {told && !(told === 'followed' && member?.friend) ? (
          <View accessible role="status" style={{ marginTop: 8 }}>
            <ReadText size={13} tone="ink-200" style={{ textAlign: 'center' }}>{said(told)}</ReadText>
          </View>
        ) : null}
      </Sheet>
      {member && lend !== null ? <LoanSheet member={member} lend={lend} nameOf={nameOf} onClose={close} /> : null}
    </>
  );
}

/** The terms of a loan to offer: how much, at what rate, for how many rounds; what it comes to; and the offer sent. */
function LoanSheet({ member, lend, nameOf, onClose }: { member: RoomMember; lend: boolean; nameOf(member: Pick<RoomMember, 'name' | 'bot' | 'userId'>): string; onClose(): void }) {
  const t = useT('room.loan');
  const common = useT('common');
  const { content, fmt } = useWords();
  const offer = useRoom((s) => s.offerLoan);
  const cash = useGame((s) => s.view?.player.cash ?? 0);
  // Whole dollars, as typed (the web's number field), or one of the amounts a tap gives.
  const [typed, setTyped] = useState<string>(String(AMOUNTS[1]));
  const [rateBp, setRateBp] = useState<number>(500);
  const [rounds, setRounds] = useState<number>(3);
  const [state, setState] = useState<'idle' | 'sending' | 'failed'>('idle');
  const dollars = Number(typed === '' ? 0 : typed);
  const amount = Math.round(dollars * 100);
  const valid = Number.isFinite(amount) && amount >= LOAN_MIN && amount <= LOAN_MAX;
  const cost = valid ? loanCost(amount, rateBp, rounds, content.yearsPerRound) : null;
  const name = nameOf(member);
  const send = async () => {
    setState('sending');
    const answered = await offer({ to: member.userId, lend, amount, rateBp, rounds });
    if (answered === 'ok') onClose();
    else setState('failed');
  };

  return (
    <Sheet open onClose={onClose} title={t(lend ? 'offerTitle' : 'askTitle', { who: name })} closeLabel={common('close')}>
      <View style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <ReadText size={13} tone="ink-200">{t('amount')}</ReadText>
          <TextField label={t('amount')} kind="amount" value={typed} onChangeText={setTyped} maxLength={10} returnKeyType="done" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {AMOUNTS.map((each) => (
            <Raised
              key={each}
              bg={dollars === each ? 'gold-500' : 'night-600'}
              style={{ paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setTyped(String(each))}
            >
              <ReadText size={14} tone={dollars === each ? 'ink-900' : 'cream'}>{fmt.money(each * 100)}</ReadText>
            </Raised>
          ))}
        </View>
        {lend && amount > cash ? <ReadText size={12} tone="wine-300">{t('moreThanCash', { cash: fmt.money(cash) })}</ReadText> : null}
        <Segmented<number> label={t('rate')} value={rateBp} onChange={setRateBp} columns={4} options={LOAN_RATES_BP.map((bp) => ({ value: bp, label: fmt.rate(bp) }))} />
        <Segmented<number> label={t('rounds')} value={rounds} onChange={setRounds} options={LOAN_ROUNDS.map((n) => ({ value: n, label: String(n) }))} />
        {cost ? (
          <ReadText size={13} tone="ink-200" lineHeight={13 * SNUG}>
            {lend ? t('theyPay', { who: name, first: fmt.money(cost.first), total: fmt.money(cost.total) }) : t('youPay', { first: fmt.money(cost.first), total: fmt.money(cost.total) })}
          </ReadText>
        ) : (
          <ReadText size={12} tone="wine-300">{t('amountRange', { min: fmt.money(LOAN_MIN), max: fmt.money(LOAN_MAX) })}</ReadText>
        )}
        <Explain>{t('rules')}</Explain>
        {state === 'failed' ? (
          <View accessible role="alert">
            <ReadText size={13} tone="wine-300">{t('failed')}</ReadText>
          </View>
        ) : null}
        <Button variant="primary" wide disabled={!valid || state === 'sending'} onPress={() => void send()}>
          {t(lend ? 'sendOffer' : 'sendAsk', { who: name })}
        </Button>
      </View>
    </Sheet>
  );
}
