import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './lib/auth-context';
import { setCanonical, setRobots } from './lib/seo';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const GranaryDetail = lazy(() => import('./pages/GranaryDetail'));
const NewGranary = lazy(() => import('./pages/NewGranary'));
const EditGranary = lazy(() => import('./pages/EditGranary'));
const NewSnapshot = lazy(() => import('./pages/NewSnapshot'));
const EditSnapshot = lazy(() => import('./pages/EditSnapshot'));
const JudgmentDiaryList = lazy(() => import('./pages/JudgmentDiaryList'));
const JudgmentDiaryDetail = lazy(() => import('./pages/JudgmentDiaryDetail'));
const NewJudgmentDiary = lazy(() => import('./pages/NewJudgmentDiary'));
const EditJudgmentDiary = lazy(() => import('./pages/EditJudgmentDiary'));
const JudgmentDiaryActionArchive = lazy(() => import('./pages/JudgmentDiaryActionArchive'));
const JudgmentDiaryStrategyArchive = lazy(() => import('./pages/JudgmentDiaryStrategyArchive'));
const JudgmentDiaryPrinciples = lazy(() => import('./pages/JudgmentDiaryPrinciples'));
const JudgmentDiaryReport = lazy(() => import('./pages/JudgmentDiaryReport'));
const PublicPortfolio = lazy(() => import('./pages/PublicPortfolio'));
const LandingIntro = lazy(() => import('./pages/LandingIntro'));
const NewPosition = lazy(() => import('./pages/NewPosition'));
const EditPosition = lazy(() => import('./pages/EditPosition'));
const Login = lazy(() => import('./pages/Login'));
const Consulting = lazy(() => import('./pages/Consulting'));

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
  const isDashboardSection = ['/dashboard', '/granaries', '/snapshots', '/positions', '/accounts']
    .some((prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`));
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
                  곳간 지기
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
              <Route path="/" element={<LandingIntro />} />
              <Route path="/login" element={<Login />} />
              <Route path="/consulting" element={<Consulting />} />

              <Route path="/judgment-diary" element={<JudgmentDiaryList />} />
              <Route path="/judgment-diary/action/:action" element={<JudgmentDiaryActionArchive />} />
              <Route path="/judgment-diary/strategy/:strategy" element={<JudgmentDiaryStrategyArchive />} />
              <Route path="/judgment-diary/principles" element={<JudgmentDiaryPrinciples />} />
              <Route path="/judgment-diary/reports/:month" element={<JudgmentDiaryReport />} />
              <Route path="/judgment-diary/:slug" element={<JudgmentDiaryDetail />} />
              <Route path="/archive" element={<PublicPortfolio />} />

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
