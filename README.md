# SSI Steel Bid Pipeline CRM

A full-stack bid management CRM for Southern Spear Ironworks, built with React + Vite + Tailwind on the frontend and Supabase (Postgres + Auth + RLS) on the backend.

---

## Project Structure

```
ssi-crm/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── lib/
│   │   ├── supabase.js
│   │   └── AuthContext.jsx
│   ├── hooks/
│   │   └── useData.js
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   └── AcceptInvitePage.jsx
│   └── components/
│       ├── ProjectDetail.jsx
│       ├── AddProjectModal.jsx
│       ├── StaffDirectory.jsx
│       └── EmailTemplateModal.jsx
└── supabase/
    └── schema.sql
```

---

## Setup

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com) → New Project. Wait for it to spin up (~2 min).

### 2. Run the Schema

Supabase Dashboard → **SQL Editor** → New Query → paste contents of `supabase/schema.sql` → **Run**

### 3. Get Your API Keys

Supabase Dashboard → **Settings** → **API**

Copy:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public key** → `VITE_SUPABASE_ANON_KEY`

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 5. Install & Run Locally

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`

### 6. Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import repo
3. Framework preset: **Vite**
4. Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
5. Deploy

### 7. Configure Supabase Auth URLs

Supabase Dashboard → **Authentication** → **URL Configuration**

```
Site URL:       https://your-app.vercel.app
Redirect URLs:  https://your-app.vercel.app/*
                https://your-app.vercel.app/auth/callback
```

---

## Inviting Users

All access is invite-only — no public sign-up.

**Step 1 — Invite in Supabase:**

Supabase Dashboard → **Authentication** → **Users** → **Invite User** → enter email

**Step 2 — Link to staff record** (run after they accept the invite):

```sql
UPDATE staff
SET auth_user_id = (
  SELECT id FROM auth.users WHERE email = 'their@email.com' LIMIT 1
)
WHERE email = 'their@email.com';
```

**Step 3** — They sign out and back in. Done.

---

## Adding a Manager

```sql
-- Add staff member
INSERT INTO staff (name, email)
VALUES ('Name', 'their@email.com')
ON CONFLICT (email) DO NOTHING;

-- Assign Manager role
INSERT INTO staff_roles (staff_id, role)
SELECT id, 'Manager' FROM staff WHERE email = 'their@email.com'
ON CONFLICT (staff_id, role) DO NOTHING;

-- Link auth account (after they accept invite)
UPDATE staff
SET auth_user_id = (
  SELECT id FROM auth.users WHERE email = 'their@email.com' LIMIT 1
)
WHERE email = 'their@email.com';
```

---

## Roles

| Role | Permissions |
|------|------------|
| **Manager** | Full access — edit/delete anything, change bid stage, assign tasks, manage staff |
| **Sales Manager** | Change bid stage, assign tasks, add notes |
| **Estimator** | Add Estimator notes, update own task status |
| **Sales** | Add Sales notes, update own task status |

---

## Stages

Pipeline order: **Projects in Review → WIP → Sent → Pending Award → Won → Lost → No Bid / Cancelled**

---

## Exporting Data

Switch to **Table** view → click **⬇ Export to Excel / CSV**

Exports all currently visible/filtered projects as a `.csv` file that opens in Excel.

---

## Verify Staff Links

Run this anytime to check who is linked:

```sql
SELECT s.name, s.email,
  CASE WHEN s.auth_user_id IS NOT NULL THEN 'LINKED' ELSE 'NOT LINKED' END AS status,
  array_agg(sr.role ORDER BY sr.role) AS roles
FROM staff s
LEFT JOIN staff_roles sr ON sr.staff_id = s.id
GROUP BY s.id, s.name, s.email, s.auth_user_id
ORDER BY s.name;
```

---

## Fix Common Errors

**`invalid input syntax for type boolean`**
```sql
ALTER TABLE projects ALTER COLUMN sales_tax TYPE text USING
  CASE WHEN sales_tax = true THEN 'YES' WHEN sales_tax = false THEN 'NO' ELSE NULL END;
ALTER TABLE projects ALTER COLUMN prevailing_wages TYPE text USING
  CASE WHEN prevailing_wages = true THEN 'YES' WHEN prevailing_wages = false THEN 'NO' ELSE NULL END;
```

**`column does not exist` on project_awards**
```sql
ALTER TABLE project_awards ADD COLUMN IF NOT EXISTS awarded_gc_contact_name text;
ALTER TABLE project_awards ADD COLUMN IF NOT EXISTS awarded_gc_phone text;
ALTER TABLE project_awards ADD COLUMN IF NOT EXISTS awarded_gc_email text;
ALTER TABLE project_awards ADD COLUMN IF NOT EXISTS steel_sub text;
ALTER TABLE project_awards ADD COLUMN IF NOT EXISTS award_notes text;
ALTER TABLE project_awards ADD COLUMN IF NOT EXISTS our_tonnage numeric;
ALTER TABLE project_awards ADD COLUMN IF NOT EXISTS winning_sub_tonnage numeric;
ALTER TABLE project_awards ADD COLUMN IF NOT EXISTS winning_sub_price numeric;
```

**`record "new" has no field "updated_at"`**
```sql
DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS trg_awards_updated_at ON project_awards;
DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
DROP TRIGGER IF EXISTS trg_staff_updated_at ON staff;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
```
Then:
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_awards_updated_at BEFORE UPDATE ON project_awards FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**`new row violates row-level security`**

Your `auth_user_id` isn't linked. Run the link query above for your email.

---

## Where Is My Data?

Your data lives in Supabase — completely separate from Vercel. Redeploying never touches the database. View it anytime at **Supabase Dashboard → Table Editor**.

Free tier pauses after 7 days of inactivity. Upgrade to Pro ($25/mo) to prevent this.
