import { Link } from 'react-router-dom';
import { ErrorState, LoadingBlock, PageHeader, StatCard } from '../../components/ui';
import { useFetch } from '../../hooks/useApi';
import { dashboardApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { AppointmentList, Panel, StatGrid } from '../shared/dashboardParts';

export default function NurseDashboard() {
  const { user, profile } = useAuth();
  const { data, loading, error, reload } = useFetch(() => dashboardApi.summary(), []);

  if (loading) return <LoadingBlock label="Loading your dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { counters, upcomingAppointments } = data.data;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.fullName}`}
        description={
          profile?.shift ? `${profile.shift} shift · nursing station` : 'Nursing station'
        }
        actions={
          <Link to="/nurse/vitals" className="btn-primary">
            Record vitals
          </Link>
        }
      />

      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Assigned patients" value={counters.assignedPatients} tone="blue" />
          <StatCard label="Appointments today" value={counters.todaysAppointments} tone="emerald" />
          <StatCard label="Pending appointments" value={counters.pendingAppointments} tone="amber" />
          <StatCard label="Vitals & notes recorded" value={counters.notesRecorded} tone="slate" />
        </StatGrid>

        <Panel
          title="Upcoming in your department"
          action={
            <Link to="/nurse/appointments" className="btn-secondary btn-sm">
              View all
            </Link>
          }
        >
          <AppointmentList
            appointments={upcomingAppointments}
            emptyMessage="No upcoming appointments in your department."
          />
        </Panel>
      </div>
    </>
  );
}
