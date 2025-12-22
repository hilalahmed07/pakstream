import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Navbar from './components/Navbar';
import AdminSidebar from './components/admin/AdminSidebar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import UserHomePage from './pages/user/UserHomePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagementPage from './pages/admin/UserManagementPage';
import VideoManagementPage from './pages/admin/VideoManagementPage';
import PresentationManagementPage from './pages/admin/PresentationManagementPage';
import DocumentManagementPage from './pages/admin/DocumentManagementPage';
import PremiereManagementPage from './pages/admin/PremiereManagementPage';
import LivePremiereControlPage from './pages/admin/LivePremiereControlPage';
import DownloadManagementPage from './pages/admin/DownloadManagementPage';
import socketService from './services/socketService';
import './index.css';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  // Check if current route is an admin route
  const isAdminRoute = location.pathname.startsWith('/admin');
  
  // Show sidebar only for admin users on admin routes
  const showAdminSidebar = user?.role === 'admin' && isAdminRoute;
  
  // Show navbar for non-admin users OR for admin users on non-admin routes (like home page)
  const showNavbar = user?.role !== 'admin' || !isAdminRoute;

  React.useEffect(() => {
    // Initialize socket connection once for the entire app
    socketService.connect();
  }, []);

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Show regular navbar for non-admin users or admin users on non-admin routes */}
      {showNavbar && <Navbar />}
      
      {/* Admin Layout with Sidebar - only on admin routes */}
      {showAdminSidebar && <AdminSidebar />}
      
      <main className={showNavbar ? 'flex-1' : ''}>
        <Routes>
          {/* Public/User Routes */}
          <Route path="/" element={<UserHomePage />} />
          
          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requireAdmin>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/videos"
            element={
              <ProtectedRoute requireAdmin>
                <VideoManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/presentations"
            element={
              <ProtectedRoute requireAdmin>
                <PresentationManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/documents"
            element={
              <ProtectedRoute requireAdmin>
                <DocumentManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/premieres"
            element={
              <ProtectedRoute requireAdmin>
                <PremiereManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/premieres/:premiereId/control"
            element={
              <ProtectedRoute requireAdmin>
                <LivePremiereControlPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/downloads"
            element={
              <ProtectedRoute requireAdmin>
                <DownloadManagementPage />
              </ProtectedRoute>
            }
          />
          
          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
