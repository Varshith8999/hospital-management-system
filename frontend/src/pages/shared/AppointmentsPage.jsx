import { useState } from 'react';
import DataTable, { SearchInput } from '../../components/DataTable';
import {
  Badge,
  ConfirmDialog,
  Field,
  Modal,
  PageHeader,
  Select,
  Spinner,
} from '../../components/ui';
import { useAction, usePaginatedList } from '../../hooks/useApi';
import { appointmentsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { APPOINTMENT_STATUSES, ROLES, STATUS_TONE } from '../../utils/constants';
import { formatDate, formatTime, todayISO } from '../../utils/format';
import BookAppointmentModal from './BookAppointmentModal';

export default function AppointmentsPage({ title = 'Appointments', description }) {
  const { user } = useAuth();
  const toast = useToast();
  const { busy, run } = useAction();

  const list = usePaginatedList(appointmentsApi.list, { limit: 10 });
  const [confirmState, setConfirmState] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [bookOpen, setBookOpen] = useState(false);

  const role = user?.role;
  const canDecide = role === ROLES.DOCTOR || role === ROLES.ADMIN;
  const canCancel = [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.PATIENT].includes(role);
  const canReschedule = [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.PATIENT].includes(role);
  const canBook = [ROLES.ADMIN, ROLES.RECEPTIONIST].includes(role);

  const act = (label, fn) =>
    run(async () => {
      try {
        await fn();
        toast.success(label);
        list.reload();
      } catch (err) {
        toast.error(err.message);
      } finally {
        setConfirmState(null);
      }
    });

  const columns = [
    {
      key: 'appointmentCode',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs">{row.appointmentCode}</span>,
    },
    {
      key: 'patient',
      header: 'Patient',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.patient?.fullName || '—'}</p>
          <p className="text-xs text-slate-500">{row.patient?.phone}</p>
        </div>
      ),
    },
    {
      key: 'doctor',
      header: 'Doctor',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.doctor?.fullName || '—'}</p>
          <p className="text-xs text-slate-500">{row.doctor?.specialization}</p>
        </div>
      ),
    },
    { key: 'department', header: 'Department', render: (row) => row.department?.name || '—' },
    {
      key: 'when',
      header: 'Date & time',
      render: (row) => (
        <div>
          <p>{formatDate(row.appointmentDate)}</p>
          <p className="text-xs text-slate-500">{formatTime(row.appointmentTime)}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      className: 'max-w-xs',
      render: (row) => <span className="line-clamp-2 text-slate-600">{row.reason}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'whitespace-nowrap',
      render: (row) => {
        const pending = row.status === 'Pending';
        const confirmed = row.status === 'Confirmed';

        return (
          <div className="flex flex-wrap gap-1.5">
            {canDecide && pending && (
              <>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={busy}
                  onClick={() => act('Appointment confirmed', () => appointmentsApi.confirm(row.id))}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() =>
                    setConfirmState({
                      title: 'Reject appointment',
                      message: `Reject ${row.appointmentCode} for ${row.patient?.fullName}?`,
                      label: 'Reject',
                      action: () =>
                        act('Appointment rejected', () =>
                          appointmentsApi.reject(row.id, { reason: 'Rejected by doctor' })
                        ),
                    })
                  }
                >
                  Reject
                </button>
              </>
            )}

            {canDecide && confirmed && (
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={busy}
                onClick={() => act('Appointment completed', () => appointmentsApi.complete(row.id))}
              >
                Complete
              </button>
            )}

            {canReschedule && (pending || confirmed) && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() =>
                  setRescheduleTarget({
                    ...row,
                    newDate: row.appointmentDate,
                    newTime: row.appointmentTime,
                  })
                }
              >
                Reschedule
              </button>
            )}

            {canCancel && (pending || confirmed) && (
              <button
                type="button"
                className="btn-ghost btn-sm text-rose-600"
                disabled={busy}
                onClick={() =>
                  setConfirmState({
                    title: 'Cancel appointment',
                    message: `Cancel ${row.appointmentCode}? The slot becomes available again.`,
                    label: 'Cancel appointment',
                    action: () =>
                      act('Appointment cancelled', () =>
                        appointmentsApi.cancel(row.id, { reason: 'Cancelled from dashboard' })
                      ),
                  })
                }
              >
                Cancel
              </button>
            )}

            {!pending && !confirmed && <span className="text-xs text-slate-400">No actions</span>}
          </div>
        );
      },
    },
  ];

  const submitReschedule = async (e) => {
    e.preventDefault();
    await act('Appointment rescheduled', () =>
      appointmentsApi.reschedule(rescheduleTarget.id, {
        appointmentDate: rescheduleTarget.newDate,
        appointmentTime: rescheduleTarget.newTime,
      })
    );
    setRescheduleTarget(null);
  };

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          canBook && (
            <button type="button" className="btn-primary" onClick={() => setBookOpen(true)}>
              Book appointment
            </button>
          )
        }
      />

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        onPageChange={list.setPage}
        emptyTitle="No appointments"
        emptyDescription="Appointments matching these filters will appear here."
        toolbar={
          <>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search appointments…"
            />
            <Select
              className="input sm:max-w-[10rem]"
              options={APPOINTMENT_STATUSES}
              placeholder="All statuses"
              value={list.filters.status || ''}
              onChange={(e) => list.setFilter('status', e.target.value)}
            />
            <input
              type="date"
              className="input sm:max-w-[11rem]"
              value={list.filters.date || ''}
              onChange={(e) => list.setFilter('date', e.target.value)}
              aria-label="Filter by date"
            />
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => list.setFilters({ date: todayISO() })}
            >
              Today
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                list.setFilters({});
                list.setSearch('');
              }}
            >
              Clear
            </button>
          </>
        }
      />

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.label}
        busy={busy}
        onConfirm={() => confirmState?.action()}
        onClose={() => setConfirmState(null)}
      />

      <Modal
        open={Boolean(rescheduleTarget)}
        title={`Reschedule ${rescheduleTarget?.appointmentCode || ''}`}
        onClose={() => setRescheduleTarget(null)}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setRescheduleTarget(null)}
            >
              Close
            </button>
            <button
              type="submit"
              form="reschedule-form"
              className="btn-primary"
              disabled={busy}
            >
              {busy && <Spinner className="h-4 w-4 text-white" />}
              Save new slot
            </button>
          </>
        }
      >
        <form id="reschedule-form" onSubmit={submitReschedule} className="space-y-4">
          <Field label="New date" required>
            <input
              type="date"
              className="input"
              min={todayISO()}
              value={rescheduleTarget?.newDate || ''}
              onChange={(e) =>
                setRescheduleTarget((t) => ({ ...t, newDate: e.target.value }))
              }
              required
            />
          </Field>
          <Field label="New time" required hint="24-hour format, e.g. 14:30">
            <input
              type="time"
              className="input"
              value={rescheduleTarget?.newTime || ''}
              onChange={(e) =>
                setRescheduleTarget((t) => ({ ...t, newTime: e.target.value }))
              }
              required
            />
          </Field>
        </form>
      </Modal>

      <BookAppointmentModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onBooked={() => {
          setBookOpen(false);
          list.reload();
        }}
        requirePatient
      />
    </>
  );
}
