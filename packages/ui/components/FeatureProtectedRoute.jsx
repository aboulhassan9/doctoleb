import { hasEntitlement } from '@core/lib/entitlements';
import { useEntitlements } from '@core/hooks/features/useEntitlements';

function FeatureGateLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        <p className="text-sm font-semibold text-slate-600">Checking feature access...</p>
      </div>
    </div>
  );
}

function FeatureUnavailable({ featureCode, reason }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <section className="max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Feature unavailable</p>
        <h1 className="mt-3 text-2xl font-black text-slate-950">This feature is not enabled for this clinic.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Ask the clinic owner or DoctoLeb SaaS admin to enable `{featureCode}` for this tenant plan.
        </p>
        {reason ? <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs font-semibold text-slate-500">{reason}</p> : null}
      </section>
    </div>
  );
}

export default function FeatureProtectedRoute({ children, featureCode, audience = 'staff' }) {
  const { entitlements, loading, error } = useEntitlements({ audience });

  if (!featureCode) return children;
  if (loading) return <FeatureGateLoading />;

  // UI gating is for product experience; database/RPC/Edge checks remain the security boundary.
  if (error || !hasEntitlement(entitlements, featureCode)) {
    return (
      <FeatureUnavailable
        featureCode={featureCode}
        reason={error ? 'Feature access could not be verified, so the app failed closed.' : ''}
      />
    );
  }

  return children;
}
