const DOCUMENT_TYPE_LABELS = {
  report: 'Medical report',
  certificate: 'Medical certificate',
  referral: 'Referral',
  lab_request: 'Lab request',
  insurance_form: 'Insurance form',
  prescription: 'Prescription',
  lab_result: 'Lab result',
  imaging_result: 'Imaging result',
  insurance_claim: 'Insurance claim',
  other: 'Clinical document',
};

function toDateKey(value) {
  if (!value) return 'undated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'undated';
  return date.toISOString().slice(0, 10);
}

export function normalizePatientTimelineDocuments(documents = []) {
  return documents
    .filter((document) => document && document.status !== 'draft' && document.status !== 'voided')
    .map((document) => ({
      id: document.id,
      kind: 'document',
      title: document.title || DOCUMENT_TYPE_LABELS[document.document_type] || 'Clinical document',
      label: DOCUMENT_TYPE_LABELS[document.document_type] || 'Clinical document',
      status: document.status || 'final',
      occurredAt: document.finalized_at || document.created_at || document.updated_at || null,
      dateKey: toDateKey(document.finalized_at || document.created_at || document.updated_at),
      doctor: document.doctors?.users
        ? [document.doctors.users.first_name, document.doctors.users.last_name].filter(Boolean).join(' ')
        : null,
      source: document,
    }))
    .sort((a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime());
}

export function groupPatientTimelineItems(items = []) {
  const groups = new Map();
  for (const item of items) {
    const key = item.dateKey || 'undated';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        date: key === 'undated' ? null : key,
        items: [],
      });
    }
    groups.get(key).items.push(item);
  }
  return Array.from(groups.values());
}
