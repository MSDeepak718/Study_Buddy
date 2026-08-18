import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import InterviewPage from './pages/InterviewPage';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import SessionsPage from './pages/SessionsPage';
import TestInvitePage from './pages/TestInvitePage';
import DSATestWorkspacePage from './pages/DSATestWorkspacePage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth & Invite Link Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/test/invite/:inviteCode" element={<TestInvitePage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            {/* Routes wrapped in Admin Layout (with Sidebar) */}
            <Route element={<Layout />}>
              <Route element={<ProtectedRoute requiredRole="admin" />}>
                <Route path="/" element={<AdminDashboard />} />
                <Route path="/interview" element={<AdminDashboard />} />
              </Route>
              <Route path="/sessions" element={<SessionsPage />} />
              <Route path="/analytics/:sessionId" element={<AnalyticsDashboard />} />
            </Route>

            {/* Standalone Full-Screen Assessment Workspaces (NO Sidebar Layout) */}
            <Route path="/interview/:sessionId" element={<InterviewPage />} />
            <Route path="/dsa/workspace/:sessionId" element={<DSATestWorkspacePage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
