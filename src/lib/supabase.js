import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// ── Auth ──────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ── Staff ─────────────────────────────────────────────────
export async function fetchCurrentStaff(authUserId) {
  // Use maybeSingle so a missing link doesn't throw
  const { data, error } = await supabase
    .from('staff').select('*, staff_roles(role)').eq('auth_user_id', authUserId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, roles: data.staff_roles?.map(r => r.role) || [] };
}

export async function fetchAllStaff() {
  const { data, error } = await supabase.from('staff').select('*, staff_roles(role)').order('name');
  if (error) throw error;
  return data?.map(s => ({ ...s, roles: s.staff_roles?.map(r => r.role) || [] })) || [];
}

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
  // Delete then re-insert roles
  await supabase.from('staff_roles').delete().eq('staff_id', staffId);
  if (roles?.length) {
    const { error } = await supabase.from('staff_roles').insert(roles.map(role => ({ staff_id: staffId, role })));
    if (error) throw error;
  }
  return staffId;
}

export async function removeStaffMember(staffId, deletedById) {
  const { data } = await supabase.from('staff').select('*').eq('id', staffId).single();
  if (data) await saveDeletedRecord('staff', staffId, data, deletedById);
  const { error } = await supabase.from('staff').delete().eq('id', staffId);
  if (error) throw error;
}

// ── Soft delete helper ────────────────────────────────────
async function saveDeletedRecord(tableName, recordId, recordData, deletedById) {
  await supabase.from('deleted_records').insert({
    table_name: tableName, record_id: recordId,
    record_data: recordData, deleted_by: deletedById,
  });
}

// ── Projects ──────────────────────────────────────────────
export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select(`*,
      estimator:estimator_id(id,name,email),
      project_awards(*,
        awarded_gc:awarded_gc_id(id,name),
        awarded_gc_contact:awarded_gc_contact_id(id,name,email,office_phone,cell_phone)
      ),
      project_companies(id,
        company:company_id(id,name,company_type),
        project_contacts(contact:contact_id(id,name,email,office_phone,extension,cell_phone))
      ),
      project_notes(*,staff:staff_id(id,name)),
      tasks(*,assignee:assignee_id(id,name,email),assigned_by:assigned_by_id(id,name))
    `)
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
  // Strip non-column keys
  const { companies: _, notes: __, tasks: ___, ...projectUpdates } = updates;
  const { error } = await supabase.from('projects').update(projectUpdates).eq('id', id);
  if (error) throw error;
}

export async function softDeleteProject(id, deletedById) {
  const { data } = await supabase.from('projects').select('*').eq('id', id).single();
  if (data) await saveDeletedRecord('projects', id, data, deletedById);
  const { error } = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function updateProjectStage(id, stage) {
  const { error } = await supabase.from('projects').update({ stage }).eq('id', id);
  if (error) throw error;
}

// ── Project Companies ─────────────────────────────────────
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
        const { data, error } = await supabase.from('contacts').insert({
          company_id: companyId, name: contact.name, email: contact.email,
          office_phone: contact.officePhone, extension: contact.ext, cell_phone: contact.cell,
        }).select().single();
        if (error) throw error;
        contactId = data.id;
      }
      await supabase.from('project_contacts').insert({ project_company_id: pcRow.id, contact_id: contactId });
    }
  }
}

// ── Awards ────────────────────────────────────────────────
export async function upsertAward(projectId, awardData) {
  const { error } = await supabase.from('project_awards')
    .upsert({ project_id: projectId, ...awardData }, { onConflict: 'project_id' });
  if (error) throw error;
}

// ── Notes ─────────────────────────────────────────────────
export async function addNote(projectId, staffId, roleLabel, text) {
  const { data, error } = await supabase.from('project_notes')
    .insert({ project_id: projectId, staff_id: staffId, role_label: roleLabel, note_text: text })
    .select('*, staff:staff_id(id,name)').single();
  if (error) throw error;
  return data;
}

export async function softDeleteNote(noteId, deletedById) {
  const { data } = await supabase.from('project_notes').select('*').eq('id', noteId).single();
  if (data) await saveDeletedRecord('project_notes', noteId, data, deletedById);
  const { error } = await supabase.from('project_notes').update({ deleted_at: new Date().toISOString() }).eq('id', noteId);
  if (error) throw error;
}

// ── Tasks ─────────────────────────────────────────────────
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
  if (data) await saveDeletedRecord('tasks', taskId, data, deletedById);
  const { error } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', taskId);
  if (error) throw error;
}

// ── Companies ─────────────────────────────────────────────
export async function fetchAllCompanies() {
  const { data, error } = await supabase.from('companies').select('*, contacts(*)').order('name');
  if (error) throw error;
  return data || [];
}

