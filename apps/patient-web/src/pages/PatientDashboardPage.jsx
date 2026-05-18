import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  FileClock,
  HeartPulse,
  MessageCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserDisplayName } from '@/lib/userDisplay';
import { formatClinicDate, formatClinicTime } from '@/lib/time';
import { usePatientPortal } from '@core/hooks/features/usePatientPortal';
import { PatientPortalShell } from '@ui/components/patient/PatientPortalShell';
import { PatientReadinessCard } from '@ui/components/patient/PatientReadinessCard';
import { patientFadeRise, patientStagger } from '@ui/styles/patientMotion';

function formatMoney(amount = 0, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function AppointmentCard({ appointment, onBook }) {
  if (!appointment) {
    return (
      <motion.section variants={patientFadeRise} className="patient-paper-strong patient-surface p-6">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-clay)]">Next appointment</p>
        <h2 className="patient-display mt-3 text-3xl font-medium tracking-tight text-[var(--patient-ink)]">
          No visit is booked yet.
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--patient-muted)]">
          Finish readiness first, then choose the doctor, visit type, and available time.
        </p>
        <button
          type="button"
          onClick={onBook}
          className="patient-button-primary mt-6 px-5 py-3 patient-focus"
        >
          Start booking
          <ArrowRight className="h-4 w-4" />
        </button>
      </motion.section>
    );
  }

  return (
    <motion.section variants={patientFadeRise} className="patient-paper-strong patient-surface p-6">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-sage)]">Next appointment</p>
          <h2 className="patient-display mt-3 text-3xl font-medium tracking-tight text-[var(--patient-ink)]">
            {appointment.reason || 'Clinic visit'}
          </h2>
        </div>
        <span className="patient-status-sage uppercase tracking-wide">
          {appointment.status || 'scheduled'}
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="patient-inset p-4">
          <CalendarDays className="h-4 w-4 text-[var(--patient-sage)]" />
          <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--patient-muted)_70%,transparent)]">Date</p>
          <p className="mt-1 text-sm font-black text-[var(--patient-ink)]">
            {formatClinicDate(appointment.scheduled_at, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="patient-inset p-4">
          <Clock3 className="h-4 w-4 text-[var(--patient-sage)]" />
          <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--patient-muted)_70%,transparent)]">Time</p>
          <p className="mt-1 text-sm font-black text-[var(--patient-ink)]">{formatClinicTime(appointment.scheduled_at)}</p>
        </div>
      </div>
    </motion.section>
  );
}

