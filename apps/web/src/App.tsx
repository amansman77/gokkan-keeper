import { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { isAssetJournalPath, isPrivatePath, PRIVATE_ROUTES, PUBLIC_ROUTES } from './app-routes';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './lib/auth-context';
import { setCanonical, setRobots } from './lib/seo';
import { UI_TERMS } from './lib/terminology';

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
    <div className="flex min-h-[16rem] items-center justify-center text-ink-muted">
      페이지를 불러오는 중...
    </div>
  );
}

function AppContent() {
  const { authenticated, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isDashboardSection = isAssetJournalPath(location.pathname);
  const navBaseClass = 'px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap';
  const navInactiveClass = 'text-ink-muted hover:text-ink';
  const navActiveClass = 'bg-accent-tint text-accent';
  const createTrackRecordPath = '/login?next=/dashboard';

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const navLinks = (
    <>
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
        {UI_TERMS.publicArchive} 보기
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
        <NavLink
          to="/alerts"
          className={({ isActive }) => `${navBaseClass} ${isActive ? navActiveClass : navInactiveClass}`}
        >
          알림
        </NavLink>
      ) : null}
      {authenticated ? (
        <button
          onClick={() => {
            void logout();
          }}
          className={`${navBaseClass} ${navInactiveClass} text-left`}
        >
          로그아웃
        </button>
      ) : null}
      {!authenticated ? (
        <Link
          to={createTrackRecordPath}
          className="block bg-accent text-accent-contrast px-4 py-2 rounded-md text-sm font-semibold hover:bg-accent-ink whitespace-nowrap text-center"
        >
          나의 {UI_TERMS.trackRecord} 만들기
        </Link>
      ) : null}
    </>
  );

  return (
    <>
      <RouteSeoController />
      <div className="min-h-screen bg-surface-2">
        <nav className="bg-surface shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link to="/" className="text-xl font-semibold text-ink whitespace-nowrap">
                  {UI_TERMS.brandName}
                </Link>
              </div>
              <div className="hidden sm:flex items-center space-x-2 lg:space-x-4">{navLinks}</div>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-label="메뉴 열기"
                className="sm:hidden flex items-center justify-center w-10 h-10 -mr-2 text-ink-muted hover:text-ink"
              >
                {menuOpen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
            {menuOpen && (
              <div className="sm:hidden pb-4 flex flex-col items-stretch space-y-1">{navLinks}</div>
            )}
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
