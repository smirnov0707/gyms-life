-- Cover self-referential history lookups and foreign-key maintenance when a
-- memory record is replaced or removed.
create index if not exists user_memory_superseded_by_idx
  on public.user_memory (superseded_by)
  where superseded_by is not null;
