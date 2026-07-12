-- ============================================
-- Daybook — support columns needed for the app's board view
-- ============================================

-- App sorts by "when did this task last change status" — give it a fast,
-- always-available column instead of deriving it from task_status_history
-- on every read.
alter table tasks add column status_changed_at timestamptz not null default now();

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  if old.status is distinct from new.status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

-- Labels: the app's label catalog (settings.labels) is still local-only for
-- now, using arbitrary string ids rather than the tags table's real uuids.
-- Rather than force that refactor right now, store the assigned label ids
-- directly on the task as a simple array. The tags/task_tags tables from the
-- first migration stay in place unused for now — can migrate to them later
-- if/when the label catalog itself moves into Supabase.
alter table tasks add column labels text[] not null default '{}';
