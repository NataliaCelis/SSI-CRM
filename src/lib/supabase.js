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
  const VALID = new Set([
    'project_name','project_type','city','state','bid_date','addenda',
    'tonnage','ssi_price','fab_cost','erect_cost','sales_tax',
    'prevailing_wages','distance_miles','follow_up_date','prequal',
    'e_number','zip','deleted_at',
  ]);
  const { companies: _, notes: __, tasks: ___, estimator: ____, ...rest } = updates;
  const dbFields = Object.fromEntries(Object.entries(rest).filter(([k]) => VALID.has(k)));
  console.log('updateProject — id:', id, 'dbFields:', dbFields);
  if (!Object.keys(dbFields).length) { console.warn('updateProject: nothing valid to update'); return; }
  const { error } = await supabase.from('projects').update(dbFields).eq('id', id);
  if (error) { console.error('updateProject error:', error); throw error; }
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
    } else {
      // Update company name in case it changed
      await supabase.from('companies').update({ name: gc.name }).eq('id', companyId);
    }

    const { data: pcRow, error: pcErr } = await supabase
      .from('project_companies').insert({ project_id: projectId, company_id: companyId }).select().single();
    if (pcErr) throw pcErr;

    for (const contact of gc.contacts || []) {
      if (!contact.name?.trim()) continue;
      let contactId = contact.id;
      if (contactId) {
        // Update existing contact with any changed fields
        await supabase.from('contacts').update({
          name: contact.name,
          email: contact.email || null,
          office_phone: contact.officePhone || null,
          extension: contact.ext || null,
          cell_phone: contact.cell || null,
        }).eq('id', contactId);
      } else {
        // Create new contact
        const { data, error } = await supabase.from('contacts').insert({
          company_id: companyId,
          name: contact.name,
          email: contact.email || null,
          office_phone: contact.officePhone || null,
          extension: contact.ext || null,
          cell_phone: contact.cell || null,
        }).select().single();
        if (error) throw error;
        contactId = data.id;
      }
      // Always re-create the project_contacts link
      await supabase.from('project_contacts').insert({
        project_company_id: pcRow.id,
        contact_id: contactId,
      });
    }
  }
}

// ── Awards ────────────────────────────────────────────────
export async function upsertAward(projectId, awardData) {
  console.log('upsertAward — projectId:', projectId, 'data:', awardData);
  const { error } = await supabase.from('project_awards')
    .upsert({ project_id: projectId, ...awardData }, { onConflict: 'project_id' });
  if (error) { console.error('upsertAward error:', error); throw error; }
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

// ── Distance + Geocoding ───────────────────────────────────
const CHATT = { lat: 35.0456, lng: -85.3097 };

// In-memory cache so we don't hammer the API on every render
const geocodeCache = {};

function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// State abbreviation → full name for better Nominatim results
const STATE_NAMES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
  CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',
  KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
  MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',
  MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
  NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',
  OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
  VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
  DC:'District of Columbia',
};

// Geocode city+state using OpenStreetMap Nominatim (free, no API key)
export async function geocodeCityState(city, state) {
  if (!city || !state) return null;
  const key = `${city.toLowerCase().trim()},${state.toLowerCase().trim()}`;
  if (geocodeCache[key]) return geocodeCache[key];

  const stateName = STATE_NAMES[state.toUpperCase()] || state;
  const query = encodeURIComponent(`${city}, ${stateName}, United States`);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=us`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'SSI-CRM/1.0' } }
    );
    const data = await res.json();
    if (!data?.length) return null;
    const { lat, lon, address } = data[0];
    const result = {
      lat: parseFloat(lat),
      lng: parseFloat(lon),
      zip: address?.postcode || null,
      distanceMiles: haversine(CHATT.lat, CHATT.lng, parseFloat(lat), parseFloat(lon)),
    };
    geocodeCache[key] = result;
    return result;
  } catch {
    return null;
  }
}

// Sync fallback using cached results (for normalize on load)
export function calcDistanceFromChatt(city, state) {
  if (!city || !state) return null;
  const key = `${city.toLowerCase().trim()},${state.toLowerCase().trim()}`;
  return geocodeCache[key]?.distanceMiles || null;
}
