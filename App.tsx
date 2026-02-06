
import React, { useEffect, useState, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import Customers from './Customers';
import Inventory from './Inventory';
import Sales from './Sales';
import Reports from './Reports';
import SettingsPage from './Settings';
import Login from './Login';
import MyStatement from './MyStatement';
import { ensureSettings } from './db';

export type UserRole = 'admin' | 'customer' | 'guest';

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [role, setRole] = useState<UserRole>(() => (sessionStorage.getItem('role') as UserRole) || 'guest');
  const [uid, setUid] = useState<string | null>(() => sessionStorage.getItem('uid'));

  useEffect(() => {
    ensureSettings();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogin = (newRole: UserRole, userUid?: string) => {
    setRole(newRole);
    sessionStorage.setItem('role', newRole);
    if (userUid) {
      setUid(userUid);
      sessionStorage.setItem('uid', userUid);
    }
  };

  const handleLogout = () => {
    setRole('guest');
    setUid(null);
    sessionStorage.clear();
  };

  const LoadingFallback = () => (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-indigo-600 font-black text-xs uppercase tracking-widest animate-pulse">Initializing Cafe UAV...</p>
      </div>
    </div>
  );

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-slate-50 selection:bg-indigo-100">
        <Sidebar isOnline={isOnline} role={role} onLogout={handleLogout} />
        <main className="flex-1 lg:ml-64 p-4 lg:p-10 transition-all duration-300">
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard role={role} />} />
              <Route path="/inventory" element={<Inventory isAdmin={role === 'admin'} />} />
              <Route path="/login" element={<Login onLogin={handleLogin} currentRole={role} />} />
              <Route path="/my-statement" element={role === 'customer' ? <MyStatement uid={uid!} /> : <Navigate to="/login" />} />
              <Route path="/customers" element={role === 'admin' ? <Customers /> : <Navigate to="/login" />} />
              <Route path="/sales" element={role === 'admin' ? <Sales /> : <Navigate to="/login" />} />
              <Route path="/reports" element={role === 'admin' ? <Reports /> : <Navigate to="/login" />} />
              <Route path="/settings" element={role === 'admin' ? <SettingsPage /> : <Navigate to="/login" />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
