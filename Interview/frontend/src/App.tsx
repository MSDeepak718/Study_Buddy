import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AdminDashboard from './pages/AdminDashboard';
import InterviewPage from './pages/InterviewPage';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import SessionsPage from './pages/SessionsPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/interview/:sessionId" element={<InterviewPage />} />
          <Route path="/interview" element={<AdminDashboard />} />
          <Route path="/analytics/:sessionId" element={<AnalyticsDashboard />} />
          <Route path="/sessions" element={<SessionsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