function ActionRow({ icon: Icon, label, value, action, onClick, tone = 'sage' }) {
  const toneClass = tone === 'clay'
    ? 'patient-icon-clay'
    : 'patient-icon-sage';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      variants={patientFadeRise}
      whileHover={{ x: 4 }}
      className="patient-focus group flex w-full items-center gap-4 border-b border-[color-mix(in_srgb,var(--patient-outline)_55%,transparent)] px-1 py-4 text-left last:border-b-0"
    >
      <span className={`h-11 w-11 shrink-0 ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-[var(--patient-ink)]">{label}</span>
        <span className="mt-0.5 block text-sm font-semibold text-[var(--patient-muted)]">{value}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--patient-sage)]">
        {action}
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </motion.button>
  );
}

function NotificationPreview({ notifications, onOpen }) {
  return (
    <motion.section variants={patientFadeRise} className="patient-paper patient-surface p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-sage)]">Clinic messages</p>
          <h2 className="patient-display mt-2 text-2xl font-medium tracking-tight text-[var(--patient-ink)]">
            {notifications.length ? `${notifications.length} unread` : 'Nothing unread'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="patient-button-secondary px-4 py-2"
        >
          Open
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {notifications.length ? (
          notifications.map((notification) => (
            <div key={notification.id} className="patient-inset p-3">
              <p className="truncate text-sm font-black text-[var(--patient-ink)]">
                {notification.title || notification.subject || 'Clinic notification'}
              </p>
              {notification.message && (
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[var(--patient-muted)]">
                  {notification.message}
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="patient-inset p-4 text-sm font-semibold leading-6 text-[var(--patient-muted)]">
            When the clinic sends a message or update, it will appear here without exposing it on public surfaces.
          </p>
        )}
      </div>
    </motion.section>
  );
}

function BillingPreview({ billing, onOpen }) {
  const balanceDue = billing?.summary?.pendingTotal || 0;
  const currency = billing?.currency || 'USD';
  const hasBalanceDue = Boolean(billing?.summary?.hasBalanceDue);

  return (
    <motion.section variants={patientFadeRise} className="patient-paper patient-surface p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-clay)]">Billing</p>
          <h2 className="patient-display mt-2 text-2xl font-medium tracking-tight text-[var(--patient-ink)]">
            {hasBalanceDue ? formatMoney(balanceDue, currency) : 'No balance due'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="patient-button-secondary px-4 py-2"
        >
          Open
        </button>
      </div>
      <p className="patient-inset mt-5 p-4 text-sm font-semibold leading-6 text-[var(--patient-muted)]">
        Payments open through hosted checkout. The browser never handles card numbers or payment secrets.
      </p>
    </motion.section>
  );
}

export default function PatientDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { overview, loading, error } = usePatientPortal(user);
  const status = overview?.readiness?.status || null;
  const upcomingAppointments = overview?.upcomingAppointments || [];
  const nextAppointment = overview?.nextAppointment || null;
  const notifications = overview?.notifications || [];
  const billing = overview?.billing || null;
  const pageLoading = loading;
  const firstName = getUserDisplayName(user, 'patient').split(' ')[0];
  const recommendedAction = !status?.isComplete
    ? 'Complete intake'
    : billing?.summary?.hasBalanceDue
      ? 'Pay balance'
    : nextAppointment
      ? 'Review appointment'
      : 'Book appointment';

  return (
    <PatientPortalShell title="Patient Portal" subtitle={`Welcome, ${firstName}`} showBackToDashboard={false}>
        <motion.section
          variants={patientStagger}
          initial="hidden"
          animate="visible"
          className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]"
        >
          <motion.div variants={patientFadeRise} className="patient-hero-band p-8">
            <div aria-hidden="true" className="absolute -right-20 top-10 h-64 w-64 rounded-full bg-[color-mix(in_srgb,var(--patient-success)_20%,transparent)] blur-3xl" />
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--patient-warning)]">Care overview</p>
            <h1 className="patient-display relative mt-4 max-w-3xl text-5xl font-medium leading-[0.95] tracking-tight sm:text-6xl">
              Welcome, {firstName}. Your next care step is visible.
            </h1>
            <p className="relative mt-5 max-w-2xl text-base leading-7 text-white/75">
              We keep the patient portal quiet: readiness, visits, records, and clinic messages stay in one readable sequence.
            </p>
            <div className="relative mt-8 inline-flex rounded-full bg-white/10 p-1">
              <span className="patient-status-clay uppercase tracking-[0.16em]">
                {recommendedAction}
              </span>
            </div>
          </motion.div>

          <AppointmentCard appointment={nextAppointment} onBook={() => navigate('/patient-appointments')} />
        </motion.section>

        <div className="mt-8">
          {error ? (
            <div role="alert" className="mb-5 rounded-[18px_4px_18px_4px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}
          <PatientReadinessCard
            status={status}
            loading={pageLoading}
            onContinue={() => navigate('/patient-onboarding')}
            onBook={() => navigate('/patient-appointments')}
          />
        </div>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <motion.div
            variants={patientStagger}
            initial="hidden"
            animate="visible"
            className="patient-paper patient-surface p-6"
          >
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-sage)]">Care sequence</p>
                <h2 className="patient-display mt-2 text-3xl font-medium tracking-tight text-[var(--patient-ink)]">
                  What needs your attention
                </h2>
              </div>
              <CheckCircle2 className="h-6 w-6 text-[var(--patient-sage)]" />
            </div>

            <ActionRow
              icon={ClipboardCheck}
              label="First-visit profile"
              value={status?.isComplete ? 'Ready for doctors and predoctors' : 'Required before online booking'}
              action={status?.isComplete ? 'Review' : 'Finish'}
              tone={status?.isComplete ? 'sage' : 'clay'}
              onClick={() => navigate(status?.isComplete ? '/patient-profile' : '/patient-onboarding')}
            />
            <ActionRow
              icon={CalendarDays}
              label="Appointments"
              value={upcomingAppointments.length ? `${upcomingAppointments.length} upcoming visit(s)` : 'No upcoming visit'}
              action="Manage"
              onClick={() => navigate('/patient-appointments')}
            />
            <ActionRow
              icon={HeartPulse}
              label="Check-in"
              value={nextAppointment ? 'Prepare vitals and symptoms for the next visit' : 'Available after booking'}
              action="Open"
              tone={nextAppointment ? 'sage' : 'clay'}
              onClick={() => navigate('/patient-check-in')}
            />
            <ActionRow
              icon={FileClock}
              label="Records and history"
              value="Open documents, visits, and clinical history"
              action="Open"
              onClick={() => navigate('/patient-history')}
            />
            <ActionRow
              icon={MessageCircle}
              label="Messages"
              value={notifications.length ? `${notifications.length} unread clinic update(s)` : 'No unread updates'}
              action="Read"
              onClick={() => navigate('/patient-messages')}
            />
            <ActionRow
              icon={CreditCard}
              label="Billing"
              value={billing?.summary?.hasBalanceDue ? `${formatMoney(billing.summary.pendingTotal, billing.currency)} due` : 'No balance due'}
              action="Open"
              tone={billing?.summary?.hasBalanceDue ? 'clay' : 'sage'}
              onClick={() => navigate('/patient-billing')}
            />
          </motion.div>

          <div className="grid gap-8">
            <NotificationPreview notifications={notifications} onOpen={() => navigate('/patient-messages')} />
            <BillingPreview billing={billing} onOpen={() => navigate('/patient-billing')} />
            <motion.section variants={patientFadeRise} className="patient-paper patient-surface p-6">
              <Bell className="h-5 w-5 text-[var(--patient-clay)]" />
              <h2 className="patient-display mt-4 text-2xl font-medium tracking-tight text-[var(--patient-ink)]">
                Your information stays clinical, not decorative.
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-[var(--patient-muted)]">
                The portal only surfaces patient-owned state from service contracts. PHI is not logged, mocked, or used as branding.
              </p>
            </motion.section>
          </div>
        </section>
    </PatientPortalShell>
  );
}
