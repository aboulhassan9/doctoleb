import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@ui/contexts/AuthContext';
import { useToast } from '@ui/contexts/ToastContext';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import { Modal, LoadingSkeleton, StatusBadge } from '@ui/components/ui';
import { intakeService } from '@core/services/intakes';
import { patientService } from '@core/services/patients';
import { catalogService } from '@core/services/catalogs';
import { stagger, fadeUp } from '@core/lib/animations';

const TABS = [
  { id: 'lifestyle', label: 'Lifestyle', icon: 'health_and_safety' },
  { id: 'vaccinations', label: 'Vaccinations', icon: 'vaccines' },
  { id: 'surgeries', label: 'Surgeries', icon: 'surgical' },
  { id: 'diseases', label: 'Diseases', icon: 'coronavirus' },
  { id: 'family', label: 'Family History', icon: 'family_restroom' },
];



export default function SecretaryIntakePage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [patient, setPatient] = useState(null);
  const [intake, setIntake] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lifestyle');
  const [saving, setSaving] = useState(false);

  // Lifestyle form
  const [lifestyleForm, setLifestyleForm] = useState({
    marital_status: '', living_with: '', smoking_status: 'never',
    alcohol_status: 'never', exercise_frequency: 'none',
    allergies_text: '', current_medications_text: '', notes: '',
    occupation_id: null, blood_group_id: null,
  });

  // History items
  const [historyItems, setHistoryItems] = useState({ vaccinations: [], surgeries: [], diseases: [], family_history: [] });
  const [catalogs, setCatalogs] = useState({ vaccines: [], surgery_types: [], diseases: [], blood_groups: [], occupations: [], family_relations: [] });

  // Add history modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addKind, setAddKind] = useState('');
  const [addForm, setAddForm] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [patRes, intakeRes, vaccRes, surgRes, disRes, famRes, vacCat, stCat, disCat, bgCat, occCat, frCat] = await Promise.all([
      patientService.getById(patientId),
      intakeService.getByPatientId(patientId),
      intakeService.getHistory(patientId, 'vaccinations', { pageSize: 200 }),
      intakeService.getHistory(patientId, 'surgeries', { pageSize: 200 }),
      intakeService.getHistory(patientId, 'diseases', { pageSize: 200 }),
      intakeService.getHistory(patientId, 'family_history', { pageSize: 200 }),
      catalogService.getAll('vaccines', { pageSize: 200 }),
      catalogService.getAll('surgery_types', { pageSize: 200 }),
      catalogService.getAll('diseases', { pageSize: 200 }),
      catalogService.getAll('blood_groups', { pageSize: 200 }),
      catalogService.getAll('occupations', { pageSize: 200 }),
      catalogService.getAll('family_relations', { pageSize: 200 }),
    ]);
    if (patRes.error) { showToast(patRes.error, 'error'); navigate(-1); return; }
    setPatient(patRes.data);
    if (intakeRes.data) {
      setIntake(intakeRes.data);
      setLifestyleForm({
        marital_status: intakeRes.data.marital_status || '',
        living_with: intakeRes.data.living_with || '',
        smoking_status: intakeRes.data.smoking_status || 'never',
        alcohol_status: intakeRes.data.alcohol_status || 'never',
        exercise_frequency: intakeRes.data.exercise_frequency || 'none',
        allergies_text: intakeRes.data.allergies_text || '',
        current_medications_text: intakeRes.data.current_medications_text || '',
        notes: intakeRes.data.notes || '',
        occupation_id: intakeRes.data.occupation_id || null,
        blood_group_id: intakeRes.data.blood_group_id || null,
      });
    }
    setHistoryItems({
      vaccinations: vaccRes.data || [], surgeries: surgRes.data || [],
      diseases: disRes.data || [], family_history: famRes.data || [],
    });
    setCatalogs({
      vaccines: vacCat.data || [], surgery_types: stCat.data || [],
      diseases: disCat.data || [], blood_groups: bgCat.data || [],
      occupations: occCat.data || [], family_relations: frCat.data || [],
    });
    setLoading(false);
  }, [patientId, showToast, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveDraft = async () => {
    setSaving(true);
    const result = await intakeService.saveDraft({ patient_id: patientId, ...lifestyleForm });
    if (result.error) showToast(result.error, 'error');
    else { showToast('Draft saved.', 'success'); setIntake(result.data); }
    setSaving(false);
  };

  const handleComplete = async () => {
    setSaving(true);
    // Save draft first
    await intakeService.saveDraft({ patient_id: patientId, ...lifestyleForm });
    const result = await intakeService.markCompleted(patientId, user?.id);
    if (result.error) showToast(result.error, 'error');
    else { showToast('Intake marked complete! Patient is now established.', 'success'); setIntake(result.data); }
    setSaving(false);
  };

  const openAddHistory = (kind) => {
    setAddKind(kind);
    const defaults = {
      vaccinations: { patient_id: patientId, vaccine_id: catalogs.vaccines[0]?.id || '', status: 'received', dose_number: 1 },
      surgeries: { patient_id: patientId, surgery_type_id: catalogs.surgery_types[0]?.id || '', performed_at: '', hospital_name: '' },
      diseases: { patient_id: patientId, disease_id: catalogs.diseases[0]?.id || '', status: 'active', severity: 'mild' },
      family_history: { patient_id: patientId, relation_id: catalogs.family_relations[0]?.id || '', disease_id: catalogs.diseases[0]?.id || '', condition_text: '' },
    };
    setAddForm(defaults[kind] || {});
    setShowAddModal(true);
  };

  const handleAddHistory = async () => {
    setSaving(true);
    const result = await intakeService.addHistory(addKind, addForm);
    if (result.error) showToast(result.error, 'error');
    else { showToast('Entry added.', 'success'); setShowAddModal(false); loadData(); }
    setSaving(false);
  };

  const handleArchive = async (kind, id) => {
    const result = await intakeService.archiveHistory(kind, id, user?.id);
    if (result.error) showToast(result.error, 'error');
    else { showToast('Entry archived.', 'success'); loadData(); }
  };

  const patientName = patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : '...';
  const intakeStatus = intake?.status || 'new';
  const canComplete = intake && intakeStatus !== 'completed';

  if (loading) return <DashboardLayout role="secretary" pageTitle="Medical Intake"><div className="p-6"><LoadingSkeleton rows={8} /></div></DashboardLayout>;

  return (
    <DashboardLayout role="secretary" pageTitle={`Intake — ${patientName}`}>
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 p-6">
        {/* Header */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button onClick={() => navigate(-1)} className="text-sm text-slate-500 hover:text-primary flex items-center gap-1 mb-2">
              <span className="material-symbols-outlined text-sm">arrow_back</span> Back
            </button>
            <h1 className="text-2xl font-bold text-slate-900">Medical Intake</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-slate-500">Patient: <strong>{patientName}</strong></p>
              {intake && <StatusBadge status={intakeStatus} size="sm" />}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveDraft} disabled={saving} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            {canComplete && (
              <button onClick={handleComplete} disabled={saving} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg shadow-emerald-600/20 hover:brightness-110 disabled:opacity-50">
                Mark Complete
              </button>
            )}
          </div>
        </motion.div>

        {/* Tab bar */}
        <motion.div variants={fadeUp} className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </motion.div>

        {/* Lifestyle Tab */}
        {activeTab === 'lifestyle' && (
          <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Lifestyle & General</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
                <select value={lifestyleForm.blood_group_id || ''} onChange={(e) => setLifestyleForm(f => ({...f, blood_group_id: e.target.value || null}))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select…</option>
                  {catalogs.blood_groups.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Occupation</label>
                <select value={lifestyleForm.occupation_id || ''} onChange={(e) => setLifestyleForm(f => ({...f, occupation_id: e.target.value || null}))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select…</option>
                  {catalogs.occupations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Marital Status</label>
                <select value={lifestyleForm.marital_status} onChange={(e) => setLifestyleForm(f => ({...f, marital_status: e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select…</option>
                  {['single','married','divorced','widowed','separated'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Smoking</label>
                <select value={lifestyleForm.smoking_status} onChange={(e) => setLifestyleForm(f => ({...f, smoking_status: e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {['never','former','current','occasional'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alcohol</label>
                <select value={lifestyleForm.alcohol_status} onChange={(e) => setLifestyleForm(f => ({...f, alcohol_status: e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {['never','former','social','regular'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Exercise</label>
                <select value={lifestyleForm.exercise_frequency} onChange={(e) => setLifestyleForm(f => ({...f, exercise_frequency: e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {['none','occasional','moderate','daily'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Allergies</label>
              <textarea value={lifestyleForm.allergies_text} onChange={(e) => setLifestyleForm(f => ({...f, allergies_text: e.target.value}))}
                rows={2} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="List known allergies…" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Medications</label>
              <textarea value={lifestyleForm.current_medications_text} onChange={(e) => setLifestyleForm(f => ({...f, current_medications_text: e.target.value}))}
                rows={2} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="List current medications…" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea value={lifestyleForm.notes} onChange={(e) => setLifestyleForm(f => ({...f, notes: e.target.value}))}
                rows={2} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
          </motion.div>
        )}

        {/* History Tabs */}
        {['vaccinations','surgeries','diseases','family'].includes(activeTab) && (() => {
          const kind = activeTab === 'family' ? 'family_history' : activeTab;
          const items = historyItems[kind] || [];
          return (
            <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">{TABS.find(t=>t.id===activeTab)?.label} ({items.length})</h2>
                <button onClick={() => openAddHistory(kind)} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:brightness-110 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">add</span>Add
                </button>
              </div>
              {items.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No entries yet.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <div key={item.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50/50">
                      <div className="text-sm">
                        <span className="font-medium text-slate-800">{item.vaccine?.name || item.surgery_type?.name || item.disease?.name || item.relation?.name || item.condition_text || '—'}</span>
                        {item.status && <span className="ml-2 text-xs text-slate-400">({item.status})</span>}
                        {item.given_at && <span className="ml-2 text-xs text-slate-400">{item.given_at}</span>}
                        {item.performed_at && <span className="ml-2 text-xs text-slate-400">{item.performed_at}</span>}
                        {item.diagnosed_at && <span className="ml-2 text-xs text-slate-400">{item.diagnosed_at}</span>}
                      </div>
                      <button onClick={() => handleArchive(kind, item.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50">
                        <span className="material-symbols-outlined text-base">archive</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })()}
      </motion.div>

      {/* Add History Modal */}
      {showAddModal && (
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={`Add ${addKind.replace('_',' ')}`}>
          <div className="space-y-4 p-1">
            {addKind === 'vaccinations' && (<>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Vaccine</label>
                <select value={addForm.vaccine_id} onChange={e => setAddForm(f=>({...f,vaccine_id:e.target.value}))} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm">
                  {catalogs.vaccines.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={addForm.status} onChange={e => setAddForm(f=>({...f,status:e.target.value}))} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm">
                  {['received','scheduled','overdue','declined','unknown'].map(s=><option key={s} value={s}>{s}</option>)}
                </select></div>
            </>)}
            {addKind === 'surgeries' && (<>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Surgery Type</label>
                <select value={addForm.surgery_type_id} onChange={e => setAddForm(f=>({...f,surgery_type_id:e.target.value}))} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm">
                  {catalogs.surgery_types.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input type="date" value={addForm.performed_at||''} onChange={e => setAddForm(f=>({...f,performed_at:e.target.value}))} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm"/></div>
            </>)}
            {addKind === 'diseases' && (<>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Disease</label>
                <select value={addForm.disease_id} onChange={e => setAddForm(f=>({...f,disease_id:e.target.value}))} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm">
                  {catalogs.diseases.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={addForm.status} onChange={e => setAddForm(f=>({...f,status:e.target.value}))} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm">
                  {['active','resolved','chronic','in_remission','suspected'].map(s=><option key={s} value={s}>{s}</option>)}
                </select></div>
            </>)}
            {addKind === 'family_history' && (<>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Relation</label>
                <select value={addForm.relation_id} onChange={e => setAddForm(f=>({...f,relation_id:e.target.value}))} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm">
                  {catalogs.family_relations.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Disease (or describe below)</label>
                <select value={addForm.disease_id||''} onChange={e => setAddForm(f=>({...f,disease_id:e.target.value||null}))} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm">
                  <option value="">None (use text)</option>
                  {catalogs.diseases.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Condition Text</label>
                <input type="text" value={addForm.condition_text||''} onChange={e => setAddForm(f=>({...f,condition_text:e.target.value}))} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm" placeholder="Free-text fallback"/></div>
            </>)}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
              <button onClick={handleAddHistory} disabled={saving} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50">
                {saving ? 'Adding…' : 'Add Entry'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
