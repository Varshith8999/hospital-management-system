import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../utils/constants';
import { LoadingBlock } from './ui';

/** Requires a valid session; bounces to /login otherwise. */
export function RequireAuth() {
  const { isAuthenticated, initialising } = useAuth();
  const location = useLocation();

  if (initialising) return <LoadingBlock label="Restoring your session…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;

  return <Outlet />;
}

/**
 * Requires one of `roles`. A signed-in user who types another role's URL is
 * redirected to their own dashboard rather than shown the page.
 */
export function RequireRole({ roles }) {
  const { user, initialising } = useAuth();

  if (initialising) return <LoadingBlock />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  }

  return <Outlet />;
}

/** Keeps an already-authenticated user out of /login and /register. */
export function PublicOnly() {
  const { user, initialising } = useAuth();

  if (initialising) return <LoadingBlock />;
  if (user) return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;

  return <Outlet />;
}
