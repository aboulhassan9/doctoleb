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

// Encounter hooks (clinic-ops — re-exported here for backward compat)
export { useEncounter } from '@clinic-ops/hooks/useEncounter';
export { useDoctorEncounterTimeline } from '@clinic-ops/hooks/useDoctorEncounterTimeline';
export { useEncounterDraft } from '@clinic-ops/hooks/useEncounterDraft';
export { useEncounterNotes } from '@clinic-ops/hooks/useEncounterNotes';
export { useEncounterDiagnoses } from '@clinic-ops/hooks/useEncounterDiagnoses';
export { useEncounterPrescriptions } from '@clinic-ops/hooks/useEncounterPrescriptions';
export { useEncounterOrders } from '@clinic-ops/hooks/useEncounterOrders';
export { useEncounterCareTasks } from '@clinic-ops/hooks/useEncounterCareTasks';
export { useEncounterDocuments } from '@clinic-ops/hooks/useEncounterDocuments';
