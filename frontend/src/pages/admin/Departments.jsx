import { useState } from 'react';
import DataTable, { SearchInput } from '../../components/DataTable';
import { Badge, ConfirmDialog, Field, Modal, PageHeader, Spinner } from '../../components/ui';
import { useAction, usePaginatedList } from '../../hooks/useApi';
import { departmentsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';

const EMPTY = { name: '', description: '', location: '', phone: '', isActive: true };

export default function AdminDepartments() {
  const toast = useToast();
  const { busy, run } = useAction();

  const list = usePaginatedList(departmentsApi.list, { limit: 10 });
  const [editor, setEditor] = useState(null);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const update = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setEditor((state) => ({ ...state, values: { ...state.values, [key]: value } }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const { mode, values, id } = editor;

    if (values.name.trim().length < 2) {
      setErrors({ name: 'Enter a department name' });
      return;
    }

    await run(async () => {
      try {
        const payload = {
          name: values.name.trim(),
          description: values.description || undefined,
          location: values.location || undefined,
          phone: values.phone || undefined,
          ...(mode === 'edit' ? { isActive: values.isActive } : {}),
        };
        if (mode === 'create') await departmentsApi.create(payload);
        else await departmentsApi.update(id, payload);

        toast.success(mode === 'create' ? 'Department created' : 'Department updated');
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
        await departmentsApi.remove(deleteTarget.id);
        toast.success('Department deleted');
        setDeleteTarget(null);
        list.reload();
      } catch (err) {
        toast.error(err.message);
      }
    });

  const columns = [
    { key: 'name', header: 'Department', render: (row) => <span className="font-medium">{row.name}</span> },
    {
      key: 'description',
      header: 'Description',
      className: 'max-w-sm',
      render: (row) => <span className="text-slate-600">{row.description || '—'}</span>,
    },
    { key: 'location', header: 'Location', render: (row) => row.location || '—' },
    { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
    {
      key: 'doctors',
      header: 'Doctors',
      render: (row) => (row.doctors ? row.doctors.length : 0),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.isActive ? 'emerald' : 'slate'}>{row.isActive ? 'Active' : 'Closed'}</Badge>
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
                  description: row.description || '',
                  location: row.location || '',
                  phone: row.phone || '',
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
        title="Departments"
        description="Clinical departments patients can browse and book into."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setErrors({});
              setEditor({ mode: 'create', values: { ...EMPTY } });
            }}
          >
            Add department
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
        emptyTitle="No departments yet"
        toolbar={
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search departments…"
          />
        }
      />

      <Modal
        open={Boolean(editor)}
        title={editor?.mode === 'create' ? 'Add a department' : 'Edit department'}
        onClose={() => setEditor(null)}
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditor(null)}>
              Cancel
            </button>
            <button type="submit" form="dept-form" className="btn-primary" disabled={busy}>
              {busy && <Spinner className="h-4 w-4 text-white" />}
              Save department
            </button>
          </>
        }
      >
        {editor && (
          <form id="dept-form" onSubmit={submit} noValidate className="space-y-4">
            <Field label="Name" required error={errors.name}>
              <input
                className="input"
                value={editor.values.name}
                onChange={update('name')}
                placeholder="Cardiology"
              />
            </Field>
            <Field label="Description">
              <textarea
                className="input min-h-[70px]"
                value={editor.values.description}
                onChange={update('description')}
              />
            </Field>
            <Field label="Location">
              <input
                className="input"
                value={editor.values.location}
                onChange={update('location')}
                placeholder="Block A, Floor 2"
              />
            </Field>
            <Field label="Phone">
              <input className="input" value={editor.values.phone} onChange={update('phone')} />
            </Field>
            {editor.mode === 'edit' && (
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={editor.values.isActive}
                  onChange={update('isActive')}
                />
                Department is active
              </label>
            )}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete department"
        message={`Delete ${deleteTarget?.name}? Departments with assigned doctors cannot be deleted.`}
        confirmLabel="Delete"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
