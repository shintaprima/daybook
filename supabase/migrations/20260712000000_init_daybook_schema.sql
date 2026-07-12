-- ============================================
-- Daybook — initial Supabase schema
-- Consolidated from design conversation on 2026-07-12
-- ============================================

-- TASKS (includes subtasks via parent_task_id)
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  parent_task_id uuid references tasks(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'backlog'
    check (status in ('backlog','to_do','on_going','done')),
  priority text,
  due_date date,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "users manage their own tasks"
on tasks for all
using (auth.uid() = user_id);

create index idx_tasks_user_id on tasks(user_id);
create index idx_tasks_parent_task_id on tasks(parent_task_id);

-- TAGS (user-scoped)
create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table tags enable row level security;

create policy "users manage their own tags"
on tags for all
using (auth.uid() = user_id);

create index idx_tags_user_id on tags(user_id);

-- TASK <-> TAG junction
create table task_tags (
  task_id uuid not null references tasks(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

alter table task_tags enable row level security;

create policy "users manage tags on their own tasks"
on task_tags for all
using (
  exists (select 1 from tasks where tasks.id = task_id and tasks.user_id = auth.uid())
);

create index idx_task_tags_task_id on task_tags(task_id);

-- TIME ENTRIES (the time log)
create table time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  started_at timestamptz not null,
  duration_minutes numeric(8,2) not null,
  note text,
  created_at timestamptz not null default now()
);

alter table time_entries enable row level security;

create policy "users manage their own time entries"
on time_entries for all
using (auth.uid() = user_id);

create index idx_time_entries_task_id on time_entries(task_id);

-- TASK STATUS HISTORY (cycle-time tracking)
create table task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default now()
);

alter table task_status_history enable row level security;

create policy "users see their own status history"
on task_status_history for all
using (auth.uid() = user_id);

create index idx_task_status_history_task_id on task_status_history(task_id);

-- FUNCTIONS + TRIGGERS

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_tasks_updated_at
before update on tasks
for each row
execute function set_updated_at();

create or replace function log_status_change()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into task_status_history (task_id, user_id, from_status, to_status)
    values (new.id, new.user_id, old.status, new.status);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_log_status_change
after update on tasks
for each row
execute function log_status_change();

-- EXPORT VIEW (reconstructs the original CSV export shape)
create or replace view time_entries_export as
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
  te.note
from time_entries te
join tasks t on t.id = te.task_id
left join tasks pt on pt.id = t.parent_task_id
order by te.started_at desc;
