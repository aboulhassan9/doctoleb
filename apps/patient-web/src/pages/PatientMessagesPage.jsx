import PatientPageHeader from '@ui/components/patient/PatientPageHeader';
import { MessagingPage, MESSAGING_MODES } from '@ui/components/messaging/MessagingPage';

export default function PatientMessagesPage() {
  return (
    <div className="min-h-screen bg-background-light flex flex-col">
      <PatientPageHeader title="Messages" subtitle="Talk to your clinic team" />
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-6 py-6">
        <div className="h-[calc(100vh-160px)] min-h-[480px]">
          <MessagingPage mode={MESSAGING_MODES.patient} className="h-full" />
        </div>
      </main>
    </div>
  );
}
