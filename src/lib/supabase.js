import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ── Auth helpers ──────────────────────────────────────────

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function inviteUser(email) {
  // Managers can invite new users via Supabase Admin API
  // This uses the service role — do this from a server function in production
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
  if (error) throw error;
  return data;
}

// ── Staff helpers ────────────────────────────────────────

export async function fetchCurrentStaff(authUserId) {
  const { data, error } = await supabase
    .from('staff')
    .select('*, staff_roles(role)')
    .eq('auth_user_id', authUserId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchAllStaff() {
  const { data, error } = await supabase
    .from('staff')
    .select('*, staff_roles(role)')
    .order('name');
  if (error) throw error;
  return data?.map(s => ({
    ...s,
    roles: s.staff_roles?.map(r => r.role) || [],
  })) || [];
}

export async function upsertStaff(staffMember) {
  const { roles, staff_roles: _, ...staffData } = staffMember;
  let staffId = staffData.id;

  if (staffId) {
    const { error } = await supabase.from('staff').update(staffData).eq('id', staffId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('staff').insert(staffData).select().single();
    if (error) throw error;
    staffId = data.id;
  }

  // Replace roles
  await supabase.from('staff_roles').delete().eq('staff_id', staffId);
  if (roles?.length) {
    const { error } = await supabase.from('staff_roles').insert(
      roles.map(role => ({ staff_id: staffId, role }))
    );
    if (error) throw error;
  }

  return staffId;
}

export async function deleteStaff(staffId) {
  const { error } = await supabase.from('staff').delete().eq('id', staffId);
  if (error) throw error;
}

// ── Project helpers ───────────────────────────────────────

export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      estimator:estimator_id(id, name, email),
      project_awards(*,
        awarded_gc:awarded_gc_id(id, name),
        awarded_gc_contact:awarded_gc_contact_id(id, name, email, office_phone, cell_phone)
      ),
      project_companies(
        id,
        company:company_id(id, name, company_type),
        project_contacts(
          contact:contact_id(id, name, email, office_phone, extension, cell_phone)
        )
      ),
      project_notes(*, staff:staff_id(id, name)),
      tasks(*, assignee:assignee_id(id, name, email), assigned_by:assigned_by_id(id, name))
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createProject(projectData) {
  const {
    companies: companiesData,
    estimatorName,
    ...project
  } = projectData;

  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single();
  if (error) throw error;

  if (companiesData?.length) {
    await upsertProjectCompanies(data.id, companiesData);
  }

  return data;
}

export async function updateProject(id, updates) {
  const { companies: _, notes: __, tasks: ___, ...projectUpdates } = updates;
  const { error } = await supabase.from('projects').update(projectUpdates).eq('id', id);
  if (error) throw error;
}

export async function deleteProject(id) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

export async function updateProjectStage(id, stage) {
  const { error } = await supabase.from('projects').update({ stage }).eq('id', id);
  if (error) throw error;
}

// ── Project Companies ─────────────────────────────────────

export async function upsertProjectCompanies(projectId, companies) {
  // Remove existing
  await supabase.from('project_companies').delete().eq('project_id', projectId);

  for (const gc of companies) {
    // Upsert company
    let companyId = gc.id;
    if (!companyId) {
      const { data: existing } = await supabase
        .from('companies')
        .select('id')
        .ilike('name', gc.name)
        .single();
      if (existing) {
        companyId = existing.id;
      } else {
        const { data, error } = await supabase
          .from('companies')
          .insert({ name: gc.name, company_type: 'GC' })
          .select()
          .single();
        if (error) throw error;
        companyId = data.id;
      }
    }

    // Create project_companies link
    const { data: pcRow, error: pcErr } = await supabase
      .from('project_companies')
      .insert({ project_id: projectId, company_id: companyId })
      .select()
      .single();
    if (pcErr) throw pcErr;

    // Upsert contacts
    for (const contact of gc.contacts || []) {
      let contactId = contact.id;
      if (!contactId) {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            company_id: companyId,
            name: contact.name,
            email: contact.email,
            office_phone: contact.officePhone,
            extension: contact.ext,
            cell_phone: contact.cell,
          })
          .select()
          .single();
        if (error) throw error;
        contactId = data.id;
      }

      await supabase.from('project_contacts').insert({
        project_company_id: pcRow.id,
        contact_id: contactId,
      });
    }
  }
}

// ── Award Info ────────────────────────────────────────────

export async function upsertAward(projectId, awardData) {
  const { error } = await supabase
    .from('project_awards')
    .upsert({ project_id: projectId, ...awardData }, { onConflict: 'project_id' });
  if (error) throw error;
}

// ── Notes ─────────────────────────────────────────────────

export async function addNote(projectId, staffId, roleLabel, text) {
  const { data, error } = await supabase
    .from('project_notes')
    .insert({ project_id: projectId, staff_id: staffId, role_label: roleLabel, note_text: text })
    .select('*, staff:staff_id(id, name)')
    .single();
  if (error) throw error;
  return data;
}

// ── Tasks ─────────────────────────────────────────────────

export async function addTask(projectId, task) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ project_id: projectId, ...task })
    .select('*, assignee:assignee_id(id, name, email), assigned_by:assigned_by_id(id, name)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(taskId, updates) {
  const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
  if (error) throw error;
}

// ── Companies & Contacts (for autocomplete) ───────────────

export async function fetchAllCompanies() {
  const { data, error } = await supabase
    .from('companies')
    .select('*, contacts(*)')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function getNextENumber() {
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = `E${yy}-`;
  const { data } = await supabase
    .from('projects')
    .select('e_number')
    .like('e_number', `${prefix}%`)
    .order('e_number', { ascending: false })
    .limit(1);

  if (!data?.length) return `${prefix}001`;
  const last = data[0].e_number.replace(prefix, '');
  const next = parseInt(last, 10) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}
