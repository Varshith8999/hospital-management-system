import { useState } from 'react';
import DataTable, { SearchInput } from '../../components/DataTable';
import { Badge, LoadingBlock, Modal, PageHeader } from '../../components/ui';
import { useFetch, usePaginatedList } from '../../hooks/useApi';
import { doctorsApi, patientsApi } from '../../api/endpoints';
import { STATUS_TONE } from '../../utils/constants';
import { formatDate, formatTime } from '../../utils/format';

export default function DoctorPatients() {
  const list = usePaginatedList(doctorsApi.myPatients, { limit: 10 });
  const [detailId, setDetailId] = useState(null);

  const columns = [
    {
      key: 'patientCode',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs">{row.patientCode}</span>,
    },
    {
      key: 'fullName',
      header: 'Patient',
      render: (row) => <span className="font-medium text-slate-800">{row.fullName}</span>,
    },
    { key: 'phone', header: 'Phone' },
    { key: 'gender', header: 'Gender', render: (row) => row.gender || '—' },
    { key: 'bloodGroup', header: 'Blood group' },
    {
      key: 'allergies',
      header: 'Allergies',
      render: (row) => row.allergies || 'None recorded',
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button type="button" className="btn-secondary btn-sm" onClick={() => setDetailId(row.id)}>
          Open chart
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="My patients"
        description="Patients who have booked an appointment with you."
      />

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        onPageChange={list.setPage}
        emptyTitle="No assigned patients yet"
        emptyDescription="Patients appear here once they book an appointment with you."
        toolbar={
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search patients…" />
        }
      />

      <ChartModal id={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}

function ChartModal({ id, onClose }) {
  const { data, loading, error } = useFetch(() => patientsApi.summary(id), [id], { skip: !id });
  const summary = data?.data;

  return (
    <Modal open={Boolean(id)} title="Patient chart" onClose={onClose} size="lg">
      {loading && <LoadingBlock />}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {summary && (
        <div className="space-y-6 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <Info label="Name" value={summary.patient.fullName} />
            <Info label="Age" value={summary.patient.age ?? '—'} />
            <Info label="Blood group" value={summary.patient.bloodGroup} />
            <Info label="Allergies" value={summary.patient.allergies || 'None recorded'} />
            <Info label="History" value={summary.patient.medicalHistory || 'None recorded'} />
            <Info label="Phone" value={summary.patient.phone} />
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-slate-900">Appointments</h3>
            <ul className="divide-y divide-slate-100">
              {summary.appointments.length === 0 && <li className="py-2 text-slate-500">None.</li>}
              {summary.appointments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {formatDate(a.appointmentDate)} · {formatTime(a.appointmentTime)} — {a.reason}
                  </span>
                  <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-slate-900">Medical records</h3>
            <ul className="divide-y divide-slate-100">
              {summary.medicalRecords.length === 0 && <li className="py-2 text-slate-500">None.</li>}
              {summary.medicalRecords.map((r) => (
                <li key={r.id} className="py-2">
                  <p className="font-medium text-slate-800">{r.diagnosis || r.recordType}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(r.recordDate)} · {r.treatment || 'No treatment noted'}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-slate-900">Prescriptions</h3>
            <ul className="divide-y divide-slate-100">
              {summary.prescriptions.length === 0 && <li className="py-2 text-slate-500">None.</li>}
              {summary.prescriptions.map((p) => (
                <li key={p.id} className="py-2">
                  <p className="font-medium text-slate-800">
                    {p.medicine} {p.dosage}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.frequency} · {p.duration} · {formatDate(p.prescriptionDate)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-slate-800">{value}</p>
    </div>
  );
}