// ── E# ────────────────────────────────────────────────────
export async function getNextENumber() {
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = `E${yy}-`;
  const { data } = await supabase.from('projects').select('e_number').like('e_number', `${prefix}%`).order('e_number', { ascending: false }).limit(1);
  if (!data?.length) return `${prefix}001`;
  const next = parseInt(data[0].e_number.replace(prefix, ''), 10) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

// ── App Settings ──────────────────────────────────────────
export async function fetchAppSettings() {
  const { data, error } = await supabase.from('app_settings').select('*');
  if (error) return {};
  return Object.fromEntries((data || []).map(r => [r.key, r.value]));
}

export async function updateAppSetting(key, value) {
  const { error } = await supabase.from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}

// ── Distance calculation (Haversine from Chattanooga TN) ──
const CHATT = { lat: 35.0456, lng: -85.3097 };
const CITY_COORDS = {
  "havelock,nc":{lat:34.8793,lng:-76.9011},"beaufort,sc":{lat:32.4316,lng:-80.6698},
  "key west,fl":{lat:24.5551,lng:-81.7800},"ft. leonard wood,mo":{lat:37.7298,lng:-92.1385},
  "ft. meade,md":{lat:39.1043,lng:-76.7427},"barksdale,la":{lat:32.5018,lng:-93.6627},
  "oklahoma city,ok":{lat:35.4676,lng:-97.5164},"auburn,al":{lat:32.6099,lng:-85.4808},
  "telford,tn":{lat:36.3812,lng:-82.5321},"gadsden,al":{lat:34.0143,lng:-86.0066},
  "fort smith,ar":{lat:35.3859,lng:-94.3985},"corpus christi,tx":{lat:27.8006,lng:-97.3964},
  "montgomery,al":{lat:32.3668,lng:-86.2999},"charlotte,nc":{lat:35.2271,lng:-80.8431},
  "naperville,il":{lat:41.7508,lng:-88.1535},"meridian,ms":{lat:32.3643,lng:-88.7037},
  "chapel hill,nc":{lat:35.9132,lng:-79.0558},"jacksonville,nc":{lat:34.7541,lng:-77.4302},
  "jacksonville,fl":{lat:30.3322,lng:-81.6557},"fort campbell,ky":{lat:36.6554,lng:-87.4748},
  "chambersburg,pa":{lat:39.9370,lng:-77.6611},"huntsville,al":{lat:34.7304,lng:-86.5861},
  "hyattsville,md":{lat:38.9562,lng:-76.9455},"goose creek,sc":{lat:32.9810,lng:-80.0320},
  "knoxville,tn":{lat:35.9606,lng:-83.9207},"johnson city,tn":{lat:36.3134,lng:-82.3535},
  "maryville,tn":{lat:35.7565,lng:-84.0166},"cookeville,tn":{lat:36.1628,lng:-85.5016},
  "chattanooga,tn":{lat:35.0456,lng:-85.3097},"collegedale,tn":{lat:35.0534,lng:-85.0583},
  "manchester,tn":{lat:35.4817,lng:-86.0888},"cleveland,tn":{lat:35.1595,lng:-84.8766},
  "soddy daisy,tn":{lat:35.2337,lng:-85.1769},"memphis,tn":{lat:35.1495,lng:-90.0490},
  "birmingham,al":{lat:33.5186,lng:-86.8104},"mobile,al":{lat:30.6954,lng:-88.0399},
  "huntsville,al":{lat:34.7304,lng:-86.5861},"montgomery,al":{lat:32.3668,lng:-86.2999},
  "charlotte,nc":{lat:35.2271,lng:-80.8431},"raleigh,nc":{lat:35.7796,lng:-78.6382},
  "atlanta,ga":{lat:33.7490,lng:-84.3880},"savannah,ga":{lat:32.0835,lng:-81.0998},
  "nashville,tn":{lat:36.1627,lng:-86.7816},"louisville,ky":{lat:38.2527,lng:-85.7585},
  "lexington,ky":{lat:38.0406,lng:-84.5037},"columbia,sc":{lat:34.0007,lng:-81.0348},
  "charleston,sc":{lat:32.7765,lng:-79.9311},"miami,fl":{lat:25.7617,lng:-80.1918},
  "tampa,fl":{lat:27.9506,lng:-82.4572},"orlando,fl":{lat:28.5383,lng:-81.3792},
  "pensacola,fl":{lat:30.4213,lng:-87.2169},"houston,tx":{lat:29.7604,lng:-95.3698},
  "dallas,tx":{lat:32.7767,lng:-96.7970},"san antonio,tx":{lat:29.4241,lng:-98.4936},
  "new orleans,la":{lat:29.9511,lng:-90.0715},"jackson,ms":{lat:32.2988,lng:-90.1848},
  "little rock,ar":{lat:34.7465,lng:-92.2896},"st. louis,mo":{lat:38.6270,lng:-90.1994},
  "kansas city,mo":{lat:39.0997,lng:-94.5786},"chicago,il":{lat:41.8781,lng:-87.6298},
  "indianapolis,in":{lat:39.7684,lng:-86.1581},"columbus,oh":{lat:39.9612,lng:-82.9988},
  "cincinnati,oh":{lat:39.1031,lng:-84.5120},"cleveland,oh":{lat:41.4993,lng:-81.6944},
  "pittsburgh,pa":{lat:40.4406,lng:-79.9959},"philadelphia,pa":{lat:39.9526,lng:-75.1652},
  "washington,dc":{lat:38.9072,lng:-77.0369},"baltimore,md":{lat:39.2904,lng:-76.6122},
  "richmond,va":{lat:37.5407,lng:-77.4360},"norfolk,va":{lat:36.8508,lng:-76.2859},
  "virginia beach,va":{lat:36.8529,lng:-75.9780},"fort bragg,nc":{lat:35.1397,lng:-79.0061},
  "camp lejeune,nc":{lat:34.6785,lng:-77.3414},"kings bay,ga":{lat:30.7988,lng:-81.5637},
  "mayport,fl":{lat:30.3933,lng:-81.4282},"eglin afb,fl":{lat:30.4832,lng:-86.5253},
  "maxwell afb,al":{lat:32.3826,lng:-86.3577},"redstone arsenal,al":{lat:34.6841,lng:-86.6483},
  "anniston,al":{lat:33.6598,lng:-85.8316},"tuscaloosa,al":{lat:33.2098,lng:-87.5692},
};

function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

export function calcDistanceFromChatt(city, state) {
  if (!city || !state) return null;
  const key = `${city.toLowerCase().trim()},${state.toLowerCase().trim()}`;
  const c = CITY_COORDS[key];
  if (!c) return null;
  return haversine(CHATT.lat, CHATT.lng, c.lat, c.lng);
}
