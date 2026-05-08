-- Owner-uploaded menu attachments. See #25.
--
set search_path = public, extensions;
-- Image-only for MVP; same Cloudinary pipeline as review photos. PDF
-- support is a follow-up so we can stay on the existing image transform
-- path and avoid pdf-renderer plumbing.
--
-- Idempotent.

create table if not exists public.place_menus (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  label text,
  cloudinary_public_id text not null,
  cloudinary_version text,
  width int,
  height int,
  bytes int,
  created_by uuid not null references public.users(id),
  is_demo boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists place_menus_place_idx on public.place_menus (place_id);
create index if not exists place_menus_is_demo_idx on public.place_menus (is_demo) where is_demo = true;

alter table public.place_menus enable row level security;

-- Public read so place cards can show menus to anyone.
drop policy if exists "place_menus_read_all" on public.place_menus;
create policy "place_menus_read_all" on public.place_menus for select using (true);

-- Insert/delete only by an active owner of the place.
drop policy if exists "place_menus_owner_insert" on public.place_menus;
create policy "place_menus_owner_insert" on public.place_menus for insert
  with check (
    exists (
      select 1 from public.place_owners po
      where po.place_id = place_menus.place_id
        and po.user_id = auth.uid()
        and po.revoked_at is null
    )
  );

drop policy if exists "place_menus_owner_delete" on public.place_menus;
create policy "place_menus_owner_delete" on public.place_menus for delete
  using (
    exists (
      select 1 from public.place_owners po
      where po.place_id = place_menus.place_id
        and po.user_id = auth.uid()
        and po.revoked_at is null
    )
  );
