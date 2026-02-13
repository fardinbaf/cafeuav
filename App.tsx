import React, { useEffect, useState, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import MyStatement from './pages/MyStatement';
import ExpensesPage from './pages/Expenses';
import TutorialsPage from './pages/Tutorials';
import { ensureSettings } from './db';

export type UserRole = 'admin' | 'customer' | 'guest';

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [role, setRole] = useState<UserRole>(() => (sessionStorage.getItem('role') as UserRole) || 'guest');
  const [uid, setUid] = useState<string | null>(() => sessionStorage.getItem('uid'));
  const [footerText, setFooterText] = useState<string>('Cafe UAV Management');

  useEffect(() => {
    const init = async () => {
      const config = await ensureSettings();
      if (config?.footerText) setFooterText(config.footerText);
    };
    init();

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
        <p className="text-indigo-600 font-black text-xs uppercase tracking-widest">Initializing Cafe...</p>
      </div>
    </div>
  );

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-slate-50 selection:bg-indigo-100">
        <Sidebar isOnline={isOnline} role={role} onLogout={handleLogout} />
        <main className="flex-1 lg:ml-64 flex flex-col min-h-screen transition-all duration-300">
          <div className="flex-1 p-4 lg:p-10">
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Dashboard role={role} />} />
                <Route path="/inventory" element={<Inventory role={role} />} />
                <Route path="/login" element={<Login onLogin={handleLogin} currentRole={role} />} />
                <Route path="/my-statement" element={role === 'customer' ? <MyStatement uid={uid!} /> : <Navigate to="/login" />} />
                <Route path="/customers" element={role === 'admin' ? <Customers /> : <Navigate to="/login" />} />
                <Route path="/sales" element={role === 'admin' ? <Sales /> : <Navigate to="/login" />} />
                <Route path="/expenses" element={role === 'admin' ? <ExpensesPage /> : <Navigate to="/login" />} />
                <Route path="/reports" element={role === 'admin' ? <Reports /> : <Navigate to="/login" />} />
                <Route path="/settings" element={role === 'admin' ? <SettingsPage /> : <Navigate to="/login" />} />
                <Route path="/help" element={<TutorialsPage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </div>
          
          <footer className="mt-auto py-8 px-10 border-t border-slate-200 bg-white/50 backdrop-blur-sm text-center">
            <div 
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
              dangerouslySetInnerHTML={{ __html: footerText }}
            />
            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-2">© UAV Elite Canteen Management Application</p>
          </footer>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;