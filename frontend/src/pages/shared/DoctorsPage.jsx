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
import { useAction, useFetch, usePaginatedList } from '../../hooks/useApi';
import { departmentsApi, doctorsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../utils/constants';
import { formatCurrency } from '../../utils/format';

const EMPTY = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  specialization: '',
  departmentId: '',
  experienceYears: 0,
  qualification: '',
  consultationFee: 0,
  isAvailable: true,
};

export default function DoctorsPage({ title = 'Doctors', description, readOnly = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const { busy, run } = useAction();

  const list = usePaginatedList(doctorsApi.list, { limit: 10 });
  const departments = useFetch(() => departmentsApi.list({ limit: 100 }), []);
  const [editor, setEditor] = useState(null);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const isAdmin = user?.role === ROLES.ADMIN && !readOnly;
  const departmentOptions = (departments.data?.data || []).map((d) => ({
    value: d.id,
    label: d.name,
  }));

  const update = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setEditor((state) => ({ ...state, values: { ...state.values, [key]: value } }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = ({ values, mode }) => {
    const next = {};
    if (values.fullName.trim().length < 2) next.fullName = 'Enter the doctor’s full name';
    if (mode === 'create') {
      if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = 'Enter a valid email';
      if (values.password.length < 8) next.password = 'Password must be at least 8 characters';
    }
    if (!values.specialization.trim()) next.specialization = 'Specialization is required';
    if (!values.departmentId) next.departmentId = 'Select a department';
    if (Number(values.experienceYears) < 0) next.experienceYears = 'Cannot be negative';
    if (Number(values.consultationFee) < 0) next.consultationFee = 'Cannot be negative';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate(editor)) return;
    const { mode, values, id } = editor;

    const payload = {
      fullName: values.fullName.trim(),
      phone: values.phone || undefined,
      specialization: values.specialization.trim(),
      departmentId: Number(values.departmentId),
      experienceYears: Number(values.experienceYears) || 0,
      qualification: values.qualification || undefined,
      consultationFee: Number(values.consultationFee) || 0,
      isAvailable: values.isAvailable,
    };

    await run(async () => {
      try {
        if (mode === 'create') {
          await doctorsApi.create({
            ...payload,
            email: values.email.trim(),
            password: values.password,
          });
        } else {
          await doctorsApi.update(id, payload);
        }
        toast.success(mode === 'create' ? 'Doctor added' : 'Doctor updated');
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
        const res = await doctorsApi.remove(deleteTarget.id);
        toast.success(res.message || 'Doctor removed');
        setDeleteTarget(null);
        list.reload();
      } catch (err) {
        toast.error(err.message);
      }
    });

  const columns = [
    {
      key: 'doctorCode',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs">{row.doctorCode}</span>,
    },
    {
      key: 'fullName',
      header: 'Doctor',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.fullName}</p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      ),
    },
    { key: 'specialization', header: 'Specialization' },
    { key: 'department', header: 'Department', render: (row) => row.department?.name || '—' },
    {
      key: 'experienceYears',
      header: 'Experience',
      render: (row) => `${row.experienceYears} yr${row.experienceYears === 1 ? '' : 's'}`,
    },
    {
      key: 'consultationFee',
      header: 'Fee',
      render: (row) => formatCurrency(row.consultationFee),
    },
    {
      key: 'isAvailable',
      header: 'Availability',
      render: (row) => (
        <Badge tone={row.isAvailable ? 'emerald' : 'slate'}>
          {row.isAvailable ? 'Accepting' : 'Unavailable'}
        </Badge>
      ),
    },
  ];

  if (isAdmin) {
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
                values: {
                  ...EMPTY,
                  ...row,
                  phone: row.phone || '',
                  qualification: row.qualification || '',
                  departmentId: row.departmentId,
                },
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
          isAdmin && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setErrors({});
                setEditor({ mode: 'create', values: { ...EMPTY } });
              }}
            >
              Add doctor
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
        emptyTitle="No doctors found"
        toolbar={
          <>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search by name or specialization…"
            />
            <Select
              options={departmentOptions}
              placeholder="All departments"
              value={list.filters.departmentId || ''}
              onChange={(e) => list.setFilter('departmentId', e.target.value)}
            />
            <Select
              options={[
                { value: 'true', label: 'Accepting appointments' },
                { value: 'false', label: 'Unavailable' },
              ]}
              placeholder="Any availability"
              value={list.filters.isAvailable || ''}
              onChange={(e) => list.setFilter('isAvailable', e.target.value)}
            />
          </>
        }
      />

      <Modal
        open={Boolean(editor)}
        title={editor?.mode === 'create' ? 'Add a doctor' : 'Edit doctor'}
        onClose={() => setEditor(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditor(null)}>
              Cancel
            </button>
            <button type="submit" form="doctor-form" className="btn-primary" disabled={busy}>
              {busy && <Spinner className="h-4 w-4 text-white" />}
              {editor?.mode === 'create' ? 'Create doctor' : 'Save changes'}
            </button>
          </>
        }
      >
        {editor && (
          <form id="doctor-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={errors.fullName}>
              <input className="input" value={editor.values.fullName} onChange={update('fullName')} />
            </Field>

            <Field label="Phone">
              <input className="input" value={editor.values.phone} onChange={update('phone')} />
            </Field>

            {editor.mode === 'create' && (
              <>
                <Field label="Email" required error={errors.email}>
                  <input
                    type="email"
                    className="input"
                    value={editor.values.email}
                    onChange={update('email')}
                  />
                </Field>
                <Field
                  label="Temporary password"
                  required
                  error={errors.password}
                  hint="At least 8 characters"
                >
                  <input
                    type="text"
                    className="input"
                    value={editor.values.password}
                    onChange={update('password')}
                  />
                </Field>
              </>
            )}

            <Field label="Specialization" required error={errors.specialization}>
              <input
                className="input"
                value={editor.values.specialization}
                onChange={update('specialization')}
              />
            </Field>

            <Field label="Department" required error={errors.departmentId}>
              <Select
                options={departmentOptions}
                placeholder="Select a department"
                value={editor.values.departmentId}
                onChange={update('departmentId')}
              />
            </Field>

            <Field label="Experience (years)" error={errors.experienceYears}>
              <input
                type="number"
                min="0"
                max="70"
                className="input"
                value={editor.values.experienceYears}
                onChange={update('experienceYears')}
              />
            </Field>

            <Field label="Consultation fee" error={errors.consultationFee}>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={editor.values.consultationFee}
                onChange={update('consultationFee')}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Qualification">
                <input
                  className="input"
                  value={editor.values.qualification}
                  onChange={update('qualification')}
                  placeholder="MBBS, MD, DM (Cardiology)"
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={editor.values.isAvailable}
                onChange={update('isAvailable')}
              />
              Accepting appointments
            </label>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove doctor"
        message={`Remove ${deleteTarget?.fullName}? Doctors with appointment history are deactivated instead of deleted.`}
        confirmLabel="Remove"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
