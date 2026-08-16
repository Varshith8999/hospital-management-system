import { useState } from 'react';
import DataTable, { SearchInput } from '../../components/DataTable';
import { Badge, ConfirmDialog, Field, Modal, PageHeader, Select, Spinner } from '../../components/ui';
import { useAction, useFetch, usePaginatedList } from '../../hooks/useApi';
import { doctorsApi, patientsApi, prescriptionsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../utils/constants';
import { formatDate } from '../../utils/format';

const EMPTY = {
  patientId: '',
  medicine: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
  isActive: true,
};

export default function PrescriptionsPage({ title = 'Prescriptions', description }) {
  const { user } = useAuth();
  const toast = useToast();
  const { busy, run } = useAction();

  const list = usePaginatedList(prescriptionsApi.list, { limit: 10 });
  const [editor, setEditor] = useState(null);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const isDoctor = user?.role === ROLES.DOCTOR;
  const canWrite = isDoctor || user?.role === ROLES.ADMIN;

  const patients = useFetch(
    () => (isDoctor ? doctorsApi.myPatients({ limit: 100 }) : patientsApi.list({ limit: 100 })),
    [Boolean(editor)],
    { skip: !editor || !canWrite }
  );

  const update = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setEditor((state) => ({ ...state, values: { ...state.values, [key]: value } }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = ({ values, mode }) => {
    const next = {};
    if (mode === 'create' && !values.patientId) next.patientId = 'Select a patient';
    if (!values.medicine.trim()) next.medicine = 'Medicine name is required';
    if (!values.dosage.trim()) next.dosage = 'Dosage is required';
    if (!values.frequency.trim()) next.frequency = 'Frequency is required';
    if (!values.duration.trim()) next.duration = 'Duration is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate(editor)) return;
    const { mode, values, id } = editor;

    const payload = {
      medicine: values.medicine.trim(),
      dosage: values.dosage.trim(),
      frequency: values.frequency.trim(),
      duration: values.duration.trim(),
      instructions: values.instructions || undefined,
    };

    await run(async () => {
      try {
        if (mode === 'create') {
          await prescriptionsApi.create({ ...payload, patientId: Number(values.patientId) });
        } else {
          await prescriptionsApi.update(id, { ...payload, isActive: values.isActive });
        }
        toast.success(mode === 'create' ? 'Prescription created' : 'Prescription updated');
        setEditor(null);
        list.reload();
      } catch (err) {
        toast.error(err.message);
      }
    });
  };

  const confirmDelete = () =>
    run(async () => {
      try {
        await prescriptionsApi.remove(deleteTarget.id);
        toast.success('Prescription deleted');
        setDeleteTarget(null);
        list.reload();
      } catch (err) {
        toast.error(err.message);
      }
    });

  const columns = [
    {
      key: 'prescriptionCode',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs">{row.prescriptionCode}</span>,
    },
    { key: 'patient', header: 'Patient', render: (row) => row.patient?.fullName || '—' },
    {
      key: 'medicine',
      header: 'Medicine',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.medicine}</p>
          <p className="text-xs text-slate-500">{row.dosage}</p>
        </div>
      ),
    },
    { key: 'frequency', header: 'Frequency' },
    { key: 'duration', header: 'Duration' },
    {
      key: 'doctor',
      header: 'Prescribed by',
      render: (row) => row.doctor?.fullName || '—',
    },
    {
      key: 'prescriptionDate',
      header: 'Date',
      render: (row) => formatDate(row.prescriptionDate),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.isActive ? 'emerald' : 'slate'}>{row.isActive ? 'Active' : 'Ended'}</Badge>
      ),
    },
  ];

  if (canWrite) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="flex gap-1.5">
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              setErrors({});
              setEditor({
                mode: 'edit',
                id: row.id,
                values: { ...EMPTY, ...row, instructions: row.instructions || '' },
              });
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm text-rose-600"
            onClick={() => setDeleteTarget(row)}
          >
            Delete
          </button>
        </div>
      ),
    });
  }

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          canWrite && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setErrors({});
                setEditor({ mode: 'create', values: { ...EMPTY } });
              }}
            >
              New prescription
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
        emptyTitle="No prescriptions"
        emptyDescription="Prescriptions will appear here once a doctor issues one."
        toolbar={
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search by medicine or code…"
          />
        }
      />

      <Modal
        open={Boolean(editor)}
        title={editor?.mode === 'create' ? 'New prescription' : 'Edit prescription'}
        onClose={() => setEditor(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditor(null)}>
              Cancel
            </button>
            <button type="submit" form="rx-form" className="btn-primary" disabled={busy}>
              {busy && <Spinner className="h-4 w-4 text-white" />}
              Save prescription
            </button>
          </>
        }
      >
        {editor && (
          <form id="rx-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
            {editor.mode === 'create' && (
              <div className="sm:col-span-2">
                <Field label="Patient" required error={errors.patientId}>
                  <Select
                    placeholder={patients.loading ? 'Loading patients…' : 'Select a patient'}
                    options={(patients.data?.data || []).map((p) => ({
                      value: p.id,
                      label: `${p.fullName} (${p.patientCode})`,
                    }))}
                    value={editor.values.patientId}
                    onChange={update('patientId')}
                  />
                </Field>
              </div>
            )}

            <Field label="Medicine" required error={errors.medicine}>
              <input
                className="input"
                value={editor.values.medicine}
                onChange={update('medicine')}
                placeholder="Amoxicillin"
              />
            </Field>

            <Field label="Dosage" required error={errors.dosage}>
              <input
                className="input"
                value={editor.values.dosage}
                onChange={update('dosage')}
                placeholder="500 mg"
              />
            </Field>

            <Field label="Frequency" required error={errors.frequency}>
              <input
                className="input"
                value={editor.values.frequency}
                onChange={update('frequency')}
                placeholder="Three times daily"
              />
            </Field>

            <Field label="Duration" required error={errors.duration}>
              <input
                className="input"
                value={editor.values.duration}
                onChange={update('duration')}
                placeholder="7 days"
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Instructions">
                <textarea
                  className="input min-h-[80px]"
                  value={editor.values.instructions}
                  onChange={update('instructions')}
                  placeholder="Take after meals with a full glass of water"
                />
              </Field>
            </div>

            {editor.mode === 'edit' && (
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={editor.values.isActive}
                  onChange={update('isActive')}
                />
                Still active
              </label>
            )}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete prescription"
        message={`Delete ${deleteTarget?.prescriptionCode} (${deleteTarget?.medicine})?`}
        confirmLabel="Delete"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
