import { Badge, EmptyState } from '../../components/ui';
import { STATUS_TONE } from '../../utils/constants';
import { formatDate, formatTime } from '../../utils/format';

export function StatGrid({ children }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

export function Panel({ title, action, children }) {
  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AppointmentList({ appointments = [], emptyMessage = 'Nothing scheduled.' }) {
  if (!appointments.length) return <EmptyState title={emptyMessage} />;

  return (
    <ul className="divide-y divide-slate-100">
      {appointments.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">
              {a.patient?.fullName || 'Patient'} · {a.doctor?.fullName || 'Doctor'}
            </p>
            <p className="truncate text-xs text-slate-500">
              {formatDate(a.appointmentDate)} at {formatTime(a.appointmentTime)}
              {a.department?.name ? ` · ${a.department.name}` : ''}
            </p>
          </div>
          <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
        </li>
      ))}
    </ul>
  );
}

export function SimpleList({ items = [], renderPrimary, renderSecondary, emptyMessage }) {
  if (!items.length) return <EmptyState title={emptyMessage || 'Nothing to show yet.'} />;

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.id} className="px-5 py-3">
          <p className="text-sm font-medium text-slate-800">{renderPrimary(item)}</p>
          {renderSecondary && (
            <p className="text-xs text-slate-500">{renderSecondary(item)}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
