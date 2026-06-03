-- ============================================================
-- Southern Spear Ironworks CRM — Full Schema v2
-- Run this in Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── Staff / Users ──────────────────────────────────────────
create table if not exists staff (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists staff_roles (
  id uuid primary key default uuid_generate_v4(),
  staff_id uuid references staff(id) on delete cascade,
  role text not null check (role in ('Manager', 'Sales Manager', 'Estimator', 'Sales')),
  unique(staff_id, role)
);

-- ── App Settings (email template, etc) ────────────────────
create table if not exists app_settings (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  value text,
  updated_by uuid references staff(id) on delete set null,
  updated_at timestamptz default now()
);

insert into app_settings (key, value) values
  ('task_email_template', 'Hi {assignee_name},

You have been assigned a new task on project {project_name} ({e_number}).

Task: {task_title}
Details: {task_description}
Due Date: {due_date}

Please log in to the Steel Bid Pipeline to update the task status.

— {assigned_by}')
on conflict (key) do nothing;

-- ── Companies ──────────────────────────────────────────────
create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  company_type text default 'GC' check (company_type in ('GC', 'Steel Sub', 'Other')),
  created_at timestamptz default now()
);

-- ── Contacts ──────────────────────────────────────────────
create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  email text,
  office_phone text,
  extension text,
  cell_phone text,
  created_at timestamptz default now()
);

-- ── Projects ──────────────────────────────────────────────
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  e_number text unique,
  project_name text not null,
  project_type text,
  estimator_id uuid references staff(id) on delete set null,
  city text,
  state text,
  bid_date date,
  addenda integer default 0,
  tonnage numeric,
  ssi_price numeric default 0,
  stage text not null default 'Under Review' check (
    stage in ('Under Review','Sent','Pending Award','Won','Lost','No Bid / Cancelled')
  ),
  distance_miles numeric,
  sales_tax text,
  prevailing_wages text,
  fab_cost numeric,
  erect_cost numeric,
  follow_up_date date,
  prequal text,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Project ↔ Companies ────────────────────────────────────
create table if not exists project_companies (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  unique(project_id, company_id)
);

-- ── Project ↔ Contacts ─────────────────────────────────────
create table if not exists project_contacts (
  id uuid primary key default uuid_generate_v4(),
  project_company_id uuid references project_companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  unique(project_company_id, contact_id)
);

