-- ============================================
-- Daybook — reconcile schema with actual app data model
-- (App inspected directly in src/App.jsx on 2026-07-12)
-- ============================================

-- STATUS: fix ids to match app exactly (app uses no underscores)
alter table tasks drop constraint tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('backlog','todo','ongoing','done'));

-- PRIORITY: lock to app's actual values, app always sets one
alter table tasks add constraint tasks_priority_check
  check (priority in ('low','normal','high'));
alter table tasks alter column priority set default 'normal';
alter table tasks alter column priority set not null;

-- DATES: app has both startDate and endDate, not just one due date
alter table tasks rename column due_date to end_date;
alter table tasks add column start_date date;

-- TIME ENTRIES: restore manual flag — app displays it as a badge and includes it in CSV export
alter table time_entries add column manual boolean not null default false;

-- COMMENTS: tasks have a comment thread in the UI, not modeled until now
create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null,
  created_at timestamptz not null default now()
);

alter table task_comments enable row level security;

create policy "users manage their own task comments"
on task_comments for all
using (auth.uid() = user_id);

create index idx_task_comments_task_id on task_comments(task_id);

-- Bring the export view back in line with the real CSV shape (manual column restored)
-- Drop + recreate instead of "or replace": inserting a column mid-list changes
-- output column order, which Postgres won't allow via CREATE OR REPLACE VIEW.
drop view if exists time_entries_export;
create view time_entries_export as
select
  coalesce(pt.title, t.title) as task,
  case when pt.id is not null then t.title end as subtask,
  t.status,
  t.priority,
  (select coalesce(string_agg(tg.name, '; '), '')
     from task_tags tt join tags tg on tg.id = tt.tag_id
     where tt.task_id = t.id) as labels,
  case when t.archived then 'yes' else 'no' end as archived,
  te.started_at,
  te.duration_minutes,
  case when te.manual then 'yes' else 'no' end as manual,
  te.note
from time_entries te
join tasks t on t.id = te.task_id
left join tasks pt on pt.id = t.parent_task_id
order by te.started_at desc;
