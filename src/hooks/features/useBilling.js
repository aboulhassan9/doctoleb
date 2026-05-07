import { useState, useEffect, useCallback, useMemo } from 'react';
import { paymentService } from '@/services/payments';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';

/**
 * useBilling — Fetch, compute stats, and manage invoices.
 *
 * Extracted from BillingPage's 97-line useEffect and scattered state.
 *
 * @returns {{ invoices, stats, activity, barData, loading, error, refresh, updateInvoice, deleteInvoice }}
 */
export function useBilling() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await paymentService.getAll();
      if (err) throw new Error(err.message || 'Failed to load payments');

      const formatted = (data || []).map(p => {
        const fname = p.patients?.users?.first_name || 'Unknown';
        const lname = p.patients?.users?.last_name || 'Patient';
        const canonicalStatus = (p.status || 'pending').toLowerCase();
        const displayStatus = canonicalStatus === 'completed'
          ? 'Paid'
          : canonicalStatus.charAt(0).toUpperCase() + canonicalStatus.slice(1);
        const sCls = canonicalStatus === 'completed'
          ? 'bg-success/10 text-success'
          : canonicalStatus === 'pending'
            ? 'bg-warning/10 text-warning'
            : 'bg-error-container text-on-error-container';
        return {
          id: `#INV-${p.id.split('-')[0].toUpperCase()}`,
          dbId: p.id,
          patient: `${fname} ${lname}`,
          initials: `${fname[0] || ''}${lname[0] || ''}`.toUpperCase(),
          date: new Date(p.created_at || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          amount: parseFloat(p.amount) || 0,
          status: displayStatus,
          statusCls: sCls,
        };
      });
      setInvoices(formatted);
    } catch (err) {
      const msg = err?.message || 'Failed to load billing data';
      logError('useBilling.fetch', err);
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetch(); }, [fetch]);

  // Computed stats
  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const totalRevenue = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
    const unpaidBalance = invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0);
    const overdueCount = invoices.filter(i => i.status === 'Overdue').length;
    return [
      { label: 'Total Invoices', value: totalInvoices, icon: 'description', badge: 'Active system records', badgeCls: 'text-success bg-success/10' },
      { label: 'Total Revenue', value: totalRevenue, icon: 'payments', badge: 'Lifetime Collected', badgeCls: 'text-primary bg-primary/5' },
      { label: 'Unpaid Balance', value: unpaidBalance, icon: 'account_balance_wallet', badge: `${overdueCount} overdue invoices`, badgeCls: 'text-critical bg-red-50' },
    ];
  }, [invoices]);

  const activity = useMemo(() =>
    invoices.slice(0, 5).map(inv => ({
      title: `Invoice ${inv.status}`,
      sub: `Patient: ${inv.patient}`,
      amount: `$${inv.amount.toFixed(2)}`,
      icon: inv.status === 'Paid' ? 'check_circle' : 'pending',
      iconCls: inv.status === 'Paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
      mutedAmount: inv.status !== 'Paid',
    })),
  [invoices]);

  const barData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayIdx = new Date().getDay();
    const revenueByDay = new Array(7).fill(0);

    // This is an approximation based on formatted invoices date string,
    // which might not perfectly capture the original timestamp's day.
    // For a more accurate calculation, we should either store the timestamp in formatted
    // or parse the date string.
    invoices.forEach(inv => {
      if (inv.status === 'Paid') {
          const d = new Date(inv.date).getDay();
          revenueByDay[d] += inv.amount;
      }
    });

    const maxRev = Math.max(...revenueByDay, 100);
    return days.map((day, i) => ({
      day,
      h: `${(revenueByDay[i] / maxRev) * 100}%`,
      cls: i === todayIdx ? 'bg-primary' : 'bg-slate-200',
      isToday: i === todayIdx
    }));
  }, [invoices]);

  const updateInvoice = useCallback((updatedInv) => {
    setInvoices(prev => prev.map(inv => inv.id === updatedInv.id ? updatedInv : inv));
    showToast('Invoice updated successfully', 'success');
  }, [showToast]);

  const deleteInvoice = useCallback((id) => {
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    showToast('Invoice deleted', 'success');
  }, [showToast]);

  return { invoices, stats, activity, barData, loading, error, refresh: fetch, updateInvoice, deleteInvoice };
}
