import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { RepoListPage } from './pages/RepoListPage';
import { PRListPage } from './pages/PRListPage';
import { PRDetailPage } from './pages/PRDetailPage';

const RootRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400">Loading CodeRefactor AI...</p>
      </div>
    );
  }

  return user ? <RepoListPage /> : <LandingPage />;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400">Loading CodeRefactor AI...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <RepoListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/repos/:repoId/pulls"
                element={
                  <ProtectedRoute>
                    <PRListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pulls/:prId"
                element={
                  <ProtectedRoute>
                    <PRDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
};

export default App;

