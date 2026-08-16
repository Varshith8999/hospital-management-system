import { Link } from 'react-router-dom';
import { ErrorState, LoadingBlock, PageHeader, StatCard } from '../../components/ui';
import { useFetch } from '../../hooks/useApi';
import { dashboardApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { AppointmentList, Panel, SimpleList, StatGrid } from '../shared/dashboardParts';
import { formatDate } from '../../utils/format';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => dashboardApi.summary(), []);

  if (loading) return <LoadingBlock label="Loading your dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { counters, upcomingAppointments, recentRecords } = data.data;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.fullName}`}
        description="Your patients, appointments and clinical activity."
        actions={
          <Link to="/doctor/appointments" className="btn-primary">
            Manage appointments
          </Link>
        }
      />

      <div className="space-y-6">
        <StatGrid>
          <StatCard label="My patients" value={counters.totalPatients} tone="blue" />
          <StatCard
            label="Appointments today"
            value={counters.todaysAppointments}
            hint={`${counters.totalAppointments} in total`}
            tone="emerald"
          />
          <StatCard label="Awaiting my response" value={counters.pendingAppointments} tone="amber" />
          <StatCard label="Confirmed" value={counters.confirmedAppointments} tone="blue" />
        </StatGrid>

        <StatGrid>
          <StatCard label="Completed consultations" value={counters.completedAppointments} tone="emerald" />
          <StatCard label="Prescriptions issued" value={counters.totalPrescriptions} tone="slate" />
          <StatCard label="Records authored" value={counters.totalRecords} tone="slate" />
        </StatGrid>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="Upcoming appointments"
            action={
              <Link to="/doctor/appointments" className="btn-secondary btn-sm">
                View all
              </Link>
            }
          >
            <AppointmentList
              appointments={upcomingAppointments}
              emptyMessage="No upcoming appointments."
            />
          </Panel>

          <Panel
            title="Recent medical records"
            action={
              <Link to="/doctor/records" className="btn-secondary btn-sm">
                View all
              </Link>
            }
          >
            <SimpleList
              items={recentRecords}
              emptyMessage="You have not authored any records yet."
              renderPrimary={(r) => `${r.patient?.fullName || 'Patient'} — ${r.diagnosis || r.recordType}`}
              renderSecondary={(r) => formatDate(r.recordDate)}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
