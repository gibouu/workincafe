-- Migration 023 — places.parent_place_id (#115)
--
-- Adds a self-referential pointer so a child place (e.g. a café inside a
-- hotel lobby) can link back to its parent (the hotel). Originally
-- motivated by hotel-lobby cafés (see #115), but the relationship is
-- generic — a food-court vendor inside a mall, a gym café inside a club,
-- a library café inside a university — all use the same column.
--
-- Nullable, on-delete-set-null: deleting a parent doesn't cascade-delete
-- its children. The child row stays valid as a standalone place; only
-- the relationship is forgotten.

set search_path = public, extensions;

alter table public.places
  add column if not exists parent_place_id uuid references public.places(id) on delete set null;

create index if not exists places_parent_place_id_idx
  on public.places(parent_place_id)
  where parent_place_id is not null;

comment on column public.places.parent_place_id is
  'Optional pointer to a containing place. Cafés in hotel lobbies, food-court vendors, etc. The child is a standalone place; this column adds a relationship.';
