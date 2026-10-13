-- The account's copy of a life never goes backwards.
--
-- A device sends the whole of the life it holds. One that has not looked at the account since
-- another device played further would write its older copy over the further one with its next
-- save, and nothing would say so. "The copy with more of it played wins" was a rule of the game's
-- code only; here it becomes a rule of the table. A save with less of the life played than the
-- account holds is refused under a code of its own (RR001), and the device that sent it reads the
-- account and takes the further copy.
--
-- How much of a life a log holds is counted as the game counts it: every card answered, and every
-- round played. Two copies as far along as each other may differ; the later save stands.
create function private.never_backwards() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  had int;
  has int;
begin
  if new.log is not distinct from old.log then
    return new;
  end if;
  select coalesce(sum(case when jsonb_typeof(entry -> 'picks') = 'array' then jsonb_array_length(entry -> 'picks') else 0 end
                    + case when jsonb_typeof(entry -> 'orders') = 'array' then 1 else 0 end), 0)
    into had from jsonb_array_elements(old.log) as entry;
  select coalesce(sum(case when jsonb_typeof(entry -> 'picks') = 'array' then jsonb_array_length(entry -> 'picks') else 0 end
                    + case when jsonb_typeof(entry -> 'orders') = 'array' then 1 else 0 end), 0)
    into has from jsonb_array_elements(new.log) as entry;
  if has < had then
    raise exception 'the account holds more of this life than this save does' using errcode = 'RR001';
  end if;
  return new;
end;
$$;
revoke all on function private.never_backwards() from public, anon, authenticated;
create trigger games_never_backwards before update on public.games for each row execute function private.never_backwards();
