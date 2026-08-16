import { Link } from 'react-router-dom';
import { ErrorState, LoadingBlock, PageHeader, StatCard } from '../../components/ui';
import { useFetch } from '../../hooks/useApi';
import { dashboardApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { AppointmentList, Panel, SimpleList, StatGrid } from '../shared/dashboardParts';
import { formatCurrency, formatDate } from '../../utils/format';

export default function PatientDashboard() {
  const { user, profile } = useAuth();
  const { data, loading, error, reload } = useFetch(() => dashboardApi.summary(), []);

  if (loading) return <LoadingBlock label="Loading your health summary…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { counters, upcomingAppointments, recentPrescriptions } = data.data;

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.fullName}`}
        description={
          profile?.patientCode
            ? `Patient ID ${profile.patientCode}`
            : 'Your appointments, prescriptions and bills.'
        }
        actions={
          <Link to="/patient/book" className="btn-primary">
            Book an appointment
          </Link>
        }
      />

      <div className="space-y-6">
        <StatGrid>
          <StatCard
            label="Upcoming appointments"
            value={counters.upcomingAppointments}
            hint={`${counters.totalAppointments} booked in total`}
            tone="blue"
          />
          <StatCard label="Completed visits" value={counters.completedAppointments} tone="emerald" />
          <StatCard label="Active prescriptions" value={counters.totalPrescriptions} tone="amber" />
          <StatCard label="Medical records" value={counters.totalRecords} tone="slate" />
        </StatGrid>

        <StatGrid>
          <StatCard label="Total billed" value={formatCurrency(counters.totalBilled)} tone="slate" />
          <StatCard label="Total paid" value={formatCurrency(counters.totalPaid)} tone="emerald" />
          <StatCard
            label="Outstanding balance"
            value={formatCurrency(counters.outstandingBalance)}
            tone={counters.outstandingBalance > 0 ? 'rose' : 'emerald'}
          />
        </StatGrid>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="Your upcoming appointments"
            action={
              <Link to="/patient/appointments" className="btn-secondary btn-sm">
                View all
              </Link>
            }
          >
            <AppointmentList
              appointments={upcomingAppointments}
              emptyMessage="You have no upcoming appointments."
            />
          </Panel>

          <Panel
            title="Recent prescriptions"
            action={
              <Link to="/patient/prescriptions" className="btn-secondary btn-sm">
                View all
              </Link>
            }
          >
            <SimpleList
              items={recentPrescriptions}
              emptyMessage="No prescriptions yet."
              renderPrimary={(p) => `${p.medicine} · ${p.dosage}`}
              renderSecondary={(p) =>
                `${p.frequency} for ${p.duration} — ${p.doctor?.fullName || 'Doctor'} · ${formatDate(
                  p.prescriptionDate
                )}`
              }
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
