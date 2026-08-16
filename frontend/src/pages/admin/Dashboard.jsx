import { Link } from 'react-router-dom';
import { ErrorState, LoadingBlock, PageHeader, StatCard } from '../../components/ui';
import { useFetch } from '../../hooks/useApi';
import { dashboardApi } from '../../api/endpoints';
import { AppointmentList, Panel, SimpleList, StatGrid } from '../shared/dashboardParts';
import { formatCurrency, formatDate } from '../../utils/format';

export default function AdminDashboard() {
  const { data, loading, error, reload } = useFetch(() => dashboardApi.summary(), []);

  if (loading) return <LoadingBlock label="Loading dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { counters, recentPatients, recentAppointments, departmentBreakdown } = data.data;

  return (
    <>
      <PageHeader
        title="Administrator dashboard"
        description="Hospital-wide activity at a glance."
        actions={
          <Link to="/admin/users" className="btn-primary">
            Manage users
          </Link>
        }
      />

      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Total patients" value={counters.totalPatients} tone="blue" />
          <StatCard label="Total doctors" value={counters.totalDoctors} tone="emerald" />
          <StatCard label="Total nurses" value={counters.totalNurses} tone="amber" />
          <StatCard label="Departments" value={counters.totalDepartments} tone="slate" />
        </StatGrid>

        <StatGrid>
          <StatCard
            label="Total appointments"
            value={counters.totalAppointments}
            hint={`${counters.todaysAppointments} scheduled today`}
            tone="blue"
          />
          <StatCard label="Pending" value={counters.pendingAppointments} tone="amber" />
          <StatCard label="Completed" value={counters.completedAppointments} tone="emerald" />
          <StatCard label="Cancelled" value={counters.cancelledAppointments} tone="rose" />
        </StatGrid>

        <StatGrid>
          <StatCard label="Prescriptions" value={counters.totalPrescriptions} tone="slate" />
          <StatCard label="Medical records" value={counters.totalRecords} tone="slate" />
          <StatCard
            label="Revenue billed"
            value={formatCurrency(counters.totalBilled)}
            hint={`${formatCurrency(counters.totalCollected)} collected`}
            tone="emerald"
          />
          <StatCard label="Unpaid bills" value={counters.unpaidBills} tone="rose" />
        </StatGrid>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="Recent appointments"
            action={
              <Link to="/admin/appointments" className="btn-secondary btn-sm">
                View all
              </Link>
            }
          >
            <AppointmentList
              appointments={recentAppointments}
              emptyMessage="No appointments booked yet."
            />
          </Panel>

          <Panel
            title="Recent patients"
            action={
              <Link to="/admin/patients" className="btn-secondary btn-sm">
                View all
              </Link>
            }
          >
            <SimpleList
              items={recentPatients}
              emptyMessage="No patients registered yet."
              renderPrimary={(p) => `${p.fullName} (${p.patientCode})`}
              renderSecondary={(p) =>
                `${p.phone} · ${p.bloodGroup} · registered ${formatDate(p.createdAt)}`
              }
            />
          </Panel>
        </div>

        <Panel
          title="Departments"
          action={
            <Link to="/admin/departments" className="btn-secondary btn-sm">
              Manage
            </Link>
          }
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Doctors</th>
                  <th>Appointments</th>
                </tr>
              </thead>
              <tbody>
                {departmentBreakdown.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium text-slate-800">{d.name}</td>
                    <td>{d.doctorCount}</td>
                    <td>{d.appointmentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
