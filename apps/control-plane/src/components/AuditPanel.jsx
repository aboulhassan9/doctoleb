import { History, Activity, Inbox } from 'lucide-react';
import { Card, CardContent, SettingsSection } from './ui';

export default function AuditPanel({ events }) {
  const list = events || [];

  return (
    <SettingsSection
      title="Recent SaaS Events"
      description="Audit trail of control plane actions and lifecycle mutations"
      icon={History}
    >
      <Card>
        <CardContent className="p-0">
          {list.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {list.slice(0, 8).map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                      <Activity className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium tracking-tight text-slate-900">
                        {event.event_type}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">ID {event.id.split('-')[0]}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-slate-600">
                      {new Date(event.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      {new Date(event.created_at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300">
                <Inbox className="h-5 w-5" />
              </span>
              <h4 className="text-sm font-semibold text-slate-900">No audit events</h4>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                No lifecycle events or mutations have been recorded for this tenant yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </SettingsSection>
  );
}
