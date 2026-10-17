-- Loans between the players of a game: one offers to lend, or asks to borrow, an amount at a rate
-- for a number of rounds; the other says yes or no before the round turns, and the money changes
-- hands as it turns. Only the two of them see it. The lives themselves keep the loan once it is
-- paid out: this keeps the offers, and what came of each.
create table public.room_loans (
  id uuid primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  -- The round it was offered in, which is the round it is answered in and paid out at the turn of.
  round integer not null,
  proposer uuid not null,
  lender uuid not null,
  borrower uuid not null,
  amount bigint not null check (amount > 0),
  rate_bp integer not null check (rate_bp between 0 and 2000),
  rounds integer not null check (rounds between 1 and 5),
  -- open: waiting for an answer; accepted: to be paid out at the turn; refused or withdrawn: never;
  -- paid: paid out; failed: the lender had not the cash, or one of them was gone, at the turn;
  -- expired: nobody answered before the turn.
  status text not null default 'open' check (status in ('open', 'accepted', 'refused', 'withdrawn', 'paid', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  check (lender <> borrower),
  check (proposer = lender or proposer = borrower)
);
create index room_loans_room_round on public.room_loans (room_id, round);

alter table public.room_loans enable row level security;
revoke all on public.room_loans from public, anon, authenticated;
grant select on public.room_loans to authenticated;
create policy "the two players of a loan read it" on public.room_loans
  for select to authenticated using ((select auth.uid()) in (lender, borrower));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.room_loans;
  end if;
end;
$$;

-- Offers a loan in the round the game is in, between two players still in it. An offer from the
-- same player to the same other in that round is withdrawn for the new one. 'closed' for a game not
-- being played or a player gone; 'moved' for a round that has turned.
create function public.room_loan_offer(p_id uuid, p_room uuid, p_round integer, p_proposer uuid, p_lender uuid, p_borrower uuid, p_amount bigint, p_rate integer, p_rounds integer) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or r.status <> 'playing' then
    return 'closed';
  end if;
  if r.round <> p_round then
    return 'moved';
  end if;
  if (select count(*) from public.room_players where room_id = p_room and user_id in (p_lender, p_borrower) and left_at is null) <> 2 then
    return 'closed';
  end if;
  update public.room_loans set status = 'withdrawn'
    where room_id = p_room and round = p_round and proposer = p_proposer and status in ('open', 'accepted')
      and (case when lender = p_proposer then borrower else lender end) = (case when p_lender = p_proposer then p_borrower else p_lender end);
  insert into public.room_loans (id, room_id, round, proposer, lender, borrower, amount, rate_bp, rounds)
    values (p_id, p_room, p_round, p_proposer, p_lender, p_borrower, p_amount, p_rate, p_rounds);
  return 'ok';
end;
$$;
revoke all on function public.room_loan_offer(uuid, uuid, integer, uuid, uuid, uuid, bigint, integer, integer) from public, anon, authenticated;
grant execute on function public.room_loan_offer(uuid, uuid, integer, uuid, uuid, uuid, bigint, integer, integer) to service_role;

-- The other player's answer to an offer still open in the round it was made in: 'gone' for one that
-- is not, or not theirs to answer. Whoever made the offer may withdraw it the same way, with a no.
create function public.room_loan_answer(p_id uuid, p_member uuid, p_yes boolean) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.room_loans;
  r public.rooms;
begin
  select * into l from public.room_loans where id = p_id for update;
  if not found or l.status <> 'open' or p_member not in (l.lender, l.borrower) then
    return 'gone';
  end if;
  select * into r from public.rooms where id = l.room_id;
  if r.status <> 'playing' or r.round <> l.round then
    return 'gone';
  end if;
  if p_member = l.proposer then
    if p_yes then
      return 'gone';
    end if;
    update public.room_loans set status = 'withdrawn' where id = p_id;
  else
    update public.room_loans set status = case when p_yes then 'accepted' else 'refused' end where id = p_id;
  end if;
  return 'ok';
end;
$$;
revoke all on function public.room_loan_answer(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.room_loan_answer(uuid, uuid, boolean) to service_role;

-- What came of the offers of a round once it has turned: those paid out, the rest accepted that
-- could not be, and those nobody answered.
create function public.room_loans_close(p_room uuid, p_round integer, p_paid uuid[]) returns void
language sql
security definer
set search_path = ''
as $$
  update public.room_loans set status = case
      when id = any (p_paid) then 'paid'
      when status = 'accepted' then 'failed'
      else 'expired'
    end
    where room_id = p_room and round = p_round and status in ('open', 'accepted');
$$;
revoke all on function public.room_loans_close(uuid, integer, uuid[]) from public, anon, authenticated;
grant execute on function public.room_loans_close(uuid, integer, uuid[]) to service_role;
