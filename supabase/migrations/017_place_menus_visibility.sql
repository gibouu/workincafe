-- Menu visibility toggle. See #63.
--
-- Adds an `visibility` column so owners can keep a draft menu hidden
-- while they iterate on the photo / pricing. Public is still the default.
--
-- Idempotent.

alter table public.place_menus
  add column if not exists visibility text not null default 'public';

alter table public.place_menus
  drop constraint if exists place_menus_visibility_check;

alter table public.place_menus
  add constraint place_menus_visibility_check
  check (visibility in ('public', 'owner_only'));

-- Replace the public-read policy with one that lets the row through to
-- non-owners only when visibility is 'public'. Active owners always see
-- every menu they own (which keeps the draft path useful).
drop policy if exists "place_menus_read_all" on public.place_menus;
drop policy if exists "place_menus_read_public_or_owner" on public.place_menus;
create policy "place_menus_read_public_or_owner" on public.place_menus for select
  using (
    visibility = 'public'
    or exists (
      select 1 from public.place_owners po
      where po.place_id = place_menus.place_id
        and po.user_id = auth.uid()
        and po.revoked_at is null
    )
  );

-- Owner-only update path for the visibility flip (no full-row update — the
-- POST creates new rows, DELETE removes them; this PATCH is the single
-- field that needs mutation).
drop policy if exists "place_menus_owner_update" on public.place_menus;
create policy "place_menus_owner_update" on public.place_menus for update
  using (
    exists (
      select 1 from public.place_owners po
      where po.place_id = place_menus.place_id
        and po.user_id = auth.uid()
        and po.revoked_at is null
    )
  );
