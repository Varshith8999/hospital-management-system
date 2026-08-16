import { useState } from 'react';
import DataTable, { SearchInput } from '../../components/DataTable';
import { Badge, ConfirmDialog, Field, Modal, PageHeader, Select, Spinner } from '../../components/ui';
import { useAction, useFetch, usePaginatedList } from '../../hooks/useApi';
import { departmentsApi, usersApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { SHIFTS } from '../../utils/constants';
import { formatDateTime } from '../../utils/format';

const ROLE_OPTIONS = ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Patient'];

const EMPTY = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  role: 'Receptionist',
  specialization: '',
  departmentId: '',
  shift: 'Morning',
  experienceYears: 0,
};

export default function AdminUsers() {
  const toast = useToast();
  const { busy, run } = useAction();

  const list = usePaginatedList(usersApi.list, { limit: 10 });
  const departments = useFetch(() => departmentsApi.list({ limit: 100 }), []);
  const [editor, setEditor] = useState(null);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const departmentOptions = (departments.data?.data || []).map((d) => ({
    value: d.id,
    label: d.name,
  }));

  const update = (key) => (e) => {
    setEditor((state) => ({ ...state, values: { ...state.values, [key]: e.target.value } }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = ({ values, mode }) => {
    const next = {};
    if (values.fullName.trim().length < 2) next.fullName = 'Enter the full name';
    if (mode === 'create') {
      if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = 'Enter a valid email';
      if (values.password.length < 8) next.password = 'Password must be at least 8 characters';
      if (values.role === 'Doctor') {
        if (!values.specialization.trim()) next.specialization = 'Specialization is required';
        if (!values.departmentId) next.departmentId = 'Select a department';
      }
    } else if (values.password && values.password.length < 8) {
      next.password = 'Password must be at least 8 characters';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate(editor)) return;
    const { mode, values, id } = editor;

    await run(async () => {
      try {
        if (mode === 'create') {
          await usersApi.create({
            fullName: values.fullName.trim(),
            email: values.email.trim(),
            password: values.password,
            phone: values.phone || undefined,
            role: values.role,
            ...(values.role === 'Doctor'
              ? {
                  specialization: values.specialization.trim(),
                  departmentId: Number(values.departmentId),
                  experienceYears: Number(values.experienceYears) || 0,
                }
              : {}),
            ...(values.role === 'Nurse'
              ? {
                  departmentId: values.departmentId ? Number(values.departmentId) : undefined,
                  shift: values.shift,
                  experienceYears: Number(values.experienceYears) || 0,
                }
              : {}),
          });
        } else {
          await usersApi.update(id, {
            fullName: values.fullName.trim(),
            phone: values.phone || undefined,
            ...(values.password ? { password: values.password } : {}),
          });
        }
        toast.success(mode === 'create' ? 'User created' : 'User updated');
        setEditor(null);
        list.reload();
      } catch (err) {
        toast.error(err.message);
      }
    });
  };

  const toggleActive = (row) =>
    run(async () => {
      try {
        await usersApi.setActive(row.id, !row.isActive);
        toast.success(`User ${row.isActive ? 'deactivated' : 'activated'}`);
        list.reload();
      } catch (err) {
        toast.error(err.message);
      }
    });

  const confirmDelete = () =>
    run(async () => {
      try {
        await usersApi.remove(deleteTarget.id);
        toast.success('User deleted');
        setDeleteTarget(null);
        list.reload();
      } catch (err) {
        toast.error(err.message);
      }
    });

  const roleTone = {
    Admin: 'rose',
    Doctor: 'blue',
    Nurse: 'amber',
    Receptionist: 'emerald',
    Patient: 'slate',
  };

  const columns = [
    {
      key: 'fullName',
      header: 'User',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.fullName}</p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (row) => <Badge tone={roleTone[row.role]}>{row.role}</Badge> },
    { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.isActive ? 'emerald' : 'slate'}>
          {row.isActive ? 'Active' : 'Deactivated'}
        </Badge>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last login',
      render: (row) => (row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Never'),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              setErrors({});
              setEditor({
                mode: 'edit',
                id: row.id,
                values: { ...EMPTY, ...row, password: '', phone: row.phone || '' },
              });
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={busy}
            onClick={() => toggleActive(row)}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
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
    },
  ];

  return (
    <>
      <PageHeader
        title="User management"
        description="Create and manage staff and patient accounts."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setErrors({});
              setEditor({ mode: 'create', values: { ...EMPTY } });
            }}
          >
            Add user
          </button>
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
        emptyTitle="No users found"
        toolbar={
          <>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search by name or email…"
            />
            <Select
              options={ROLE_OPTIONS}
              placeholder="All roles"
              value={list.filters.role || ''}
              onChange={(e) => list.setFilter('role', e.target.value)}
            />
            <Select
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Deactivated' },
              ]}
              placeholder="Any status"
              value={list.filters.isActive || ''}
              onChange={(e) => list.setFilter('isActive', e.target.value)}
            />
          </>
        }
      />

      <Modal
        open={Boolean(editor)}
        title={editor?.mode === 'create' ? 'Create a user account' : 'Edit user'}
        onClose={() => setEditor(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditor(null)}>
              Cancel
            </button>
            <button type="submit" form="user-form" className="btn-primary" disabled={busy}>
              {busy && <Spinner className="h-4 w-4 text-white" />}
              Save user
            </button>
          </>
        }
      >
        {editor && (
          <form id="user-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={errors.fullName}>
              <input className="input" value={editor.values.fullName} onChange={update('fullName')} />
            </Field>

            <Field label="Phone">
              <input className="input" value={editor.values.phone} onChange={update('phone')} />
            </Field>

            {editor.mode === 'create' ? (
              <>
                <Field label="Email" required error={errors.email}>
                  <input
                    type="email"
                    className="input"
                    value={editor.values.email}
                    onChange={update('email')}
                  />
                </Field>
                <Field label="Password" required error={errors.password}>
                  <input
                    type="text"
                    className="input"
                    value={editor.values.password}
                    onChange={update('password')}
                  />
                </Field>
                <Field label="Role" required>
                  <Select
                    options={ROLE_OPTIONS}
                    value={editor.values.role}
                    onChange={update('role')}
                  />
                </Field>
              </>
            ) : (
              <Field
                label="New password"
                error={errors.password}
                hint="Leave blank to keep the current password"
              >
                <input
                  type="text"
                  className="input"
                  value={editor.values.password}
                  onChange={update('password')}
                />
              </Field>
            )}

            {editor.mode === 'create' && editor.values.role === 'Doctor' && (
              <>
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
              </>
            )}

            {editor.mode === 'create' && editor.values.role === 'Nurse' && (
              <>
                <Field label="Department">
                  <Select
                    options={departmentOptions}
                    placeholder="Unassigned"
                    value={editor.values.departmentId}
                    onChange={update('departmentId')}
                  />
                </Field>
                <Field label="Shift">
                  <Select options={SHIFTS} value={editor.values.shift} onChange={update('shift')} />
                </Field>
              </>
            )}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete user"
        message={`Permanently delete ${deleteTarget?.fullName}? Their linked profile will be removed too.`}
        confirmLabel="Delete"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
