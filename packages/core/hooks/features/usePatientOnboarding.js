import { useEffect, useState } from 'react';
import { patientOnboardingService } from '../../services/patientOnboarding.js';
import {
  DEFAULT_PATIENT_ONBOARDING_DEFINITION,
  buildPatientGuidedIntakePayload,
} from '../../lib/patientOnboarding.js';
import { logError } from '../../lib/logger.js';

export function usePatientOnboarding(user) {
  const [patient, setPatient] = useState(null);
  const [intake, setIntake] = useState(null);
  const [status, setStatus] = useState(null);
  const [definition, setDefinition] = useState(DEFAULT_PATIENT_ONBOARDING_DEFINITION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const applyReadinessResult = (result) => {
    if (result.error) {
      setError(result.error);
      setPatient(null);
      setIntake(null);
      setStatus(null);
      setDefinition(DEFAULT_PATIENT_ONBOARDING_DEFINITION);
    } else {
      setPatient(result.data.patient);
      setIntake(result.data.intake);
      setStatus(result.data.status);
      setDefinition(result.data.definition || DEFAULT_PATIENT_ONBOARDING_DEFINITION);
    }
  };

  const refresh = async () => {
    if (!user?.id) {
      setPatient(null);
      setIntake(null);
      setStatus(null);
      setDefinition(DEFAULT_PATIENT_ONBOARDING_DEFINITION);
      setLoading(false);
      return { data: null, error: 'No user session.' };
    }

    setLoading(true);
    setError(null);
    const result = await patientOnboardingService.getReadiness({
      userId: user.id,
      patientId: user.patient_id || null,
    });

    applyReadinessResult(result);

    setLoading(false);
    return result;
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user?.id) {
        setPatient(null);
        setIntake(null);
        setStatus(null);
        setDefinition(DEFAULT_PATIENT_ONBOARDING_DEFINITION);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      const result = await patientOnboardingService.getReadiness({
        userId: user.id,
        patientId: user.patient_id || null,
      });
      if (cancelled) return;
      applyReadinessResult(result);
      setLoading(false);
      if (result.error) {
        logError('usePatientOnboarding.refresh', result.error);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.patient_id]);

  const saveGuidedIntake = async (form) => {
    if (!user?.id || !patient?.id) {
      return { data: null, error: 'Patient profile is not loaded yet.' };
    }

    setSaving(true);
    setError(null);
    const payload = buildPatientGuidedIntakePayload({
      form,
      userId: user.id,
      patientId: patient.id,
      definition,
    });

    const result = await patientOnboardingService.saveGuidedIntake(payload);
    if (result.data) {
      setPatient(result.data.patient);
      setIntake(result.data.intake);
      setStatus(result.data.status);
      setDefinition(result.data.definition || definition);
    }

    if (result.error) {
      setError(result.error);
    }

    setSaving(false);
    return result;
  };

  return {
    patient,
    intake,
    status,
    definition,
    loading,
    saving,
    error,
    refresh,
    saveGuidedIntake,
  };
}
