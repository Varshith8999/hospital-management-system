import { useMemo, useState } from 'react';
import DataTable, { SearchInput } from '../../components/DataTable';
import { Badge, Field, Modal, PageHeader, Select, Spinner } from '../../components/ui';
import { useAction, useFetch, usePaginatedList } from '../../hooks/useApi';
import { billsApi, patientsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { PAYMENT_STATUSES, ROLES, STATUS_TONE } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/format';

const CHARGES = [
  ['consultationCharges', 'Consultation'],
  ['medicineCharges', 'Medicine'],
  ['testCharges', 'Tests'],
  ['roomCharges', 'Room'],
  ['otherCharges', 'Other'],
];

const EMPTY = {
  patientId: '',
  consultationCharges: 0,
  medicineCharges: 0,
  testCharges: 0,
  roomCharges: 0,
  otherCharges: 0,
  notes: '',
};

export default function BillsPage({ title = 'Billing', description }) {
  const { user } = useAuth();
  const toast = useToast();
  const { busy, run } = useAction();

  const list = usePaginatedList(billsApi.list, { limit: 10 });
  const [editor, setEditor] = useState(null);
  const [errors, setErrors] = useState({});
  const [payTarget, setPayTarget] = useState(null);

  const canManage = [ROLES.ADMIN, ROLES.RECEPTIONIST].includes(user?.role);
  const patients = useFetch(() => patientsApi.list({ limit: 100 }), [Boolean(editor)], {
    skip: !editor || !canManage,
  });

  // Live preview of the total the backend will compute.
  const previewTotal = useMemo(() => {
    if (!editor) return 0;
    return CHARGES.reduce((sum, [key]) => sum + (Number(editor.values[key]) || 0), 0);
  }, [editor]);

  const update = (key) => (e) => {
    setEditor((state) => ({ ...state, values: { ...state.values, [key]: e.target.value } }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = ({ values, mode }) => {
    const next = {};
    if (mode === 'create' && !values.patientId) next.patientId = 'Select a patient';
    CHARGES.forEach(([key, label]) => {
      const value = Number(values[key]);
      if (Number.isNaN(value) || value < 0) next[key] = `${label} must be zero or more`;
    });
    if (previewTotal <= 0) next.consultationCharges = 'A bill must total more than zero';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate(editor)) return;
    const { mode, values, id } = editor;

    const payload = {
      ...Object.fromEntries(CHARGES.map(([key]) => [key, Number(values[key]) || 0])),
      notes: values.notes || undefined,
    };

    await run(async () => {
      try {
        if (mode === 'create') {
          await billsApi.create({ ...payload, patientId: Number(values.patientId) });
        } else {
          await billsApi.update(id, payload);
        }
        toast.success(mode === 'create' ? 'Bill created' : 'Bill updated');
        setEditor(null);
        list.reload();
      } catch (err) {
        toast.error(err.message);
      }
    });
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    const amount = Number(payTarget.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter a payment amount greater than zero');
      return;
    }
    await run(async () => {
      try {
        await billsApi.pay(payTarget.id, { amount, paymentMethod: payTarget.method || undefined });
        toast.success('Payment recorded');
        setPayTarget(null);
        list.reload();
      } catch (err) {
        toast.error(err.message);
      }
    });
  };

  const columns = [
    {
      key: 'billCode',
      header: 'Bill',
      render: (row) => <span className="font-mono text-xs">{row.billCode}</span>,
    },
    {
      key: 'patient',
      header: 'Patient',
      render: (row) => row.patient?.fullName || `#${row.patientId}`,
    },
    {
      key: 'totalAmount',
      header: 'Total',
      render: (row) => (
        <span className="font-medium text-slate-800">{formatCurrency(row.totalAmount)}</span>
      ),
    },
    { key: 'amountPaid', header: 'Paid', render: (row) => formatCurrency(row.amountPaid) },
    {
      key: 'balanceDue',
      header: 'Balance',
      render: (row) => (
        <span className={row.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}>
          {formatCurrency(row.balanceDue)}
        </span>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Status',
      render: (row) => <Badge tone={STATUS_TONE[row.paymentStatus]}>{row.paymentStatus}</Badge>,
    },
    { key: 'createdAt', header: 'Created', render: (row) => formatDate(row.createdAt) },
  ];

  if (canManage) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="flex gap-1.5">
          {row.paymentStatus !== 'Paid' && (
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => setPayTarget({ ...row, amount: row.balanceDue, method: 'Cash' })}
            >
              Record payment
            </button>
          )}
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              setErrors({});
              setEditor({ mode: 'edit', id: row.id, values: { ...EMPTY, ...row, notes: row.notes || '' } });
            }}
          >
            Edit
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
          canManage && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setErrors({});
                setEditor({ mode: 'create', values: { ...EMPTY } });
              }}
            >
              Create bill
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
        emptyTitle="No bills yet"
        toolbar={
          <>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search by bill code…"
            />
            <Select
              options={PAYMENT_STATUSES}
              placeholder="All payment statuses"
              value={list.filters.paymentStatus || ''}
              onChange={(e) => list.setFilter('paymentStatus', e.target.value)}
            />
          </>
        }
      />

      <Modal
        open={Boolean(editor)}
        title={editor?.mode === 'create' ? 'Create a bill' : 'Edit bill'}
        onClose={() => setEditor(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditor(null)}>
              Cancel
            </button>
            <button type="submit" form="bill-form" className="btn-primary" disabled={busy}>
              {busy && <Spinner className="h-4 w-4 text-white" />}
              {editor?.mode === 'create' ? 'Create bill' : 'Save changes'}
            </button>
          </>
        }
      >
        {editor && (
          <form id="bill-form" onSubmit={submit} noValidate className="space-y-4">
            {editor.mode === 'create' && (
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
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {CHARGES.map(([key, label]) => (
                <Field key={key} label={`${label} charges`} error={errors[key]}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={editor.values[key]}
                    onChange={update(key)}
                  />
                </Field>
              ))}
            </div>

            <Field label="Notes">
              <textarea
                className="input min-h-[70px]"
                value={editor.values.notes}
                onChange={update('notes')}
              />
            </Field>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-600">
                Total (calculated by the server)
              </span>
              <span className="text-lg font-semibold text-slate-900">
                {formatCurrency(previewTotal)}
              </span>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(payTarget)}
        title={`Record payment · ${payTarget?.billCode || ''}`}
        onClose={() => setPayTarget(null)}
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setPayTarget(null)}>
              Cancel
            </button>
            <button type="submit" form="pay-form" className="btn-primary" disabled={busy}>
              {busy && <Spinner className="h-4 w-4 text-white" />}
              Record payment
            </button>
          </>
        }
      >
        {payTarget && (
          <form id="pay-form" onSubmit={submitPayment} className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Total</span>
                <span className="font-medium">{formatCurrency(payTarget.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Already paid</span>
                <span className="font-medium">{formatCurrency(payTarget.amountPaid)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-slate-200 pt-1">
                <span className="text-slate-600">Balance due</span>
                <span className="font-semibold text-rose-600">
                  {formatCurrency(payTarget.balanceDue)}
                </span>
              </div>
            </div>

            <Field label="Amount" required hint="Cannot exceed the outstanding balance">
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={payTarget.balanceDue}
                className="input"
                value={payTarget.amount}
                onChange={(e) => setPayTarget((t) => ({ ...t, amount: e.target.value }))}
                required
              />
            </Field>

            <Field label="Payment method">
              <Select
                options={['Cash', 'Card', 'UPI', 'Net Banking', 'Insurance']}
                value={payTarget.method}
                onChange={(e) => setPayTarget((t) => ({ ...t, method: e.target.value }))}
              />
            </Field>
          </form>
        )}
      </Modal>
    </>
  );
}
