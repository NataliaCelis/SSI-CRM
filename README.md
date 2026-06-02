# SSI Steel Bid Pipeline CRM

A full-stack bid management CRM for Southern Spear Ironworks, built with **React + Vite + Tailwind** on the frontend and **Supabase** (Postgres + Auth + RLS) on the backend.

---

## Project Structure

```
ssi-crm/
├── supabase/
│   └── schema.sql              ← Run this first in Supabase SQL Editor
├── src/
│   ├── lib/
│   │   ├── supabase.js         ← Supabase client + all data helpers
│   │   └── AuthContext.jsx     ← Auth state provider + role helpers
│   ├── hooks/
│   │   └── useData.js          ← useProjects, useStaff, useCompanies hooks
│   ├── pages/
│   │   └── LoginPage.jsx       ← Sign-in screen
│   ├── components/
│   │   ├── ProjectDetail.jsx   ← Slide-in panel (4 tabs)
│   │   ├── AddProjectModal.jsx ← New project form with GC builder
│   │   └── StaffDirectory.jsx  ← Team management modal
│   ├── App.jsx                 ← Main app (Pipeline + Table views)
│   ├── main.jsx                ← Entry point
│   └── index.css               ← Tailwind base
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example                ← Copy to .env and fill in
└── .gitignore
```

---

## Setup — Step by Step

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a name, password, and region (us-east-1 recommended for TN)
3. Wait for it to spin up (~2 min)

### 2. Run the Schema
1. In Supabase Dashboard → **SQL Editor**
2. Click **New Query**
3. Paste the entire contents of `supabase/schema.sql`
4. Click **Run**

This creates all tables, RLS policies, triggers, and seeds staff + roles.

### 3. Create Auth Users
For each staff member who needs to log in:

1. Supabase Dashboard → **Authentication** → **Users** → **Invite User**
2. Enter their email (must match the email in the `staff` table)
3. They'll get an email to set their password

Then link their auth account to their staff record:
```sql
-- Run in SQL Editor for each user after they accept the invite:
UPDATE staff
SET auth_user_id = (SELECT id FROM auth.users WHERE email = 'will@southernspearironworks.com')
WHERE email = 'will@southernspearironworks.com';
```

### 4. Get Your API Keys
Supabase Dashboard → **Settings** → **API**
- Copy **Project URL**
- Copy **anon/public key** (NOT the service role key)

### 5. Configure Environment
```bash
cp .env.example .env
```
Edit `.env`:
```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 6. Install & Run
```bash
npm install
npm run dev
```

App runs at **http://localhost:5173**

### 7. Deploy (optional)
```bash
npm run build
```
Upload the `dist/` folder to Netlify, Vercel, or any static host. Add your environment variables in the host's dashboard.

---

## Authentication & Roles

| Role | Can Do |
|------|--------|
| **Manager** | Change bid stage, assign tasks to anyone, manage staff, delete projects |
| **Sales Manager** | Change bid stage, assign tasks to Estimators & Sales |
| **Estimator** | Add notes (Estimator role), update task status |
| **Sales** | Add notes (Sales role), update task status |

- Roles are stored in `staff_roles` table
- RLS policies enforce read/write at the database level
- The `is_manager()` SQL function powers stage-change + task-assign gating

---

## Key Design Decisions

### Why not store GC/contact data directly on projects?
The normalized schema (`companies`, `contacts`, `project_companies`, `project_contacts`) means:
- A contact like "Dan Weaver at BL Harbert" exists once globally
- Autocomplete works across all projects
- You can filter "show me all projects BL Harbert is bidding on" easily

### RLS vs application-level auth
Supabase RLS means even if someone bypasses the UI, they can't read/write data without a valid JWT matching an authenticated user. This is real security, not just UI gating.

### Why `normalizeProjects()` in `useData.js`?
The Supabase join response has a nested shape (`project_companies[].project_contacts[].contact`). The normalizer flattens this to the same shape your existing React components expect, so the UI code stays clean.

---

## Migrating Your Existing Data

After running schema.sql, you can seed your existing projects by either:

**Option A — CSV Import**: Export your Excel data to CSV, use Supabase's Table Editor → Import CSV for each table.

**Option B — SQL Insert**: Paste `INSERT` statements for each project into SQL Editor. The `supabase.js` `createProject()` function handles the relational inserts if you call it programmatically.

**Option C — Run the app**: Use "+ New Project" to enter projects one by one. Takes ~5 min per project but gives you clean data entry with contact autocomplete.

---

## Troubleshooting

**"Missing Supabase environment variables"** → Make sure `.env` exists and has both variables. Restart the dev server after editing `.env`.

**"new row violates row-level security"** → The user's `auth_user_id` in the `staff` table doesn't match their Supabase Auth UUID. Run the `UPDATE staff SET auth_user_id = ...` query in Step 3.

**Staff member can't change bid stage** → Check their roles in `staff_roles`. Must be `Manager` or `Sales Manager`.

**Contact autocomplete not working** → Contacts only appear if they've been added to at least one project previously, or if you insert them directly into the `contacts` table.
