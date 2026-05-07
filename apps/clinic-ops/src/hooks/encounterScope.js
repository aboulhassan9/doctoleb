export function normalizeEncounterScope(scope) {
  if (typeof scope === 'string') {
    return { encounterId: null, patientId: scope };
  }

  return {
    encounterId: scope?.encounterId ?? null,
    patientId: scope?.patientId ?? null,
  };
}
