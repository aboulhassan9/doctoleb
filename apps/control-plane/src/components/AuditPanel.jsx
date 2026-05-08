export default function AuditPanel({ events }) {
  const list = events || [];

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Audit</p>
      <h2 className="mt-2 text-2xl font-black">Recent SaaS events</h2>
      <div className="mt-5 grid gap-3">
        {list.slice(0, 8).map((event) => (
          <div key={event.id} className="rounded-2xl bg-slate-50 p-4">
            <p className="font-black">{event.event_type}</p>
            <p className="text-sm text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
          </div>
        ))}
        {list.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No audit events yet.</p> : null}
      </div>
    </section>
  );
}
