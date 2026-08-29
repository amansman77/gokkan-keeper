import { Suspense, useEffect } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { isAssetJournalPath, isPrivatePath, PRIVATE_ROUTES, PUBLIC_ROUTES } from './app-routes';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './lib/auth-context';
import { setCanonical, setRobots } from './lib/seo';

function RouteSeoController() {
  const location = useLocation();

  useEffect(() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isPagesDomain = host.endsWith('.pages.dev');
    const isNoindexPath = isPrivatePath(location.pathname) || location.pathname === '/login';
    setRobots(isPagesDomain || isNoindexPath ? 'noindex, nofollow' : 'index, follow');
    setCanonical(location.pathname);
  }, [location.pathname]);

  return null;
}

function RouteFallback() {
  return (
    <div className="flex min-h-[16rem] items-center justify-center text-gray-600">
      페이지를 불러오는 중...
    </div>
  );
}

function AppContent() {
  const { authenticated, logout } = useAuth();
  const location = useLocation();
  const isDashboardSection = isAssetJournalPath(location.pathname);
  const navBaseClass = 'px-3 py-2 rounded-md text-sm font-medium';
  const navInactiveClass = 'text-gray-600 hover:text-gray-900';
  const navActiveClass = 'bg-blue-50 text-blue-700';
  const createTrackRecordPath = '/login?next=/dashboard';

  return (
    <>
      <RouteSeoController />
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link to="/" className="text-xl font-semibold text-gray-900">
                  곶간 지기
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) => `${navBaseClass} ${isActive ? navActiveClass : navInactiveClass}`}
                >
                  소개
                </NavLink>
                <NavLink
                  to="/judgment-diary"
                  className={({ isActive }) => `${navBaseClass} ${isActive ? navActiveClass : navInactiveClass}`}
                >
                  판단일지
                </NavLink>
                <NavLink
                  to="/archive"
                  className={({ isActive }) => `${navBaseClass} ${isActive ? navActiveClass : navInactiveClass}`}
                >
                  공개 기록 보기
                </NavLink>
                {authenticated ? (
                  <NavLink
                    to="/dashboard"
                    className={`${navBaseClass} ${isDashboardSection ? navActiveClass : navInactiveClass}`}
                  >
                    대시보드
                  </NavLink>
                ) : null}
                {authenticated ? (
                  <>
                    <button
                      onClick={() => {
                        void logout();
                      }}
                      className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      로그아웃
                    </button>
                  </>
                ) : null}
                {!authenticated ? (
                  <Link
                    to={createTrackRecordPath}
                    className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-slate-800"
                  >
                    나의 트랙레코드 만들기
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {PUBLIC_ROUTES.map(({ path, component: Component }) => (
                <Route key={path} path={path} element={<Component />} />
              ))}

              <Route element={<ProtectedRoute />}>
                {PRIVATE_ROUTES.map(({ path, component: Component }) => (
                  <Route key={path} path={path} element={<Component />} />
                ))}
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
