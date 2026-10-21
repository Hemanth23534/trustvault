import type { JSX } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../lib/auth';
import { BrandMark } from '../BrandMark';
import { AccessDenied, LoadingBlock } from '../ui/Feedback';

/** Blocks the workspace until the session is restored from the HttpOnly cookie. */
export function RequireAuth(): JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') {
    return (
      <div className="boot-screen">
        <BrandMark />
        <LoadingBlock label="Checking your session…" />
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

/**
 * Frontend role gate. This is purely for a clear experience: the API enforces
 * the same rule on every request, and the 403 it returns is still handled.
 */
export function RequireRole({
  role,
  roles,
}: {
  role?: UserRole;
  roles?: UserRole[];
}): JSX.Element {
  const { user } = useAuth();

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <AccessDenied
        title="Access restricted"
        message="You do not have the required permissions to view this section."
      />
    );
  }

  if (role === 'admin' && user.role !== 'admin') {
    return (
      <AccessDenied
        title="Administrator access required"
        message="This area is limited to platform administrators."
      />
    );
  }

  if (role === 'owner' && user.role === 'viewer') {
    return (
      <AccessDenied
        title="Owner access required"
        message="Viewers can open documents shared with them, but cannot manage a library."
      />
    );
  }

  return <Outlet />;
}
