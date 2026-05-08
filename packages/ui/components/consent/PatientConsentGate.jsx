/**
 * PatientConsentGate — Blocks the patient app until all required consents
 * have been accepted (and not revoked).
 *
 * Behavior:
 *   - No user (logged out): renders children unchanged.
 *   - Non-patient (staff/admin): renders children unchanged.
 *   - Patient with `patient_id` null: renders children unchanged (edge case;
 *     account sync should resolve it on next session).
 *   - Patient with all required active consents accepted: renders children.
 *   - Patient missing required consents: renders a sequential modal that
 *     forces acceptance before continuing.
 *
 * "Required" = `consent_documents.is_active = true`
 *            AND `is_required = true`
 *            AND `audience = 'patient'`.
 *
 * "Accepted" = `patient_consents.consent_document_id = doc.id`
 *            AND `revoked_at IS NULL`.
 *
 * Backend contracts:
 *   - tenantConfigService.getConsentDocuments({ activeOnly, audience })
 *   - tenantConfigService.getPatientConsents(patientId)
 *   - tenantConfigService.acceptConsent({ patient_id, consent_document_id,
 *       accepted_by_user_id, acceptance_method: 'patient_self' })
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { tenantConfigService } from '@/services/tenantConfig';
import { logError } from '@/lib/logger';
import { Modal } from '@ui/components/ui';

export function PatientConsentGate({ children }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const userId = user?.id ?? null;
  const patientId = user?.patient_id ?? null;
  const isPatient = user?.role === 'patient';
  const shouldGate = isPatient && Boolean(patientId);

  const [requiredDocuments, setRequiredDocuments] = useState([]);
  const [acceptedDocumentIds, setAcceptedDocumentIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // ── Load required + accepted in parallel when user becomes a gated patient.

  useEffect(() => {
    if (!shouldGate) {
      setRequiredDocuments([]);
      setAcceptedDocumentIds(new Set());
      setLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const [docsResult, consentsResult] = await Promise.all([
          tenantConfigService.getConsentDocuments({
            activeOnly: true,
            audience: 'patient',
            pageSize: 100,
          }),
          tenantConfigService.getPatientConsents(patientId, { pageSize: 200 }),
        ]);

        if (cancelled) return;

        if (docsResult.error) {
          showToast(docsResult.error, 'error');
          setRequiredDocuments([]);
          setAcceptedDocumentIds(new Set());
          setLoadError(docsResult.error);
          return;
        }
        if (consentsResult.error) {
          showToast(consentsResult.error, 'error');
          setRequiredDocuments([]);
          setAcceptedDocumentIds(new Set());
          setLoadError(consentsResult.error);
          return;
        }

        const requiredDocs = (docsResult.data || []).filter((d) => d.is_required);
        const acceptedIds = new Set(
          (consentsResult.data || [])
            .filter((c) => !c.revoked_at && c.consent_document_id)
            .map((c) => c.consent_document_id)
        );

        setRequiredDocuments(requiredDocs);
        setAcceptedDocumentIds(acceptedIds);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        logError('PatientConsentGate:load', err);
        setRequiredDocuments([]);
        setAcceptedDocumentIds(new Set());
        setLoadError('Failed to check consents. Please try again.');
        showToast('Failed to check consents. Please try again.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldGate, patientId, showToast, reloadNonce]);

  // ── Pending = required AND not yet accepted.

  const pendingDocuments = useMemo(() => {
    if (!shouldGate) return [];
    return requiredDocuments.filter((d) => !acceptedDocumentIds.has(d.id));
  }, [shouldGate, requiredDocuments, acceptedDocumentIds]);

  const handleAccept = useCallback(async (doc) => {
    if (!doc || submitting || !patientId || !userId) return;

    setSubmitting(true);
    try {
      const { error } = await tenantConfigService.acceptConsent({
        patient_id: patientId,
        consent_document_id: doc.id,
        accepted_by_user_id: userId,
        acceptance_method: 'patient_self',
      });

      if (error) {
        showToast(error, 'error');
        return;
      }

      setAcceptedDocumentIds((prev) => {
        const next = new Set(prev);
        next.add(doc.id);
        return next;
      });
    } catch (err) {
      logError('PatientConsentGate:accept', err);
      showToast('Could not record acceptance. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, patientId, userId, showToast]);

  const handleRetry = useCallback(() => {
    setReloadNonce((current) => current + 1);
  }, []);

  if (!shouldGate) return <>{children}</>;

  if (loadError) {
    return <ConsentErrorOverlay error={loadError} onRetry={handleRetry} />;
  }

  if (loading && requiredDocuments.length === 0) {
    return <ConsentLoadingOverlay />;
  }

  if (pendingDocuments.length === 0) return <>{children}</>;

  const currentDoc = pendingDocuments[0];
  const total = requiredDocuments.length;
  const acceptedSoFar = total - pendingDocuments.length;

  return (
    <>
      {children}
      <ConsentModal
        doc={currentDoc}
        position={acceptedSoFar + 1}
        total={total}
        submitting={submitting}
        onAccept={() => void handleAccept(currentDoc)}
      />
    </>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────

function ConsentLoadingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px 32px',
          fontSize: '14px',
          color: '#475569',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        Checking your consents…
      </div>
    </div>
  );
}

function ConsentErrorOverlay({ error, onRetry }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(2px)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'white',
          borderRadius: '14px',
          padding: '28px',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.22)',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Consent check required
        </p>
        <h2 style={{ margin: '0 0 10px', color: '#0f172a', fontSize: '20px', fontWeight: 700 }}>
          We could not verify your required consents
        </h2>
        <p style={{ margin: '0 0 20px', color: '#475569', fontSize: '14px', lineHeight: 1.5 }}>
          {error || 'Please retry before continuing.'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            width: '100%',
            border: 0,
            borderRadius: '10px',
            padding: '11px 16px',
            background: '#0891b2',
            color: 'white',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Retry consent check
        </button>
      </div>
    </div>
  );
}

function ConsentModal({ doc, position, total, submitting, onAccept }) {
  // Modal stays open while gating; onClose is a no-op because escape-to-close
  // would let a patient skip a required consent.
  return (
    <Modal isOpen onClose={() => {}} size="lg">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        Required consent · {position} of {total}
      </p>
      <h2 className="font-bold text-xl text-slate-900">{doc.title}</h2>
      <p className="text-xs text-slate-500 mt-1 mb-4">Version {doc.version || '1'}</p>

      <div className="max-h-[55vh] overflow-y-auto -mx-6 px-6 border-y border-slate-200 py-4">
        {doc.body_md ? (
          <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
            {doc.body_md}
          </pre>
        ) : (
          <p className="text-sm text-slate-500 italic">
            No content provided. Please contact the clinic for details.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          By clicking accept, you confirm you have read and agreed to the above.
        </p>
        <button
          onClick={onAccept}
          disabled={submitting}
          className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
        >
          {submitting ? 'Recording…' : 'I accept'}
        </button>
      </div>
    </Modal>
  );
}
