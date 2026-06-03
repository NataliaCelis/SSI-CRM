import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchCurrentStaff(authUserId) {
  const { data, error } = await supabase
    .from('staff').select('*, staff_roles(role)').eq('auth_user_id', authUserId).single();
  if (error) throw error;
  return { ...data, roles: data.staff_roles?.map(r => r.role) || [] };
}

export async function fetchAllStaff() {
  const { data, error } = await supabase.from('staff').select('*, staff_roles(role)').order('name');
  if (error) throw error;
  return data?.map(s => ({ ...s, roles: s.staff_roles?.map(r => r.role) || [] })) || [];
}

// Manager-only: uses service call pattern, bypasses RLS via anon key + is_manager() check server-side
export async function upsertStaffMember(staffMember) {
  const { roles, staff_roles: _, ...staffData } = staffMember;
  let staffId = staffData.id;
  if (staffId) {
    const { error } = await supabase.from('staff').update({ name: staffData.name, email: staffData.email }).eq('id', staffId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('staff').insert({ name: staffData.name, email: staffData.email }).select().single();
    if (error) throw error;
    staffId = data.id;
  }
  const { error: delErr } = await supabase.from('staff_roles').delete().eq('staff_id', staffId);
  if (delErr) throw delErr;
  if (roles?.length) {
    const { error: insErr } = await supabase.from('staff_roles').insert(roles.map(role => ({ staff_id: staffId, role })));
    if (insErr) throw insErr;
  }
  return staffId;
}

export async function removeStaffMember(staffId, deletedById) {
  const { data } = await supabase.from('staff').select('*').eq('id', staffId).single();
  if (data) {
    await supabase.from('deleted_records').insert({ table_name: 'staff', record_id: staffId, record_data: data, deleted_by: deletedById });
  }
  await supabase.from('staff').delete().eq('id', staffId);
}

export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select(`*, estimator:estimator_id(id,name,email),
      project_awards(*,awarded_gc:awarded_gc_id(id,name),awarded_gc_contact:awarded_gc_contact_id(id,name,email,office_phone,cell_phone)),
      project_companies(id,company:company_id(id,name,company_type),
        project_contacts(contact:contact_id(id,name,email,office_phone,extension,cell_phone))),
      project_notes(*,staff:staff_id(id,name)),
      tasks(*,assignee:assignee_id(id,name,email),assigned_by:assigned_by_id(id,name))`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createProject(projectData) {
  const { companies: companiesData, ...project } = projectData;
  const { data, error } = await supabase.from('projects').insert(project).select().single();
  if (error) throw error;
  if (companiesData?.length) await upsertProjectCompanies(data.id, companiesData);
  return data;
}

export async function updateProject(id, updates) {
  const { companies: _, notes: __, tasks: ___, ...projectUpdates } = updates;
  const { error } = await supabase.from('projects').update(projectUpdates).eq('id', id);
  if (error) throw error;
}

export async function softDeleteProject(id, deletedById) {
  const { data } = await supabase.from('projects').select('*').eq('id', id).single();
  if (data) await supabase.from('deleted_records').insert({ table_name: 'projects', record_id: id, record_data: data, deleted_by: deletedById });
  await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id);
}

export async function updateProjectStage(id, stage) {
  const { error } = await supabase.from('projects').update({ stage }).eq('id', id);
  if (error) throw error;
}

export async function upsertProjectCompanies(projectId, companies) {
  await supabase.from('project_companies').delete().eq('project_id', projectId);
  for (const gc of companies) {
    if (!gc.name?.trim()) continue;
    let companyId = gc.id;
    if (!companyId) {
      const { data: existing } = await supabase.from('companies').select('id').ilike('name', gc.name).maybeSingle();
      if (existing) { companyId = existing.id; }
      else {
        const { data, error } = await supabase.from('companies').insert({ name: gc.name, company_type: 'GC' }).select().single();
        if (error) throw error;
        companyId = data.id;
      }
    }
    const { data: pcRow, error: pcErr } = await supabase.from('project_companies').insert({ project_id: projectId, company_id: companyId }).select().single();
    if (pcErr) throw pcErr;
    for (const contact of gc.contacts || []) {
      if (!contact.name?.trim()) continue;
      let contactId = contact.id;
      if (!contactId) {
        const { data, error } = await supabase.from('contacts').insert({ company_id: companyId, name: contact.name, email: contact.email, office_phone: contact.officePhone, extension: contact.ext, cell_phone: contact.cell }).select().single();
        if (error) throw error;
        contactId = data.id;
      }
      await supabase.from('project_contacts').insert({ project_company_id: pcRow.id, contact_id: contactId });
    }
  }
}

export async function upsertAward(projectId, awardData) {
  const { error } = await supabase.from('project_awards').upsert({ project_id: projectId, ...awardData }, { onConflict: 'project_id' });
  if (error) throw error;
}

export async function addNote(projectId, staffId, roleLabel, text) {
  const { data, error } = await supabase.from('project_notes')
    .insert({ project_id: projectId, staff_id: staffId, role_label: roleLabel, note_text: text })
    .select('*, staff:staff_id(id,name)').single();
  if (error) throw error;
  return data;
}

export async function softDeleteNote(noteId, deletedById) {
  const { data } = await supabase.from('project_notes').select('*').eq('id', noteId).single();
  if (data) await supabase.from('deleted_records').insert({ table_name: 'project_notes', record_id: noteId, record_data: data, deleted_by: deletedById });
  await supabase.from('project_notes').update({ deleted_at: new Date().toISOString() }).eq('id', noteId);
}

export async function addTask(projectId, task) {
  const { data, error } = await supabase.from('tasks')
    .insert({ project_id: projectId, ...task })
    .select('*, assignee:assignee_id(id,name,email), assigned_by:assigned_by_id(id,name)').single();
  if (error) throw error;
  return data;
}

export async function updateTask(taskId, updates) {
  const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
  if (error) throw error;
}

export async function softDeleteTask(taskId, deletedById) {
  const { data } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  if (data) await supabase.from('deleted_records').insert({ table_name: 'tasks', record_id: taskId, record_data: data, deleted_by: deletedById });
  await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', taskId);
}

export async function fetchAllCompanies() {
  const { data, error } = await supabase.from('companies').select('*, contacts(*)').order('name');
  if (error) throw error;
  return data || [];
}

export async function getNextENumber() {
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = `E${yy}-`;
  const { data } = await supabase.from('projects').select('e_number').like('e_number', `${prefix}%`).order('e_number', { ascending: false }).limit(1);
  if (!data?.length) return `${prefix}001`;
  const next = parseInt(data[0].e_number.replace(prefix, ''), 10) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

export async function fetchAppSettings() {
  const { data, error } = await supabase.from('app_settings').select('*');
  if (error) throw error;
  return Object.fromEntries((data || []).map(r => [r.key, r.value]));
}

export async function updateAppSetting(key, value) {
  const { error } = await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}
