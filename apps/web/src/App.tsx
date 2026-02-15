import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
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

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link to="/" className="text-xl font-semibold text-gray-900">
                  곳간 지기
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <Link
                  to="/"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  대시보드
                </Link>
                <Link
                  to="/judgment-diary"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  판단일지
                </Link>
                <Link
                  to="/granaries/new"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  새 곳간
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/granaries/:id" element={<GranaryDetail />} />
            <Route path="/granaries/:id/edit" element={<EditGranary />} />
            <Route path="/granaries/new" element={<NewGranary />} />
            <Route path="/snapshots/new" element={<NewSnapshot />} />
            <Route path="/snapshots/:id/edit" element={<EditSnapshot />} />
            <Route path="/judgment-diary" element={<JudgmentDiaryList />} />
            <Route path="/judgment-diary/new" element={<NewJudgmentDiary />} />
            <Route path="/judgment-diary/:id/edit" element={<EditJudgmentDiary />} />
            <Route path="/judgment-diary/action/:action" element={<JudgmentDiaryActionArchive />} />
            <Route path="/judgment-diary/strategy/:strategy" element={<JudgmentDiaryStrategyArchive />} />
            <Route path="/judgment-diary/principles" element={<JudgmentDiaryPrinciples />} />
            <Route path="/judgment-diary/reports/:month" element={<JudgmentDiaryReport />} />
            <Route path="/judgment-diary/:slug" element={<JudgmentDiaryDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
