// Barrel export for all custom hooks
// Generic hooks
export { useSearch } from './useSearch';
export { usePagination } from './usePagination';
export { useConfirmDialog } from './useConfirmDialog';
export { useDocumentTitle } from './useDocumentTitle';
export { useUrlFilters } from './useUrlFilters';

// Feature hooks (shared core)
export { usePatients } from './features/usePatients';
export { useAppointments } from './features/useAppointments';
export { useNotifications } from './features/useNotifications';
export { useReferrals } from './features/useReferrals';
export { useDoctorProfile } from './features/useDoctorProfile';
export { useBilling } from './features/useBilling';
export { useCertificates } from './features/useCertificates';
export { useEntitlements } from './features/useEntitlements';

// Encounter hooks (moved from clinic-ops to core)
export { useEncounter } from './features/useEncounter';
export { useDoctorEncounterTimeline } from './features/useDoctorEncounterTimeline';
export { useEncounterDraft } from './features/useEncounterDraft';
export { useEncounterNotes } from './features/useEncounterNotes';
export { useEncounterDiagnoses } from './features/useEncounterDiagnoses';
export { useEncounterPrescriptions } from './features/useEncounterPrescriptions';
export { useEncounterOrders } from './features/useEncounterOrders';
export { useEncounterCareTasks } from './features/useEncounterCareTasks';
export { useEncounterDocuments } from './features/useEncounterDocuments';
