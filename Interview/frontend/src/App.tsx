import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import InterviewPage from './pages/InterviewPage';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import SessionsPage from './pages/SessionsPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes inside Layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Admin Only Routes */}
              <Route element={<ProtectedRoute requiredRole="admin" />}>
                <Route path="/" element={<AdminDashboard />} />
                <Route path="/interview" element={<AdminDashboard />} />
              </Route>

              {/* Shared Protected Routes (Admin + Candidate) */}
              <Route path="/sessions" element={<SessionsPage />} />
              <Route path="/interview/:sessionId" element={<InterviewPage />} />
              <Route path="/analytics/:sessionId" element={<AnalyticsDashboard />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
