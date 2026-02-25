import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import GranaryDetail from './pages/GranaryDetail';
import NewGranary from './pages/NewGranary';
import EditGranary from './pages/EditGranary';
import NewSnapshot from './pages/NewSnapshot';
import EditSnapshot from './pages/EditSnapshot';
import JudgmentDiaryList from './pages/JudgmentDiaryList';
import JudgmentDiaryDetail from './pages/JudgmentDiaryDetail';
import NewJudgmentDiary from './pages/NewJudgmentDiary';
import EditJudgmentDiary from './pages/EditJudgmentDiary';
import JudgmentDiaryActionArchive from './pages/JudgmentDiaryActionArchive';
import JudgmentDiaryStrategyArchive from './pages/JudgmentDiaryStrategyArchive';
import JudgmentDiaryPrinciples from './pages/JudgmentDiaryPrinciples';
import JudgmentDiaryReport from './pages/JudgmentDiaryReport';
import PublicPortfolio from './pages/PublicPortfolio';
import NewPosition from './pages/NewPosition';
import EditPosition from './pages/EditPosition';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './lib/auth-context';
import { setRobots } from './lib/seo';

const PRIVATE_PATH_PREFIXES = ['/dashboard', '/granaries', '/snapshots', '/positions', '/accounts'];

function isPrivatePath(pathname: string): boolean {
  if (PRIVATE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }
  if (pathname === '/judgment-diary/new') return true;
  if (/^\/judgment-diary\/[^/]+\/edit$/.test(pathname)) return true;
  return false;
}

function RouteSeoController() {
  const location = useLocation();

  useEffect(() => {
    const isNoindexPath = isPrivatePath(location.pathname) || location.pathname === '/login';
    setRobots(isNoindexPath ? 'noindex, nofollow' : 'index, follow');
  }, [location.pathname]);

  return null;
}

function RootRoute() {
  const { authenticated, loading } = useAuth();
  if (loading) {
    return <div className="text-gray-600">인증 확인 중...</div>;
  }
  return <Navigate to={authenticated ? '/dashboard' : '/judgment-diary'} replace />;
}

function AppContent() {
  const { authenticated, logout } = useAuth();
  const location = useLocation();
  const isDashboardSection = ['/dashboard', '/granaries', '/snapshots', '/positions', '/accounts']
    .some((prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`));
  const navBaseClass = 'px-3 py-2 rounded-md text-sm font-medium';
  const navInactiveClass = 'text-gray-600 hover:text-gray-900';
  const navActiveClass = 'bg-blue-50 text-blue-700';

  return (
    <>
      <RouteSeoController />
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link to={authenticated ? '/dashboard' : '/judgment-diary'} className="text-xl font-semibold text-gray-900">
                  곳간 지기
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                {authenticated ? (
                  <NavLink
                    to="/dashboard"
                    className={`${navBaseClass} ${isDashboardSection ? navActiveClass : navInactiveClass}`}
                  >
                    대시보드
                  </NavLink>
                ) : null}
                <NavLink
                  to="/judgment-diary"
                  className={({ isActive }) => `${navBaseClass} ${isActive ? navActiveClass : navInactiveClass}`}
                >
                  판단일지
                </NavLink>
                <NavLink
                  to="/public"
                  className={({ isActive }) => `${navBaseClass} ${isActive ? navActiveClass : navInactiveClass}`}
                >
                  공개 아카이브
                </NavLink>
                {authenticated ? (
                  <>
                    <Link
                      to="/granaries/new"
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                    >
                      새 곳간
                    </Link>
                    <button
                      onClick={() => {
                        void logout();
                      }}
                      className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      로그아웃
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    로그인
                  </Link>
                )}
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/login" element={<Login />} />

            <Route path="/judgment-diary" element={<JudgmentDiaryList />} />
            <Route path="/judgment-diary/action/:action" element={<JudgmentDiaryActionArchive />} />
            <Route path="/judgment-diary/strategy/:strategy" element={<JudgmentDiaryStrategyArchive />} />
            <Route path="/judgment-diary/principles" element={<JudgmentDiaryPrinciples />} />
            <Route path="/judgment-diary/reports/:month" element={<JudgmentDiaryReport />} />
            <Route path="/judgment-diary/:slug" element={<JudgmentDiaryDetail />} />
            <Route path="/public" element={<PublicPortfolio />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/granaries/:id" element={<GranaryDetail />} />
              <Route path="/granaries/:id/edit" element={<EditGranary />} />
              <Route path="/granaries/new" element={<NewGranary />} />
              <Route path="/snapshots/new" element={<NewSnapshot />} />
              <Route path="/snapshots/:id/edit" element={<EditSnapshot />} />
              <Route path="/positions/new" element={<NewPosition />} />
              <Route path="/positions/:id/edit" element={<EditPosition />} />
              <Route path="/judgment-diary/new" element={<NewJudgmentDiary />} />
              <Route path="/judgment-diary/:id/edit" element={<EditJudgmentDiary />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
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
