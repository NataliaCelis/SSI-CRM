import { useState, useEffect, useCallback } from 'react';
import {
  fetchProjects, fetchAllStaff, fetchAllCompanies,
  updateProject, updateProjectStage, createProject, softDeleteProject,
  upsertAward, upsertProjectCompanies, addNote, softDeleteNote,
  addTask, updateTask, softDeleteTask, getNextENumber, fetchAppSettings, updateAppSetting,
} from '../lib/supabase';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setProjects(normalizeProjects(await fetchProjects())); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const actions = {
    create: async (d) => { await createProject(d); await load(); },
    update: async (id, upd) => { await updateProject(id, upd); await load(); },
    updateStage: async (id, stage) => { await updateProjectStage(id, stage); setProjects(ps => ps.map(p => p.id === id ? { ...p, stage } : p)); },
    delete: async (id, deletedById) => { await softDeleteProject(id, deletedById); setProjects(ps => ps.filter(p => p.id !== id)); },
    upsertAward: async (projectId, awardData) => { await upsertAward(projectId, awardData); await load(); },
    upsertCompanies: async (projectId, companies) => { await upsertProjectCompanies(projectId, companies); await load(); },
    addNote: async (projectId, staffId, roleLabel, text) => { const n = await addNote(projectId, staffId, roleLabel, text); await load(); return n; },
    deleteNote: async (projectId, noteId, deletedById) => { await softDeleteNote(noteId, deletedById); await load(); },
    addTask: async (projectId, task) => { const t = await addTask(projectId, task); await load(); return t; },
    updateTask: async (projectId, taskId, upd) => { await updateTask(taskId, upd); await load(); },
    deleteTask: async (projectId, taskId, deletedById) => { await softDeleteTask(taskId, deletedById); await load(); },
    reload: load,
  };
  return { projects, loading, error, actions };
}

export function useStaff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setStaff(await fetchAllStaff()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { staff, loading, reload: load };
}

export function useCompanies() {
  const [companies, setCompanies] = useState([]);
  const reload = useCallback(() => { fetchAllCompanies().then(setCompanies).catch(console.error); }, []);
  useEffect(() => { reload(); }, [reload]);
  return { companies, reload };
}

export function useNextENumber() {
  const [eNumber, setENumber] = useState('');
  useEffect(() => { getNextENumber().then(setENumber).catch(console.error); }, []);
  return eNumber;
}

export function useAppSettings() {
  const [settings, setSettings] = useState({});
  const reload = useCallback(() => { fetchAppSettings().then(setSettings).catch(console.error); }, []);
  useEffect(() => { reload(); }, [reload]);
  const save = async (key, value) => { await updateAppSetting(key, value); reload(); };
  return { settings, save, reload };
}

function normalizeProjects(raw) {
  return raw.map(p => {
    const awardObj = Array.isArray(p.project_awards) ? p.project_awards[0] : p.project_awards;
    const companies = (p.project_companies || []).map(pc => ({
      id: pc.company?.id, name: pc.company?.name || '', pcId: pc.id,
      contacts: (pc.project_contacts || []).map(pct => ({
        id: pct.contact?.id, name: pct.contact?.name || '', email: pct.contact?.email || '',
        officePhone: pct.contact?.office_phone || '', ext: pct.contact?.extension || '', cell: pct.contact?.cell_phone || '',
      })),
    }));
    const notes = (p.project_notes || []).filter(n => !n.deleted_at).map(n => ({
      id: n.id, author: n.staff?.name || 'Unknown', staffId: n.staff_id,
      role: n.role_label, text: n.note_text, ts: n.created_at,
    })).sort((a, b) => new Date(a.ts) - new Date(b.ts));
    const tasks = (p.tasks || []).filter(t => !t.deleted_at).map(t => ({
      id: t.id, title: t.title, description: t.description,
      assignee: t.assignee?.name || '', assigneeEmail: t.assignee?.email || '',
      assigneeId: t.assignee_id, assignedBy: t.assigned_by?.name || '',
      dueDate: t.due_date, status: t.status,
    }));
    return {
      id: p.id, eName: p.e_number || '', name: p.project_name || '',
      type: p.project_type || '', estimator: p.estimator?.name?.toUpperCase() || '',
      estimatorId: p.estimator_id, city: p.city || '', state: p.state || '',
      bidDate: p.bid_date || '', addenda: p.addenda || 0, tonnage: p.tonnage || 0,
      ssiPrice: p.ssi_price || 0, stage: p.stage,
      distance: p.distance_miles ? `${p.distance_miles} Miles` : '',
      salesTax: p.sales_tax || '', prevWages: p.prevailing_wages || '',
      fabCost: p.fab_cost || 0, erectCost: p.erect_cost || 0,
      followUpDate: p.follow_up_date || '', prequal: p.prequal || '',
      awardedGC: awardObj?.awarded_gc?.name || '', awardedGCId: awardObj?.awarded_gc_id || '',
      awardedGCContact: awardObj?.awarded_gc_contact_name || '',
      awardedGCPhone: awardObj?.awarded_gc_phone || '', awardedGCEmail: awardObj?.awarded_gc_email || '',
      awardedSub: awardObj?.steel_sub || '', awardedPrice: awardObj?.awarded_price || 0,
      awardNotes: awardObj?.award_notes || '', ourTonnage: awardObj?.our_tonnage || 0,
      winnerTonnage: awardObj?.winning_sub_tonnage || 0, winnerPrice: awardObj?.winning_sub_price || 0,
      companies, notes, tasks,
    };
  });
}
