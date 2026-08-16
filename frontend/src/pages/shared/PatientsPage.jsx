import { useState } from 'react';
import DataTable, { SearchInput } from '../../components/DataTable';
import {
  Badge,
  ConfirmDialog,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Spinner,
} from '../../components/ui';
import { useAction, useFetch, usePaginatedList } from '../../hooks/useApi';
import { patientsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { BLOOD_GROUPS, GENDERS, ROLES, STATUS_TONE } from '../../utils/constants';
import { formatCurrency, formatDate, formatTime } from '../../utils/format';

const EMPTY = {
  fullName: '',
  phone: '',
  email: '',
  dateOfBirth: '',
  gender: '',
  bloodGroup: 'Unknown',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  medicalHistory: '',
  allergies: '',
  createLogin: false,
  password: '',
};

export default function PatientsPage({ title = 'Patients', description }) {
  const { user } = useAuth();
  const toast = useToast();
  const { busy, run } = useAction();

  const list = usePaginatedList(patientsApi.list, { limit: 10 });
  const [editor, setEditor] = useState(null); // { mode, values, id }
  const [errors, setErrors] = useState({});
  const [detailId, setDetailId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const role = user?.role;
  const canCreate = [ROLES.ADMIN, ROLES.RECEPTIONIST].includes(role);
  const canEdit = [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.NURSE].includes(role);
  const canDelete = role === ROLES.ADMIN;
  const nurseOnly = role === ROLES.NURSE;

  const openCreate = () => {
    setErrors({});
    setEditor({ mode: 'create', values: { ...EMPTY } });
  };

  const openEdit = (row) => {
    setErrors({});
    setEditor({
      mode: 'edit',
      id: row.id,
      values: {
        ...EMPTY,
        ...row,
        dateOfBirth: row.dateOfBirth || '',
        gender: row.gender || '',
        email: row.email || '',
        address: row.address || '',
        emergencyContactName: row.emergencyContactName || '',
        emergencyContactPhone: row.emergencyContactPhone || '',
        medicalHistory: row.medicalHistory || '',
        allergies: row.allergies || '',
      },
    });
  };

  const update = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setEditor((state) => ({ ...state, values: { ...state.values, [key]: value } }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (values, mode) => {
    const next = {};
    if (!nurseOnly) {
      if (!values.fullName || values.fullName.trim().length < 2) {
        next.fullName = 'Enter the full name';
      }
    }
    if (!values.phone || values.phone.trim().length < 6) next.phone = 'Enter a valid phone number';
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) next.email = 'Enter a valid email';
    if (mode === 'create' && values.createLogin) {
      if (!values.email) next.email = 'Email is required to create a login';
      if (!values.password || values.password.length < 8) {
        next.password = 'Password must be at least 8 characters';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    const { mode, values, id } = editor;
    if (!validate(values, mode)) return;

    // Only send fields this role is actually allowed to write.
    const payload = nurseOnly
      ? {
          phone: values.phone,
          address: values.address,
          bloodGroup: values.bloodGroup,
          emergencyContactName: values.emergencyContactName,
          emergencyContactPhone: values.emergencyContactPhone,
          allergies: values.allergies,
        }
      : {
          fullName: values.fullName,
          phone: values.phone,
          email: values.email || undefined,
          dateOfBirth: values.dateOfBirth || undefined,
          gender: values.gender || undefined,
          bloodGroup: values.bloodGroup,
          address: values.address || undefined,
          emergencyContactName: values.emergencyContactName || undefined,
          emergencyContactPhone: values.emergencyContactPhone || undefined,
          ...(role === ROLES.ADMIN
            ? {
                medicalHistory: values.medicalHistory || undefined,
                allergies: values.allergies || undefined,
              }
            : {}),
        };

    if (mode === 'create' && values.createLogin) {
      payload.createLogin = true;
      payload.password = values.password;
    }

    await run(async () => {
      try {
        if (mode === 'create') await patientsApi.create(payload);
        else await patientsApi.update(id, payload);
        toast.success(mode === 'create' ? 'Patient created' : 'Patient updated');
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
        const res = await patientsApi.remove(deleteTarget.id);
        toast.success(res.message || 'Patient removed');
        setDeleteTarget(null);
        list.reload();
      } catch (err) {
        toast.error(err.message);
      }
    });

  const columns = [
    {
      key: 'patientCode',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs">{row.patientCode}</span>,
    },
    {
      key: 'fullName',
      header: 'Name',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.fullName}</p>
          <p className="text-xs text-slate-500">{row.email || 'No email'}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone' },
    { key: 'gender', header: 'Gender', render: (row) => row.gender || '—' },
    { key: 'bloodGroup', header: 'Blood group' },
    { key: 'dateOfBirth', header: 'Date of birth', render: (row) => formatDate(row.dateOfBirth) },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.isActive ? 'emerald' : 'slate'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="btn-secondary btn-sm" onClick={() => setDetailId(row.id)}>
            View
          </button>
          {canEdit && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(row)}>
              Edit
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="btn-ghost btn-sm text-rose-600"
              onClick={() => setDeleteTarget(row)}
            >
              Delete
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          canCreate && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              Register patient
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
        emptyTitle="No patients found"
        emptyDescription="Try a different search term, or register a new patient."
        toolbar={
          <>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search by name, code or phone…"
            />
            <Select
              options={GENDERS}
              placeholder="All genders"
              value={list.filters.gender || ''}
              onChange={(e) => list.setFilter('gender', e.target.value)}
            />
            <Select
              options={BLOOD_GROUPS}
              placeholder="All blood groups"
              value={list.filters.bloodGroup || ''}
              onChange={(e) => list.setFilter('bloodGroup', e.target.value)}
            />
          </>
        }
      />

      {/* -------------------------------------------------------- editor */}
      <Modal
        open={Boolean(editor)}
        title={editor?.mode === 'create' ? 'Register a new patient' : 'Edit patient'}
        onClose={() => setEditor(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditor(null)}>
              Cancel
            </button>
            <button type="submit" form="patient-form" className="btn-primary" disabled={busy}>
              {busy && <Spinner className="h-4 w-4 text-white" />}
              {editor?.mode === 'create' ? 'Create patient' : 'Save changes'}
            </button>
          </>
        }
      >
        {editor && (
          <form id="patient-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
            {nurseOnly && (
              <p className="sm:col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                As a nurse you may update contact details, blood group and allergies only.
              </p>
            )}

            <Field label="Full name" required={!nurseOnly} error={errors.fullName}>
              <input
                className="input"
                value={editor.values.fullName}
                onChange={update('fullName')}
                disabled={nurseOnly}
              />
            </Field>

            <Field label="Phone" required error={errors.phone}>
              <input className="input" value={editor.values.phone} onChange={update('phone')} />
            </Field>

            <Field label="Email" error={errors.email}>
              <input
                type="email"
                className="input"
                value={editor.values.email}
                onChange={update('email')}
                disabled={nurseOnly}
              />
            </Field>

            <Field label="Date of birth">
              <input
                type="date"
                className="input"
                max={new Date().toISOString().slice(0, 10)}
                value={editor.values.dateOfBirth}
                onChange={update('dateOfBirth')}
                disabled={nurseOnly}
              />
            </Field>

            <Field label="Gender">
              <Select
                options={GENDERS}
                placeholder="Not specified"
                value={editor.values.gender}
                onChange={update('gender')}
                disabled={nurseOnly}
              />
            </Field>

            <Field label="Blood group">
              <Select
                options={BLOOD_GROUPS}
                value={editor.values.bloodGroup}
                onChange={update('bloodGroup')}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Address">
                <input className="input" value={editor.values.address} onChange={update('address')} />
              </Field>
            </div>

            <Field label="Emergency contact name">
              <input
                className="input"
                value={editor.values.emergencyContactName}
                onChange={update('emergencyContactName')}
              />
            </Field>

            <Field label="Emergency contact phone">
              <input
                className="input"
                value={editor.values.emergencyContactPhone}
                onChange={update('emergencyContactPhone')}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Allergies">
                <input
                  className="input"
                  value={editor.values.allergies}
                  onChange={update('allergies')}
                />
              </Field>
            </div>

            {role === ROLES.ADMIN && (
              <div className="sm:col-span-2">
                <Field label="Medical history">
                  <textarea
                    className="input min-h-[80px]"
                    value={editor.values.medicalHistory}
                    onChange={update('medicalHistory')}
                  />
                </Field>
              </div>
            )}

            {editor.mode === 'create' && (
              <div className="sm:col-span-2 rounded-lg border border-slate-200 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={editor.values.createLogin}
                    onChange={update('createLogin')}
                  />
                  Also create a patient login
                </label>
                {editor.values.createLogin && (
                  <div className="mt-3">
                    <Field
                      label="Temporary password"
                      required
                      error={errors.password}
                      hint="At least 8 characters. The patient can change it after signing in."
                    >
                      <input
                        type="text"
                        className="input"
                        value={editor.values.password}
                        onChange={update('password')}
                      />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </form>
        )}
      </Modal>

      <PatientDetailModal id={detailId} onClose={() => setDetailId(null)} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove patient"
        message={`Remove ${deleteTarget?.fullName}? Patients with clinical history are deactivated instead of deleted.`}
        confirmLabel="Remove"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------- detail view */

function PatientDetailModal({ id, onClose }) {
  const { data, loading, error } = useFetch(() => patientsApi.summary(id), [id], { skip: !id });
  const summary = data?.data;

  return (
    <Modal open={Boolean(id)} title="Patient record" onClose={onClose} size="lg">
      {loading && <LoadingBlock />}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {summary && (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-3">
            <Detail label="Name" value={summary.patient.fullName} />
            <Detail label="Patient code" value={summary.patient.patientCode} />
            <Detail label="Age" value={summary.patient.age ?? '—'} />
            <Detail label="Phone" value={summary.patient.phone} />
            <Detail label="Blood group" value={summary.patient.bloodGroup} />
            <Detail label="Gender" value={summary.patient.gender || '—'} />
            <Detail label="Allergies" value={summary.patient.allergies || 'None recorded'} />
            <Detail
              label="Emergency contact"
              value={
                summary.patient.emergencyContactName
                  ? `${summary.patient.emergencyContactName} · ${summary.patient.emergencyContactPhone || ''}`
                  : '—'
              }
            />
            <Detail label="Address" value={summary.patient.address || '—'} />
          </section>

          <Section title={`Appointments (${summary.appointments.length})`}>
            {summary.appointments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {formatDate(a.appointmentDate)} · {formatTime(a.appointmentTime)} —{' '}
                  {a.doctor?.fullName}
                </span>
                <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
              </li>
            ))}
          </Section>

          <Section title={`Medical records (${summary.medicalRecords.length})`}>
            {summary.medicalRecords.map((r) => (
              <li key={r.id} className="py-2">
                <p className="font-medium text-slate-800">
                  {r.diagnosis || r.recordType} · {formatDate(r.recordDate)}
                </p>
                {r.treatment && <p className="text-xs text-slate-500">{r.treatment}</p>}
              </li>
            ))}
          </Section>

          <Section title={`Prescriptions (${summary.prescriptions.length})`}>
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
          </Section>

          <Section title={`Bills (${summary.bills.length})`}>
            {summary.bills.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {b.billCode} · {formatCurrency(b.totalAmount)}
                </span>
                <Badge tone={STATUS_TONE[b.paymentStatus]}>{b.paymentStatus}</Badge>
              </li>
            ))}
          </Section>
        </div>
      )}
    </Modal>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  );
}

function Section({ title, children }) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.filter(Boolean).length > 0;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      {hasItems ? (
        <ul className="divide-y divide-slate-100 text-sm">{children}</ul>
      ) : (
        <p className="text-sm text-slate-500">Nothing recorded yet.</p>
      )}
    </section>
  );
}
