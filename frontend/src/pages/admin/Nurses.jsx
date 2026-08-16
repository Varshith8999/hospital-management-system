import { useState } from 'react';
import DataTable, { SearchInput } from '../../components/DataTable';
import { Badge, ConfirmDialog, Field, Modal, PageHeader, Select, Spinner } from '../../components/ui';
import { useAction, useFetch, usePaginatedList } from '../../hooks/useApi';
import { departmentsApi, nursesApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { SHIFTS } from '../../utils/constants';

const EMPTY = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  departmentId: '',
  shift: 'Morning',
  experienceYears: 0,
};

export default function AdminNurses() {
  const toast = useToast();
  const { busy, run } = useAction();

  const list = usePaginatedList(nursesApi.list, { limit: 10 });
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

  const submit = async (e) => {
    e.preventDefault();
    const { mode, values, id } = editor;

    const next = {};
    if (values.fullName.trim().length < 2) next.fullName = 'Enter the nurse’s full name';
    if (mode === 'create') {
      if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = 'Enter a valid email';
      if (values.password.length < 8) next.password = 'Password must be at least 8 characters';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    await run(async () => {
      try {
        const payload = {
          fullName: values.fullName.trim(),
          phone: values.phone || undefined,
          departmentId: values.departmentId ? Number(values.departmentId) : null,
          shift: values.shift,
          experienceYears: Number(values.experienceYears) || 0,
        };
        if (mode === 'create') {
          await nursesApi.create({
            ...payload,
            email: values.email.trim(),
            password: values.password,
          });
        } else {
          await nursesApi.update(id, payload);
        }
        toast.success(mode === 'create' ? 'Nurse added' : 'Nurse updated');
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
        const res = await nursesApi.remove(deleteTarget.id);
        toast.success(res.message || 'Nurse removed');
        setDeleteTarget(null);
        list.reload();
      } catch (err) {
        toast.error(err.message);
      }
    });

  const columns = [
    {
      key: 'nurseCode',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs">{row.nurseCode}</span>,
    },
    {
      key: 'fullName',
      header: 'Nurse',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.fullName}</p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      ),
    },
    { key: 'department', header: 'Department', render: (row) => row.department?.name || 'Unassigned' },
    { key: 'shift', header: 'Shift', render: (row) => <Badge tone="amber">{row.shift}</Badge> },
    {
      key: 'experienceYears',
      header: 'Experience',
      render: (row) => `${row.experienceYears} yr${row.experienceYears === 1 ? '' : 's'}`,
    },
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
                  departmentId: row.departmentId || '',
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
    },
  ];

  return (
    <>
      <PageHeader
        title="Nurses"
        description="Nursing staff, their departments and shifts."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setErrors({});
              setEditor({ mode: 'create', values: { ...EMPTY } });
            }}
          >
            Add nurse
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
        emptyTitle="No nurses found"
        toolbar={
          <>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search nurses…"
            />
            <Select
              options={departmentOptions}
              placeholder="All departments"
              value={list.filters.departmentId || ''}
              onChange={(e) => list.setFilter('departmentId', e.target.value)}
            />
            <Select
              options={SHIFTS}
              placeholder="All shifts"
              value={list.filters.shift || ''}
              onChange={(e) => list.setFilter('shift', e.target.value)}
            />
          </>
        }
      />

      <Modal
        open={Boolean(editor)}
        title={editor?.mode === 'create' ? 'Add a nurse' : 'Edit nurse'}
        onClose={() => setEditor(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditor(null)}>
              Cancel
            </button>
            <button type="submit" form="nurse-form" className="btn-primary" disabled={busy}>
              {busy && <Spinner className="h-4 w-4 text-white" />}
              Save nurse
            </button>
          </>
        }
      >
        {editor && (
          <form id="nurse-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
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
                <Field label="Temporary password" required error={errors.password}>
                  <input
                    type="text"
                    className="input"
                    value={editor.values.password}
                    onChange={update('password')}
                  />
                </Field>
              </>
            )}

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

            <Field label="Experience (years)">
              <input
                type="number"
                min="0"
                max="70"
                className="input"
                value={editor.values.experienceYears}
                onChange={update('experienceYears')}
              />
            </Field>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove nurse"
        message={`Remove ${deleteTarget?.fullName}? Nurses with recorded notes are deactivated instead.`}
        confirmLabel="Remove"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