-- ── Award Info ─────────────────────────────────────────────
create table if not exists project_awards (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid unique references projects(id) on delete cascade,
  awarded_gc_id uuid references companies(id) on delete set null,
  awarded_gc_contact_id uuid references contacts(id) on delete set null,
  awarded_gc_contact_name text,
  awarded_gc_phone text,
  awarded_gc_email text,
  steel_sub text,
  awarded_price numeric,
  award_notes text,
  our_tonnage numeric,
  winning_sub_tonnage numeric,
  winning_sub_price numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Activity Notes ─────────────────────────────────────────
create table if not exists project_notes (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  staff_id uuid references staff(id) on delete set null,
  role_label text check (role_label in ('Estimator', 'Sales')),
  note_text text not null,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- ── Tasks ──────────────────────────────────────────────────
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references staff(id) on delete set null,
  assigned_by_id uuid references staff(id) on delete set null,
  due_date date,
  status text default 'Open' check (status in ('Open', 'In Progress', 'Done')),
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Soft-delete audit log ──────────────────────────────────
create table if not exists deleted_records (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  record_id uuid not null,
  record_data jsonb not null,
  deleted_by uuid references staff(id) on delete set null,
  deleted_at timestamptz default now()
);

-- ── Triggers ──────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create or replace trigger trg_projects_updated_at before update on projects for each row execute function update_updated_at();
create or replace trigger trg_awards_updated_at before update on project_awards for each row execute function update_updated_at();
create or replace trigger trg_tasks_updated_at before update on tasks for each row execute function update_updated_at();
create or replace trigger trg_staff_updated_at before update on staff for each row execute function update_updated_at();

-- ── Row Level Security ─────────────────────────────────────
alter table staff enable row level security;
alter table staff_roles enable row level security;
alter table app_settings enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table projects enable row level security;
alter table project_companies enable row level security;
alter table project_contacts enable row level security;
alter table project_awards enable row level security;
alter table project_notes enable row level security;
alter table tasks enable row level security;
alter table deleted_records enable row level security;

create or replace function is_manager()
returns boolean as $$
  select exists (
    select 1 from staff s
    join staff_roles sr on sr.staff_id = s.id
    where s.auth_user_id = auth.uid()
    and sr.role in ('Manager', 'Sales Manager')
  );
$$ language sql security definer;

create or replace function current_staff_id()
returns uuid as $$
  select id from staff where auth_user_id = auth.uid() limit 1;
$$ language sql security definer;

-- Drop existing policies to avoid conflicts
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- Staff policies — all authenticated can read; managers can write
create policy "staff_select" on staff for select using (auth.role() = 'authenticated');
create policy "staff_insert" on staff for insert with check (is_manager());
create policy "staff_update" on staff for update using (is_manager());
create policy "staff_delete" on staff for delete using (is_manager());

-- Staff roles — use security definer function to bypass RLS for role checks
create policy "staff_roles_select" on staff_roles for select using (auth.role() = 'authenticated');
create policy "staff_roles_insert" on staff_roles for insert with check (is_manager());
create policy "staff_roles_update" on staff_roles for update using (is_manager());
create policy "staff_roles_delete" on staff_roles for delete using (is_manager());

-- App settings
create policy "settings_select" on app_settings for select using (auth.role() = 'authenticated');
create policy "settings_write" on app_settings for all using (is_manager());

-- Companies & contacts
create policy "companies_select" on companies for select using (auth.role() = 'authenticated');
create policy "companies_write" on companies for all using (auth.role() = 'authenticated');
create policy "contacts_select" on contacts for select using (auth.role() = 'authenticated');
create policy "contacts_write" on contacts for all using (auth.role() = 'authenticated');

-- Projects
create policy "projects_select" on projects for select using (auth.role() = 'authenticated');
create policy "projects_insert" on projects for insert with check (auth.role() = 'authenticated');
create policy "projects_update" on projects for update using (auth.role() = 'authenticated');
create policy "projects_delete" on projects for delete using (is_manager());

-- Project companies/contacts
create policy "pc_select" on project_companies for select using (auth.role() = 'authenticated');
create policy "pc_write" on project_companies for all using (auth.role() = 'authenticated');
create policy "pct_select" on project_contacts for select using (auth.role() = 'authenticated');
create policy "pct_write" on project_contacts for all using (auth.role() = 'authenticated');

-- Awards
create policy "awards_select" on project_awards for select using (auth.role() = 'authenticated');
create policy "awards_write" on project_awards for all using (auth.role() = 'authenticated');

-- Notes
create policy "notes_select" on project_notes for select using (auth.role() = 'authenticated');
create policy "notes_write" on project_notes for all using (auth.role() = 'authenticated');

-- Tasks
create policy "tasks_select" on tasks for select using (auth.role() = 'authenticated');
create policy "tasks_write" on tasks for all using (auth.role() = 'authenticated');

-- Deleted records — managers only
create policy "deleted_select" on deleted_records for select using (is_manager());
create policy "deleted_insert" on deleted_records for insert with check (auth.role() = 'authenticated');

-- ── Seed Staff ────────────────────────────────────────────
insert into staff (name, email) values
  ('Will', 'will@southernspearironworks.com'),
  ('Lee', 'lee@southernspearironworks.com'),
  ('Mike', 'mike@southernspearironworks.com'),
  ('Clint', 'clint@southernspearironworks.com'),
  ('Leo', 'leo@southernspearironworks.com'),
  ('Sean', 'sean@southernspearironworks.com'),
  ('Beam AI', 'estimating@southernspearironworks.com')
on conflict (email) do nothing;

do $$
declare
  will_id uuid; lee_id uuid; mike_id uuid; clint_id uuid;
  leo_id uuid; sean_id uuid; beam_id uuid;
begin
  select id into will_id  from staff where email = 'will@southernspearironworks.com';
  select id into lee_id   from staff where email = 'lee@southernspearironworks.com';
  select id into mike_id  from staff where email = 'mike@southernspearironworks.com';
  select id into clint_id from staff where email = 'clint@southernspearironworks.com';
  select id into leo_id   from staff where email = 'leo@southernspearironworks.com';
  select id into sean_id  from staff where email = 'sean@southernspearironworks.com';
  select id into beam_id  from staff where email = 'estimating@southernspearironworks.com';
  insert into staff_roles (staff_id, role) values
    (will_id,'Manager'),(lee_id,'Estimator'),(mike_id,'Estimator'),
    (clint_id,'Estimator'),(leo_id,'Estimator'),(leo_id,'Sales'),
    (sean_id,'Sales'),(beam_id,'Estimator')
  on conflict (staff_id, role) do nothing;
end;
$$;
