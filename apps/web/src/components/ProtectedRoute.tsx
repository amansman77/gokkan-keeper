import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export default function ProtectedRoute() {
  const { authenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="text-gray-600">인증 확인 중...</div>;
  }

  if (!authenticated) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
