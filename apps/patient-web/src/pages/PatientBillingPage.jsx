import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Receipt,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';
import { patientBillingService } from '@core/services/patientBilling';
import { formatClinicDate } from '@core/lib/time';
import { useToast } from '@ui/contexts/ToastContext';
import { PatientPortalShell } from '@ui/components/patient/PatientPortalShell';
import { patientFadeRise, patientStagger } from '@ui/styles/patientMotion';

const STATUS_META = {
  pending: {
    label: 'Balance due',
    icon: Clock3,
    className: 'patient-status-clay uppercase tracking-wide',
  },
  completed: {
    label: 'Paid',
    icon: CheckCircle2,
    className: 'patient-status-sage uppercase tracking-wide',
  },
  failed: {
    label: 'Failed',
    icon: AlertCircle,
    className: 'bg-red-50 text-red-700',
  },
  refunded: {
    label: 'Refunded',
    icon: RefreshCcw,
    className: 'patient-status-muted uppercase tracking-wide',
  },
};

function formatMoney(amount = 0, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function PaymentStatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;

  return (
    <span className={meta.className}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function ReturnNotice({ state }) {
  if (!state) return null;

  const success = state === 'success';
  return (
    <motion.div
      variants={patientFadeRise}
      role="status"
      className={`p-4 ${success ? 'patient-inset-success' : 'patient-inset-warning'}`}
    >
      <p className="text-sm font-black">
        {success ? 'Checkout submitted.' : 'Checkout was cancelled.'}
      </p>
      <p className="mt-1 text-sm font-semibold leading-6">
        {success
          ? 'The payment status may take a moment to update after the gateway confirms it.'
          : 'No card data was stored. You can restart payment when you are ready.'}
      </p>
    </motion.div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone = 'sage' }) {
  const toneClass = tone === 'clay'
    ? 'patient-icon-clay'
    : 'patient-icon-sage';

  return (
    <motion.section variants={patientFadeRise} className="patient-paper patient-surface p-5">
      <span className={`h-11 w-11 ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--patient-muted)_70%,transparent)]">{label}</p>
      <p className="mt-2 font-mono text-3xl font-black tabular-nums text-[var(--patient-ink)]">{value}</p>
    </motion.section>
  );
}

function PaymentRow({ payment, startingId, receiptId, receipt, onPay, onReceipt }) {
  const isStarting = startingId === payment.id;
  const canPay = Boolean(payment.canPay) && !isStarting;
  const appointmentLabel = payment.appointment?.scheduledAt
    ? formatClinicDate(payment.appointment.scheduledAt, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Clinic balance';

  return (
    <article className="patient-inset p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PaymentStatusPill status={payment.status} />
            <span className="rounded-full bg-[var(--patient-wash)] px-3 py-1 text-xs font-black text-[var(--patient-muted)]">
              {payment.currency || 'USD'}
            </span>
          </div>
          <h3 className="patient-display mt-3 text-2xl font-medium tracking-tight text-[var(--patient-ink)]">
            {formatMoney(payment.amount, payment.currency)}
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--patient-muted)]">
            {payment.appointment?.visitType || appointmentLabel}
            {payment.doctor?.name ? ` with ${payment.doctor.name}` : ''}
          </p>
          {payment.transactionId ? (
            <p className="mt-2 font-mono text-xs font-bold text-[color-mix(in_srgb,var(--patient-muted)_70%,transparent)]">
              Transaction {payment.transactionId}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <button
            type="button"
            disabled={!canPay}
            onClick={() => onPay(payment.id)}
            className="patient-button-primary px-5 py-3 disabled:cursor-not-allowed disabled:bg-[var(--patient-outline)]"
          >
            {isStarting ? 'Opening checkout...' : 'Pay securely'}
            <ArrowUpRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onReceipt(payment.id)}
            className="patient-button-secondary px-5 py-3"
          >
            Receipt
            <FileText className="h-4 w-4" />
          </button>
        </div>
      </div>

      {receiptId === payment.id && receipt ? (
        <div className="patient-inset-success mt-4 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-sage)]">Receipt state</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--patient-muted)]">
            Status: <span className="font-black text-[var(--patient-ink)]">{receipt.status}</span>
            {receipt.updatedAt ? ` · Updated ${formatClinicDate(receipt.updatedAt, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
          </p>
        </div>
      ) : null}
    </article>
  );
}

export default function PatientBillingPage() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startingId, setStartingId] = useState(null);
  const [receiptId, setReceiptId] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const returnState = searchParams.get('payment');

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    const result = await patientBillingService.getOverview();
    setOverview(result.data || null);
    setError(result.error || null);
    setLoading(false);
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const payments = overview?.payments || [];
  const payablePayments = useMemo(() => payments.filter((payment) => payment.canPay), [payments]);
  const currency = overview?.currency || payments[0]?.currency || 'USD';

  const handleStartCheckout = async (paymentId) => {
    setStartingId(paymentId);
    const result = await patientBillingService.startCheckout(paymentId);
    setStartingId(null);

    if (result.error || !result.data?.checkoutUrl) {
      showToast(result.error || 'Payment checkout could not be started.', 'error');
      return;
    }

    window.location.assign(result.data.checkoutUrl);
  };

  const handleReceipt = async (paymentId) => {
    setReceiptId(paymentId);
    setReceipt(null);
    const result = await patientBillingService.getReceipt(paymentId);
    if (result.error) {
      showToast(result.error, 'error');
      setReceiptId(null);
      return;
    }
    setReceipt(result.data);
  };

  return (
    <PatientPortalShell title="Billing" subtitle="Balances, hosted checkout, and receipts">
        <motion.section
          variants={patientStagger}
          initial="hidden"
          animate="visible"
          className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <motion.div variants={patientFadeRise} className="patient-hero-band p-8">
            <div aria-hidden="true" className="absolute -right-16 top-8 h-64 w-64 rounded-full bg-[color-mix(in_srgb,var(--patient-success)_20%,transparent)] blur-3xl" />
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--patient-warning)]">Payment center</p>
            <h1 className="patient-display relative mt-4 max-w-3xl text-5xl font-medium leading-[0.96] tracking-tight sm:text-6xl">
              Pay clinic balances without exposing card data here.
            </h1>
            <p className="relative mt-5 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              DoctoLeb opens a hosted checkout session for eligible balances. The patient portal stores receipts and gateway references, never raw card numbers.
            </p>
          </motion.div>

          <div className="grid gap-4">
            <ReturnNotice state={returnState} />
            <motion.section variants={patientFadeRise} className="patient-paper-strong patient-surface p-6">
              <ShieldCheck className="h-6 w-6 text-[var(--patient-sage)]" />
              <h2 className="patient-display mt-4 text-3xl font-medium tracking-tight text-[var(--patient-ink)]">
                Hosted checkout only.
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-[var(--patient-muted)]">
                Payment rows are read through patient-owned RPCs. Mutations happen through Edge Functions and signed gateway webhooks.
              </p>
            </motion.section>
          </div>
        </motion.section>

        {error ? (
          <div role="alert" className="mt-8 rounded-[18px_4px_18px_4px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <motion.section
          variants={patientStagger}
          initial="hidden"
          animate="visible"
          className="mt-8 grid gap-4 md:grid-cols-3"
          aria-busy={loading}
        >
          <SummaryCard
            label="Due now"
            value={loading ? '...' : formatMoney(overview?.summary?.pendingTotal || 0, currency)}
            icon={CreditCard}
            tone="clay"
          />
          <SummaryCard
            label="Paid"
            value={loading ? '...' : formatMoney(overview?.summary?.paidTotal || 0, currency)}
            icon={CheckCircle2}
          />
          <SummaryCard
            label="Refunded"
            value={loading ? '...' : formatMoney(overview?.summary?.refundedTotal || 0, currency)}
            icon={Receipt}
          />
        </motion.section>

        <motion.section
          variants={patientFadeRise}
          initial="hidden"
          animate="visible"
          className="patient-paper-strong patient-surface mt-8 p-6"
        >
          <div className="flex flex-col gap-4 border-b border-[color-mix(in_srgb,var(--patient-outline)_55%,transparent)] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-sage)]">Payment timeline</p>
              <h2 className="patient-display mt-2 text-4xl font-medium tracking-tight text-[var(--patient-ink)]">
                {payablePayments.length ? `${payablePayments.length} payable balance(s)` : 'No balance requiring action'}
              </h2>
            </div>
            <button
              type="button"
              onClick={loadOverview}
              disabled={loading}
              className="patient-button-secondary px-5 py-3 disabled:opacity-50"
            >
              Refresh
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="space-y-3" role="status">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="h-28 animate-pulse rounded-xl bg-[var(--patient-wash)]" />
                ))}
              </div>
            ) : payments.length ? (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    startingId={startingId}
                    receiptId={receiptId}
                    receipt={receipt}
                    onPay={handleStartCheckout}
                    onReceipt={handleReceipt}
                  />
                ))}
              </div>
            ) : (
              <div className="patient-inset border border-dashed border-[var(--patient-outline)] p-8 text-center">
                <Receipt className="mx-auto h-10 w-10 text-[var(--patient-sage)]" />
                <h3 className="patient-display mt-4 text-2xl font-medium tracking-tight text-[var(--patient-ink)]">
                  No billing activity yet.
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-[var(--patient-muted)]">
                  Outstanding balances and receipts will appear here after the clinic posts a patient-owned payment row.
                </p>
              </div>
            )}
          </div>
        </motion.section>
    </PatientPortalShell>
  );
}
