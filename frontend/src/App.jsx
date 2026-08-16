import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { PublicOnly, RequireAuth, RequireRole } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { ROLES, ROLE_HOME } from './utils/constants';
import { LoadingBlock } from './components/ui';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminNurses from './pages/admin/Nurses';
import AdminDepartments from './pages/admin/Departments';

import DoctorDashboard from './pages/doctor/Dashboard';
import DoctorPatients from './pages/doctor/MyPatients';

import NurseDashboard from './pages/nurse/Dashboard';
import ReceptionistDashboard from './pages/receptionist/Dashboard';

import PatientDashboard from './pages/patient/Dashboard';
import PatientBookAppointment from './pages/patient/BookAppointment';
import PatientProfile from './pages/patient/Profile';

import AppointmentsPage from './pages/shared/AppointmentsPage';
import PatientsPage from './pages/shared/PatientsPage';
import DoctorsPage from './pages/shared/DoctorsPage';
import RecordsPage from './pages/shared/RecordsPage';
import PrescriptionsPage from './pages/shared/PrescriptionsPage';
import BillsPage from './pages/shared/BillsPage';

function RootRedirect() {
  const { user, initialising } = useAuth();
  if (initialising) return <LoadingBlock />;
  return <Navigate to={user ? ROLE_HOME[user.role] || '/login' : '/login'} replace />;
}

function NotFound() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-semibold text-slate-300">404</p>
      <h1 className="text-xl font-semibold text-slate-800">Page not found</h1>
      <p className="text-sm text-slate-500">
        The page you are looking for does not exist or you do not have access to it.
      </p>
      <Link to={user ? ROLE_HOME[user.role] || '/login' : '/login'} className="btn-primary mt-2">
        Back to safety
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* ------------------------------------------------------------ public */}
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />

      {/* --------------------------------------------------- authenticated */}
      <Route element={<RequireAuth />}>
        {/* ------------------------------------------------------- admin */}
        <Route element={<RequireRole roles={[ROLES.ADMIN]} />}>
          <Route path="/admin" element={<Layout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="doctors" element={<DoctorsPage description="Add, edit and remove doctors." />} />
            <Route path="nurses" element={<AdminNurses />} />
            <Route
              path="patients"
              element={<PatientsPage description="Every patient registered at the hospital." />}
            />
            <Route path="departments" element={<AdminDepartments />} />
            <Route
              path="appointments"
              element={<AppointmentsPage description="All appointments across the hospital." />}
            />
            <Route path="records" element={<RecordsPage description="All clinical records." />} />
            <Route path="bills" element={<BillsPage description="All patient bills and payments." />} />
          </Route>
        </Route>

        {/* ------------------------------------------------------ doctor */}
        <Route element={<RequireRole roles={[ROLES.DOCTOR]} />}>
          <Route path="/doctor" element={<Layout />}>
            <Route index element={<DoctorDashboard />} />
            <Route
              path="appointments"
              element={
                <AppointmentsPage
                  title="My appointments"
                  description="Confirm, reject or complete your appointments."
                />
              }
            />
            <Route path="patients" element={<DoctorPatients />} />
            <Route
              path="records"
              element={
                <RecordsPage description="Diagnoses, treatment notes and vitals for your patients." />
              }
            />
            <Route
              path="prescriptions"
              element={<PrescriptionsPage description="Prescriptions you have issued." />}
            />
          </Route>
        </Route>

        {/* ------------------------------------------------------- nurse */}
        <Route element={<RequireRole roles={[ROLES.NURSE]} />}>
          <Route path="/nurse" element={<Layout />}>
            <Route index element={<NurseDashboard />} />
            <Route
              path="patients"
              element={
                <PatientsPage description="Patients in your department. You may update basic details." />
              }
            />
            <Route
              path="appointments"
              element={<AppointmentsPage description="Appointments in your department." />}
            />
            <Route
              path="vitals"
              element={
                <RecordsPage
                  title="Vitals & nursing notes"
                  description="Record patient vitals and add nursing notes."
                  mode="vitals"
                />
              }
            />
          </Route>
        </Route>

        {/* ------------------------------------------------ receptionist */}
        <Route element={<RequireRole roles={[ROLES.RECEPTIONIST]} />}>
          <Route path="/receptionist" element={<Layout />}>
            <Route index element={<ReceptionistDashboard />} />
            <Route
              path="patients"
              element={<PatientsPage description="Register and search patients." />}
            />
            <Route
              path="appointments"
              element={
                <AppointmentsPage description="Book, reschedule and cancel appointments." />
              }
            />
            <Route
              path="doctors"
              element={<DoctorsPage description="Doctors and their availability." readOnly />}
            />
            <Route path="bills" element={<BillsPage description="Create bills and record payments." />} />
          </Route>
        </Route>

        {/* ----------------------------------------------------- patient */}
        <Route element={<RequireRole roles={[ROLES.PATIENT]} />}>
          <Route path="/patient" element={<Layout />}>
            <Route index element={<PatientDashboard />} />
            <Route
              path="appointments"
              element={
                <AppointmentsPage
                  title="My appointments"
                  description="Your upcoming and past appointments."
                />
              }
            />
            <Route path="book" element={<PatientBookAppointment />} />
            <Route
              path="prescriptions"
              element={<PrescriptionsPage title="My prescriptions" description="Medication prescribed to you." />}
            />
            <Route
              path="records"
              element={<RecordsPage title="My medical records" description="Your clinical history." />}
            />
            <Route path="bills" element={<BillsPage title="My bills" description="Your bills and payment status." />} />
            <Route path="profile" element={<PatientProfile />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
