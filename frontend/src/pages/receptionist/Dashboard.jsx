import { Link } from 'react-router-dom';
import { ErrorState, LoadingBlock, PageHeader, StatCard } from '../../components/ui';
import { useFetch } from '../../hooks/useApi';
import { dashboardApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { AppointmentList, Panel, StatGrid } from '../shared/dashboardParts';

export default function ReceptionistDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => dashboardApi.summary(), []);

  if (loading) return <LoadingBlock label="Loading the front desk…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { counters, todaysAppointments } = data.data;

  return (
    <>
      <PageHeader
        title={`Front desk · ${user?.fullName}`}
        description="Registrations, scheduling and billing for today."
        actions={
          <>
            <Link to="/receptionist/patients" className="btn-secondary">
              Register patient
            </Link>
            <Link to="/receptionist/appointments" className="btn-primary">
              Book appointment
            </Link>
          </>
        }
      />

      <div className="space-y-6">
        <StatGrid>
          <StatCard
            label="Appointments today"
            value={counters.todaysAppointments}
            tone="blue"
          />
          <StatCard label="Pending confirmations" value={counters.pendingAppointments} tone="amber" />
          <StatCard
            label="Registered today"
            value={counters.registeredToday}
            hint={`${counters.totalPatients} patients in total`}
            tone="emerald"
          />
          <StatCard label="Unpaid bills" value={counters.unpaidBills} tone="rose" />
        </StatGrid>

        <Panel
          title="Today's schedule"
          action={
            <Link to="/receptionist/appointments" className="btn-secondary btn-sm">
              View all
            </Link>
          }
        >
          <AppointmentList
            appointments={todaysAppointments}
            emptyMessage="Nothing scheduled for today."
          />
        </Panel>
      </div>
    </>
  );
}
