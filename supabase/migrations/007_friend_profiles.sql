-- 007: Friend profiles. Replaces the email-only /waitlist/partners with a
-- structured intake (occupation, work style, looking-for, identity, open-to,
-- bio). Profile is keyed by user_id so it upserts cleanly.

create table if not exists public.friend_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  occupation text,
  work_style text check (work_style in ('quiet_focus','brainstormer','idea_bouncer','company_only')),
  looking_for text[] not null default '{}',
  industry text[] not null default '{}',
  gender text check (gender in ('woman','man','non_binary','prefer_not_to_say')),
  open_to text[] not null default '{}',
  bio text check (char_length(bio) <= 280),
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists friend_profiles_active_idx on public.friend_profiles (active) where active = true;
create index if not exists friend_profiles_is_demo_idx on public.friend_profiles (is_demo) where is_demo = true;

alter table public.friend_profiles enable row level security;

drop policy if exists "fp_read_active" on public.friend_profiles;
create policy "fp_read_active" on public.friend_profiles for select using (active = true);

drop policy if exists "fp_upsert_own" on public.friend_profiles;
create policy "fp_upsert_own" on public.friend_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- updated_at trigger
create or replace function public.touch_friend_profiles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists friend_profiles_touch on public.friend_profiles;
create trigger friend_profiles_touch
  before update on public.friend_profiles
  for each row execute function public.touch_friend_profiles_updated_at();
