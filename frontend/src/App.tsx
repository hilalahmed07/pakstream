import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import Navbar from './components/Navbar';
import AdminSidebar from './components/admin/AdminSidebar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import UserHomePage from './pages/user/UserHomePage';
import UserManagementPage from './pages/admin/UserManagementPage';
import VideoManagementPage from './pages/admin/VideoManagementPage';
import PresentationManagementPage from './pages/admin/PresentationManagementPage';
import DocumentManagementPage from './pages/admin/DocumentManagementPage';
import PremiereManagementPage from './pages/admin/PremiereManagementPage';
import LivePremiereControlPage from './pages/admin/LivePremiereControlPage';
import DownloadManagementPage from './pages/admin/DownloadManagementPage';
import AnalyticsManagementPage from './pages/admin/AnalyticsManagementPage';
import PatchManagementPage from './pages/admin/PatchManagementPage';
import ConfirmationDialog from './components/common/ConfirmationDialog';
import socketService from './services/socketService';
import { attachGlobalFormValidation } from './utils/globalFormValidation';
import './index.css';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { showError, showWarning } = useNotification();
  const [isSessionExpiredDialogOpen, setIsSessionExpiredDialogOpen] = React.useState(false);

  // Check if current route is an admin route
  const isAdminRoute = location.pathname.startsWith('/admin');

  // Show sidebar only for admin users on admin routes
  const showAdminSidebar = user?.role === 'admin' && isAdminRoute;

  // Show navbar for non-admin users OR for admin users on non-admin routes (like home page)
  const showNavbar = user?.role !== 'admin' || !isAdminRoute;

  React.useEffect(() => {
    // Replace the browser's default form-validation tooltips with consistent,
    // professional English messages derived from each field's label/state.
    return attachGlobalFormValidation();
  }, []);

  React.useEffect(() => {
    // Remove any browser-native "leave/refresh?" confirmation prompt.
    // This can appear if `window.onbeforeunload` gets set by some flow
    // (e.g., upload/processing safety nets). We don't want the browser
    // interrupting the admin with a native dialog.
    window.onbeforeunload = null;
    return () => {
      window.onbeforeunload = null;
    };
  }, []);

  React.useEffect(() => {
    // Initialize socket connection once for the entire app
    socketService.connect();

    // Surface backend socket errors (FORBIDDEN / NOT_FOUND / INVALID_STATE) as toasts
    // so admin control failures are visible instead of silently swallowed.
    const handler = (err: any) => {
      const message = err?.message || 'Socket error';
      showError(message);
    };
    socketService.onError(handler);
    return () => {
      socketService.removeListener('error', handler);
    };
  }, [showError]);

  // Whenever the authenticated user changes (login, logout, switch account),
  // rebuild the socket so the backend handshake uses the latest JWT. Without
  // this, an admin who logs in after the app mounted stays anonymous on the
  // socket and the backend rejects their play/pause/seek emits as FORBIDDEN.
  React.useEffect(() => {
    socketService.reconnectWithCurrentAuth();
  }, [user?._id]);

  React.useEffect(() => {
    const onSessionExpired = () => {
      setIsSessionExpiredDialogOpen(true);
      showWarning('Session expired due to 5 minutes of inactivity.');
    };

    window.addEventListener('session-expired', onSessionExpired);
    return () => {
      window.removeEventListener('session-expired', onSessionExpired);
    };
  }, [showWarning]);

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
            element={<Navigate to="/admin/users" replace />}
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
            path="/admin/patches"
            element={
              <ProtectedRoute requireAdmin>
                <PatchManagementPage />
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
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute requireAdmin>
                <AnalyticsManagementPage />
              </ProtectedRoute>
            }
          />
          
          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      
      {/* Footer */}
      <Footer />

      <ConfirmationDialog
        isOpen={isSessionExpiredDialogOpen}
        title="Session Expired"
        message="You were logged out due to 5 minutes of inactivity. Please sign in again."
        confirmText="OK"
        onConfirm={() => setIsSessionExpiredDialogOpen(false)}
        onCancel={() => setIsSessionExpiredDialogOpen(false)}
        type="warning"
        hideCancel
      />
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
