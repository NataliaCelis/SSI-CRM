-- ============================================================
-- Southern Spear Ironworks CRM — Full Schema
-- Run this in Supabase SQL Editor (Settings > SQL Editor)
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Project ↔ Companies (GCs bidding) ─────────────────────
create table if not exists project_companies (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  unique(project_id, company_id)
);

-- ── Project ↔ Contacts (per GC, per project) ──────────────
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Updated_at trigger ────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_projects_updated_at before update on projects
  for each row execute function update_updated_at();
create trigger trg_awards_updated_at before update on project_awards
  for each row execute function update_updated_at();
create trigger trg_tasks_updated_at before update on tasks
  for each row execute function update_updated_at();
create trigger trg_staff_updated_at before update on staff
  for each row execute function update_updated_at();

-- ── Row Level Security ─────────────────────────────────────
alter table staff enable row level security;
alter table staff_roles enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table projects enable row level security;
alter table project_companies enable row level security;
alter table project_contacts enable row level security;
alter table project_awards enable row level security;
alter table project_notes enable row level security;
alter table tasks enable row level security;

-- Helper: check if current user is a manager
create or replace function is_manager()
returns boolean as $$
  select exists (
    select 1 from staff s
    join staff_roles sr on sr.staff_id = s.id
    where s.auth_user_id = auth.uid()
    and sr.role in ('Manager', 'Sales Manager')
  );
$$ language sql security definer;

-- Helper: get current staff id
create or replace function current_staff_id()
returns uuid as $$
  select id from staff where auth_user_id = auth.uid() limit 1;
$$ language sql security definer;

-- Staff: all authenticated users can read, only managers can write
create policy "staff_read" on staff for select using (auth.role() = 'authenticated');
create policy "staff_write" on staff for all using (is_manager());

create policy "staff_roles_read" on staff_roles for select using (auth.role() = 'authenticated');
create policy "staff_roles_write" on staff_roles for all using (is_manager());

-- Companies: all authenticated read/write
create policy "companies_read" on companies for select using (auth.role() = 'authenticated');
create policy "companies_write" on companies for all using (auth.role() = 'authenticated');

-- Contacts: all authenticated read/write
create policy "contacts_read" on contacts for select using (auth.role() = 'authenticated');
create policy "contacts_write" on contacts for all using (auth.role() = 'authenticated');

-- Projects: all authenticated read; managers can write freely; estimators/sales can update limited fields
create policy "projects_read" on projects for select using (auth.role() = 'authenticated');
create policy "projects_insert" on projects for insert with check (auth.role() = 'authenticated');
create policy "projects_update" on projects for update using (auth.role() = 'authenticated');
create policy "projects_delete" on projects for delete using (is_manager());

-- Project companies/contacts: all authenticated
create policy "pc_read" on project_companies for select using (auth.role() = 'authenticated');
create policy "pc_write" on project_companies for all using (auth.role() = 'authenticated');
create policy "pct_read" on project_contacts for select using (auth.role() = 'authenticated');
create policy "pct_write" on project_contacts for all using (auth.role() = 'authenticated');

-- Awards: all authenticated
create policy "awards_read" on project_awards for select using (auth.role() = 'authenticated');
create policy "awards_write" on project_awards for all using (auth.role() = 'authenticated');

-- Notes: all authenticated
create policy "notes_read" on project_notes for select using (auth.role() = 'authenticated');
create policy "notes_write" on project_notes for all using (auth.role() = 'authenticated');

-- Tasks: all authenticated
create policy "tasks_read" on tasks for select using (auth.role() = 'authenticated');
create policy "tasks_write" on tasks for all using (auth.role() = 'authenticated');

-- ── Seed Staff ────────────────────────────────────────────
-- NOTE: After creating users in Supabase Auth, update auth_user_id for each staff member.
-- Run seed_staff.sql after creating auth users.

insert into staff (name, email) values
  ('Will', 'will@southernspearironworks.com'),
  ('Lee', 'lee@southernspearironworks.com'),
  ('Mike', 'mike@southernspearironworks.com'),
  ('Clint', 'clint@southernspearironworks.com'),
  ('Leo', 'leo@southernspearironworks.com'),
  ('Sean', 'sean@southernspearironworks.com'),
  ('Beam AI', 'estimating@southernspearironworks.com')
on conflict (email) do nothing;

-- Assign roles
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
    (will_id,  'Manager'),
    (lee_id,   'Estimator'),
    (mike_id,  'Estimator'),
    (clint_id, 'Estimator'),
    (leo_id,   'Estimator'),
    (leo_id,   'Sales'),
    (sean_id,  'Sales'),
    (beam_id,  'Estimator')
  on conflict (staff_id, role) do nothing;
end;
$$;
