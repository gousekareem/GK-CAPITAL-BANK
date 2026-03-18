import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import Layout from './components/Layout';
import {
  LoginPage, RegisterPage, ForgotPasswordPage,
  DashboardPage, TransferPage, HistoryPage, InsightsPage,
  BeneficiariesPage, ProfilePage, BNPLPage, AIPage,
  StatementsPage, ScheduledPage, AgentPage,
  AnalyticsPage, CashFlowPage, SessionsPage, KYCPage,
  AdminDashboard,
} from './pages/Pages';

const Private = ({ children }) => {
  const { user } = useAuthStore();
  if (!user || !localStorage.getItem('accessToken')) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

const Public = ({ children }) => {
  const { user } = useAuthStore();
  if (user && localStorage.getItem('accessToken')) return <Navigate to="/dashboard" replace />;
  return children;
};

export default function App() {
  const { refreshUser } = useAuthStore();
  useEffect(() => { if (localStorage.getItem('accessToken')) refreshUser(); }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: { borderRadius: '12px', fontSize: '13px', fontWeight: 500 },
          success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' }, duration: 6000 },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/login"           element={<Public><LoginPage /></Public>} />
        <Route path="/register"        element={<Public><RegisterPage /></Public>} />
        <Route path="/forgot-password" element={<Public><ForgotPasswordPage /></Public>} />

        {/* Private */}
        <Route path="/dashboard"     element={<Private><DashboardPage /></Private>} />
        <Route path="/transfer"      element={<Private><TransferPage /></Private>} />
        <Route path="/history"       element={<Private><HistoryPage /></Private>} />
        <Route path="/insights"      element={<Private><InsightsPage /></Private>} />
        <Route path="/analytics"     element={<Private><AnalyticsPage /></Private>} />
        <Route path="/cashflow"      element={<Private><CashFlowPage /></Private>} />
        <Route path="/agent"         element={<Private><AgentPage /></Private>} />
        <Route path="/beneficiaries" element={<Private><BeneficiariesPage /></Private>} />
        <Route path="/bnpl"          element={<Private><BNPLPage /></Private>} />
        <Route path="/statements"    element={<Private><StatementsPage /></Private>} />
        <Route path="/scheduled"     element={<Private><ScheduledPage /></Private>} />
        <Route path="/kyc"           element={<Private><KYCPage /></Private>} />
        <Route path="/sessions"      element={<Private><SessionsPage /></Private>} />
        <Route path="/ai"            element={<Private><AIPage /></Private>} />
        <Route path="/profile"       element={<Private><ProfilePage /></Private>} />
        <Route path="/admin"         element={<Private><AdminDashboard /></Private>} />

        <Route path="/"  element={<Navigate to="/dashboard" replace />} />
        <Route path="*"  element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
