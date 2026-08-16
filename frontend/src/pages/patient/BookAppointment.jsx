import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable, { SearchInput } from '../../components/DataTable';
import { Badge, ErrorState, LoadingBlock, PageHeader, Select } from '../../components/ui';
import { useFetch, usePaginatedList } from '../../hooks/useApi';
import { departmentsApi, doctorsApi } from '../../api/endpoints';
import { formatCurrency } from '../../utils/format';
import BookAppointmentModal from '../shared/BookAppointmentModal';

export default function PatientBookAppointment() {
  const navigate = useNavigate();
  const list = usePaginatedList(doctorsApi.list, { limit: 10 });
  const departments = useFetch(() => departmentsApi.list({ limit: 100 }), []);
  const [bookOpen, setBookOpen] = useState(false);

  const departmentOptions = (departments.data?.data || []).map((d) => ({
    value: d.id,
    label: d.name,
  }));

  const columns = [
    {
      key: 'fullName',
      header: 'Doctor',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.fullName}</p>
          <p className="text-xs text-slate-500">{row.qualification || row.specialization}</p>
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
    { key: 'consultationFee', header: 'Fee', render: (row) => formatCurrency(row.consultationFee) },
    {
      key: 'isAvailable',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.isAvailable ? 'emerald' : 'slate'}>
          {row.isAvailable ? 'Accepting' : 'Unavailable'}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Find a doctor"
        description="Browse departments and specialists, then book a slot."
        actions={
          <button type="button" className="btn-primary" onClick={() => setBookOpen(true)}>
            Book appointment
          </button>
        }
      />

      <div className="mb-6">
        {departments.loading && <LoadingBlock label="Loading departments…" />}
        {departments.error && <ErrorState message={departments.error} onRetry={departments.reload} />}
        {departments.data && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={!list.filters.departmentId ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              onClick={() => list.setFilter('departmentId', '')}
            >
              All departments
            </button>
            {departments.data.data.map((d) => (
              <button
                key={d.id}
                type="button"
                className={
                  String(list.filters.departmentId) === String(d.id)
                    ? 'btn-primary btn-sm'
                    : 'btn-secondary btn-sm'
                }
                onClick={() => list.setFilter('departmentId', d.id)}
                title={d.description || d.name}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        onPageChange={list.setPage}
        emptyTitle="No doctors match your search"
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
          </>
        }
      />

      <BookAppointmentModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onBooked={() => {
          setBookOpen(false);
          navigate('/patient/appointments');
        }}
      />
    </>
  );
}
