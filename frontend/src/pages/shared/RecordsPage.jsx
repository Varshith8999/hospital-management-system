import { useState } from 'react';
import DataTable, { SearchInput } from '../../components/DataTable';
import { Badge, Field, Modal, PageHeader, Select, Spinner } from '../../components/ui';
import { useAction, useFetch, usePaginatedList } from '../../hooks/useApi';
import { doctorsApi, patientsApi, recordsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { RECORD_TYPES, ROLES } from '../../utils/constants';
import { formatDateTime } from '../../utils/format';

const VITALS = [
  ['bloodPressure', 'Blood pressure', 'text', '120/80'],
  ['temperature', 'Temperature (°C)', 'number', '36.8'],
  ['pulse', 'Pulse (bpm)', 'number', '76'],
  ['respirationRate', 'Respiration (/min)', 'number', '16'],
  ['oxygenSaturation', 'SpO₂ (%)', 'number', '98'],
  ['weightKg', 'Weight (kg)', 'number', '70'],
  ['heightCm', 'Height (cm)', 'number', '170'],
];

const EMPTY = {
  patientId: '',
  recordType: 'Consultation',
  diagnosis: '',
  symptoms: '',
  treatment: '',
  notes: '',
  bloodPressure: '',
  temperature: '',
  pulse: '',
  respirationRate: '',
  oxygenSaturation: '',
  weightKg: '',
  heightCm: '',
};

/**
 * Medical records list.
 * `mode="vitals"` switches the editor into the nurse-facing vitals form.
 */
export default function RecordsPage({ title = 'Medical records', description, mode = 'clinical' }) {
  const { user } = useAuth();
  const toast = useToast();
  const { busy, run } = useAction();

  const isNurse = user?.role === ROLES.NURSE;
  const isVitalsMode = mode === 'vitals' || isNurse;
  const canWrite = [ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMIN].includes(user?.role);

  const list = usePaginatedList(recordsApi.list, { limit: 10 });
  const [editor, setEditor] = useState(null);
  const [errors, setErrors] = useState({});

  const patients = useFetch(
    () => (isNurse ? patientsApi.list({ limit: 100 }) : doctorsApi.myPatients({ limit: 100 })),
    [Boolean(editor)],
    { skip: !editor || !canWrite || user?.role === ROLES.ADMIN }
  );
  const adminPatients = useFetch(() => patientsApi.list({ limit: 100 }), [Boolean(editor)], {
    skip: !editor || user?.role !== ROLES.ADMIN,
  });

  const patientOptions = (
    (user?.role === ROLES.ADMIN ? adminPatients.data?.data : patients.data?.data) || []
  ).map((p) => ({ value: p.id, label: `${p.fullName} (${p.patientCode})` }));

  const update = (key) => (e) => {
    setEditor((state) => ({ ...state, values: { ...state.values, [key]: e.target.value } }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = ({ values, mode: editorMode }) => {
    const next = {};
    if (editorMode === 'create' && !values.patientId) next.patientId = 'Select a patient';

    if (isVitalsMode) {
      const hasVitals = VITALS.some(([key]) => String(values[key] || '').trim() !== '');
      if (!hasVitals && !values.notes.trim()) {
        next.notes = 'Record at least one vital sign or a note';
      }
      if (values.pulse && (Number(values.pulse) < 0 || Number(values.pulse) > 300)) {
        next.pulse = 'Pulse must be between 0 and 300';
      }
      if (
        values.oxygenSaturation &&
        (Number(values.oxygenSaturation) < 0 || Number(values.oxygenSaturation) > 100)
      ) {
        next.oxygenSaturation = 'SpO₂ must be between 0 and 100';
      }
      if (values.temperature && (Number(values.temperature) < 25 || Number(values.temperature) > 45)) {
        next.temperature = 'Temperature must be between 25 and 45 °C';
      }
    } else if (!values.diagnosis.trim() && !values.symptoms.trim() && !values.notes.trim()) {
      next.diagnosis = 'Provide a diagnosis, symptoms or notes';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate(editor)) return;
    const { mode: editorMode, values, id } = editor;

    const numeric = (v) => (v === '' || v === null ? undefined : Number(v));
    const payload = isVitalsMode
      ? {
          recordType: values.recordType === 'Consultation' ? 'Vitals' : values.recordType,
          bloodPressure: values.bloodPressure || undefined,
          temperature: numeric(values.temperature),
          pulse: numeric(values.pulse),
          respirationRate: numeric(values.respirationRate),
          oxygenSaturation: numeric(values.oxygenSaturation),
          weightKg: numeric(values.weightKg),
          heightCm: numeric(values.heightCm),
          notes: values.notes || undefined,
        }
      : {
          recordType: values.recordType,
          diagnosis: values.diagnosis || undefined,
          symptoms: values.symptoms || undefined,
          treatment: values.treatment || undefined,
          notes: values.notes || undefined,
          bloodPressure: values.bloodPressure || undefined,
          temperature: numeric(values.temperature),
          pulse: numeric(values.pulse),
        };

    await run(async () => {
      try {
        if (editorMode === 'create') {
          await recordsApi.create({ ...payload, patientId: Number(values.patientId) });
        } else {
          await recordsApi.update(id, payload);
        }
        toast.success(editorMode === 'create' ? 'Record saved' : 'Record updated');
        setEditor(null);
        list.reload();
      } catch (err) {
        toast.error(err.message);
      }
    });
  };

  const columns = [
    {
      key: 'recordCode',
      header: 'Record',
      render: (row) => <span className="font-mono text-xs">{row.recordCode}</span>,
    },
    { key: 'patient', header: 'Patient', render: (row) => row.patient?.fullName || '—' },
    {
      key: 'recordType',
      header: 'Type',
      render: (row) => (
        <Badge tone={row.recordType === 'Consultation' ? 'blue' : 'amber'}>{row.recordType}</Badge>
      ),
    },
    {
      key: 'diagnosis',
      header: 'Diagnosis / vitals',
      className: 'max-w-sm',
      render: (row) =>
        row.diagnosis || (
          <span className="text-slate-600">
            {[
              row.bloodPressure && `BP ${row.bloodPressure}`,
              row.pulse && `Pulse ${row.pulse}`,
              row.temperature && `Temp ${row.temperature}°C`,
              row.oxygenSaturation && `SpO₂ ${row.oxygenSaturation}%`,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          </span>
        ),
    },
    {
      key: 'author',
      header: 'Recorded by',
      render: (row) => row.doctor?.fullName || row.nurse?.fullName || '—',
    },
    { key: 'recordDate', header: 'Date', render: (row) => formatDateTime(row.recordDate) },
  ];

  if (canWrite) {
    columns.push({
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => {
            setErrors({});
            setEditor({
              mode: 'edit',
              id: row.id,
              values: {
                ...EMPTY,
                ...Object.fromEntries(
                  Object.entries(row).map(([k, v]) => [k, v === null ? '' : v])
                ),
              },
            });
          }}
        >
          Edit
        </button>
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
                setEditor({
                  mode: 'create',
                  values: { ...EMPTY, recordType: isVitalsMode ? 'Vitals' : 'Consultation' },
                });
              }}
            >
              {isVitalsMode ? 'Record vitals' : 'New record'}
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
        emptyTitle="No medical records"
        emptyDescription="Records created for your patients will appear here."
        toolbar={
          <>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search diagnosis or code…"
            />
            <Select
              options={RECORD_TYPES}
              placeholder="All record types"
              value={list.filters.recordType || ''}
              onChange={(e) => list.setFilter('recordType', e.target.value)}
            />
          </>
        }
      />

      <Modal
        open={Boolean(editor)}
        title={
          editor?.mode === 'create'
            ? isVitalsMode
              ? 'Record patient vitals'
              : 'New medical record'
            : 'Edit record'
        }
        onClose={() => setEditor(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditor(null)}>
              Cancel
            </button>
            <button type="submit" form="record-form" className="btn-primary" disabled={busy}>
              {busy && <Spinner className="h-4 w-4 text-white" />}
              Save record
            </button>
          </>
        }
      >
        {editor && (
          <form id="record-form" onSubmit={submit} noValidate className="space-y-4">
            {editor.mode === 'create' && (
              <Field label="Patient" required error={errors.patientId}>
                <Select
                  placeholder="Select a patient"
                  options={patientOptions}
                  value={editor.values.patientId}
                  onChange={update('patientId')}
                />
              </Field>
            )}

            {!isVitalsMode && (
              <>
                <Field label="Record type">
                  <Select
                    options={RECORD_TYPES}
                    value={editor.values.recordType}
                    onChange={update('recordType')}
                  />
                </Field>
                <Field label="Diagnosis" error={errors.diagnosis}>
                  <input
                    className="input"
                    value={editor.values.diagnosis}
                    onChange={update('diagnosis')}
                  />
                </Field>
                <Field label="Symptoms">
                  <textarea
                    className="input min-h-[70px]"
                    value={editor.values.symptoms}
                    onChange={update('symptoms')}
                  />
                </Field>
                <Field label="Treatment">
                  <textarea
                    className="input min-h-[70px]"
                    value={editor.values.treatment}
                    onChange={update('treatment')}
                  />
                </Field>
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              {(isVitalsMode ? VITALS : VITALS.slice(0, 3)).map(
                ([key, label, type, placeholder]) => (
                  <Field key={key} label={label} error={errors[key]}>
                    <input
                      type={type}
                      step="any"
                      className="input"
                      placeholder={placeholder}
                      value={editor.values[key]}
                      onChange={update(key)}
                    />
                  </Field>
                )
              )}
            </div>

            <Field label="Notes" error={errors.notes}>
              <textarea
                className="input min-h-[70px]"
                value={editor.values.notes}
                onChange={update('notes')}
              />
            </Field>
          </form>
        )}
      </Modal>
    </>
  );
}
