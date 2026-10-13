-- The game speaks Russian too. A profile may say so.
alter table public.profiles drop constraint profiles_language_check;
alter table public.profiles add constraint profiles_language_check check (language in ('en', 'es', 'ru'));
