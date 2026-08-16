import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../utils/constants';
import { initials } from '../utils/format';

const NAV = {
  [ROLES.ADMIN]: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/doctors', label: 'Doctors' },
    { to: '/admin/nurses', label: 'Nurses' },
    { to: '/admin/patients', label: 'Patients' },
    { to: '/admin/departments', label: 'Departments' },
    { to: '/admin/appointments', label: 'Appointments' },
    { to: '/admin/records', label: 'Medical records' },
    { to: '/admin/bills', label: 'Billing' },
  ],
  [ROLES.DOCTOR]: [
    { to: '/doctor', label: 'Dashboard', end: true },
    { to: '/doctor/appointments', label: 'Appointments' },
    { to: '/doctor/patients', label: 'My patients' },
    { to: '/doctor/records', label: 'Medical records' },
    { to: '/doctor/prescriptions', label: 'Prescriptions' },
  ],
  [ROLES.NURSE]: [
    { to: '/nurse', label: 'Dashboard', end: true },
    { to: '/nurse/patients', label: 'Patients' },
    { to: '/nurse/appointments', label: 'Appointments' },
    { to: '/nurse/vitals', label: 'Vitals & notes' },
  ],
  [ROLES.RECEPTIONIST]: [
    { to: '/receptionist', label: 'Dashboard', end: true },
    { to: '/receptionist/patients', label: 'Patients' },
    { to: '/receptionist/appointments', label: 'Appointments' },
    { to: '/receptionist/doctors', label: 'Doctors' },
    { to: '/receptionist/bills', label: 'Billing' },
  ],
  [ROLES.PATIENT]: [
    { to: '/patient', label: 'Dashboard', end: true },
    { to: '/patient/appointments', label: 'My appointments' },
    { to: '/patient/book', label: 'Book appointment' },
    { to: '/patient/prescriptions', label: 'Prescriptions' },
    { to: '/patient/records', label: 'Medical records' },
    { to: '/patient/bills', label: 'Bills' },
    { to: '/patient/profile', label: 'My profile' },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => setSidebarOpen(false), [location.pathname]);

  const links = NAV[user?.role] || [];

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle navigation"
              aria-expanded={sidebarOpen}
            >
              <span className="block h-0.5 w-5 bg-current" />
              <span className="mt-1 block h-0.5 w-5 bg-current" />
              <span className="mt-1 block h-0.5 w-5 bg-current" />
            </button>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                H
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-900">Hospital MS</p>
                <p className="hidden text-xs text-slate-500 sm:block">{user?.role} workspace</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800">{user?.fullName}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
              {initials(user?.fullName)}
            </span>
            <button type="button" className="btn-secondary btn-sm" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-30 mt-16 w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 transition-transform lg:static lg:mt-0 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="space-y-1">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
