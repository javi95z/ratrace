-- Multiplayer at half a day a round: two rounds a day, morning and evening, between a game played
-- together and one of a round a day.
alter table public.rooms drop constraint rooms_seconds_check;
alter table public.rooms add constraint rooms_seconds_check check (seconds in (90, 180, 300, 43200, 86400));
