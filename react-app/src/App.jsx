import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoadingSpinner } from './components/StateDisplays';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { MyRequestsPage } from './pages/MyRequestsPage';
import { MyRoomPage } from './pages/MyRoomPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { RequestExchangePage } from './pages/RequestExchangePage';
import { SwapMatchesPage } from './pages/SwapMatchesPage';
import { WardenQueuePage } from './pages/WardenQueuePage';
function ProtectedRoute({ children, roles, }) {
    const { user, loading } = useAuth();
    if (loading)
        return <LoadingSpinner label="Verifying session..."/>;
    if (!user)
        return <Navigate to="/login" replace/>;
    if (roles && !roles.includes(user.role)) {
        return (<Navigate to={user.role === 'STUDENT' ? '/dashboard' : user.role === 'WARDEN' ? '/warden' : '/admin'} replace/>);
    }
    return <Layout>{children}</Layout>;
}
function DefaultRedirect() {
    const { user, loading } = useAuth();
    if (loading)
        return <LoadingSpinner />;
    if (!user)
        return <Navigate to="/login" replace/>;
    if (user.role === 'ADMIN')
        return <Navigate to="/admin" replace/>;
    if (user.role === 'WARDEN')
        return <Navigate to="/warden" replace/>;
    return <Navigate to="/dashboard" replace/>;
}
export default function App() {
    return (<ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />}/>
              <Route path="/" element={<DefaultRedirect />}/>

              <Route path="/dashboard" element={<ProtectedRoute roles={['STUDENT']}>
                    <DashboardPage />
                  </ProtectedRoute>}/>
              <Route path="/my-room" element={<ProtectedRoute roles={['STUDENT']}>
                    <MyRoomPage />
                  </ProtectedRoute>}/>
              <Route path="/exchange/new" element={<ProtectedRoute roles={['STUDENT']}>
                    <RequestExchangePage />
                  </ProtectedRoute>}/>
              <Route path="/my-requests" element={<ProtectedRoute roles={['STUDENT']}>
                    <MyRequestsPage />
                  </ProtectedRoute>}/>
              <Route path="/swap-matches" element={<ProtectedRoute roles={['STUDENT']}>
                    <SwapMatchesPage />
                  </ProtectedRoute>}/>
              <Route path="/notifications" element={<ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>}/>
              <Route path="/warden" element={<ProtectedRoute roles={['WARDEN', 'ADMIN']}>
                    <WardenQueuePage />
                  </ProtectedRoute>}/>
              <Route path="/admin" element={<ProtectedRoute roles={['ADMIN', 'WARDEN']}>
                    <AdminDashboardPage />
                  </ProtectedRoute>}/>
              <Route path="/audit" element={<ProtectedRoute roles={['ADMIN', 'WARDEN']}>
                    <AuditLogPage />
                  </ProtectedRoute>}/>
              <Route path="*" element={<Navigate to="/" replace/>}/>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>);
}
