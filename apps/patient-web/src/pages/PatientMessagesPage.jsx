import { PatientPortalShell } from '@ui/components/patient/PatientPortalShell';
import { MessagingPage, MESSAGING_MODES } from '@ui/components/messaging/MessagingPage';
import { MessageCircle, ShieldCheck } from 'lucide-react';

export default function PatientMessagesPage() {
  return (
    <PatientPortalShell
      title="Messages"
      subtitle="Clinic conversations and care updates"
      mainClassName="grid flex-1 gap-6 lg:grid-cols-[0.78fr_1.22fr]"
    >
        <aside className="space-y-5 lg:sticky lg:top-40 lg:self-start">
          <section className="patient-paper-strong patient-surface p-6">
            <MessageCircle className="h-6 w-6 text-[var(--patient-sage)]" />
            <h1 className="patient-display mt-4 text-4xl font-medium tracking-tight text-[var(--patient-ink)]">
              Ask without losing the visit context.
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-[var(--patient-muted)]">
              Messages stay inside the patient portal, tied to clinic identity and role-based access. Use this for follow-ups, document questions, and appointment coordination.
            </p>
          </section>
          <section className="patient-paper patient-surface p-6">
            <ShieldCheck className="h-5 w-5 text-[var(--patient-clay)]" />
            <h2 className="patient-display mt-4 text-2xl font-medium tracking-tight text-[var(--patient-ink)]">
              No public support inbox.
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[var(--patient-muted)]">
              Conversations are rendered by the shared messaging contract; this page only provides patient-safe framing and navigation.
            </p>
          </section>
        </aside>

        <div className="patient-paper-strong patient-surface min-h-[620px] p-3 sm:p-4">
          <div className="h-[calc(100vh-210px)] min-h-[560px]">
            <MessagingPage mode={MESSAGING_MODES.patient} className="h-full" />
          </div>
        </div>
    </PatientPortalShell>
  );
}
