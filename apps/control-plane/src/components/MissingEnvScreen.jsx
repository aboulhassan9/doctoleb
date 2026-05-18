import { getControlPlaneEnvStatus } from '../lib/controlPlaneClient';
import { Badge } from './ui';

export default function MissingEnvScreen() {
  const status = getControlPlaneEnvStatus();

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#faf8f4] p-6 text-slate-900 md:p-12">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      <div className="relative z-10 w-full max-w-xl">
        <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-8 md:p-10">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 self-start rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Configuration Pending
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Control plane setup required
            </h1>
            <p className="text-sm leading-relaxed text-slate-500">
              Before accessing the DoctoLeb control panel, configure the environment variables for the global SaaS
              database interface. Do not use localized tenant clinical credentials here.
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-md border border-slate-200 bg-slate-50 p-5">
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Required environment variables
            </h2>
            <div className="flex flex-col gap-2.5 font-mono text-xs">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
                <span className="truncate text-slate-600">VITE_CONTROL_PLANE_SUPABASE_URL</span>
                <Badge variant={status.hasUrl ? 'success' : 'danger'}>
                  {status.hasUrl ? 'Configured' : 'Missing'}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-slate-600">VITE_CONTROL_PLANE_SUPABASE_ANON_KEY</span>
                <Badge variant={status.hasAnonKey ? 'success' : 'danger'}>
                  {status.hasAnonKey ? 'Configured' : 'Missing'}
                </Badge>
              </div>
            </div>
          </div>

          <p className="border-t border-slate-100 pt-5 text-xs leading-relaxed text-slate-400">
            Configure these variables in your root or control-plane{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-600">.env</code> file,
            then restart the development server to load the changes.
          </p>
        </div>
      </div>
    </main>
  );
}
