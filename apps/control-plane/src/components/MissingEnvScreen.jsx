import { getControlPlaneEnvStatus } from '../lib/controlPlaneClient';

export default function MissingEnvScreen() {
  const status = getControlPlaneEnvStatus();

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-2xl items-center">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl">
          <p className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-cyan-300">Console setup</p>
          <h1 className="text-4xl font-black">Control-plane environment is not configured yet.</h1>
          <p className="mt-4 text-slate-300">
            Add `VITE_CONTROL_PLANE_SUPABASE_URL` and `VITE_CONTROL_PLANE_SUPABASE_ANON_KEY`
            for the SaaS project. Do not use tenant database env vars here.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-slate-300">
            <p>URL configured: {status.hasUrl ? 'yes' : 'no'}</p>
            <p>Anon key configured: {status.hasAnonKey ? 'yes' : 'no'}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
