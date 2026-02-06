
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { 
  LayoutDashboard, Users, Package, ShoppingCart, BarChart3, Settings as SettingsIcon,
  Menu, X, Wifi, WifiOff, MessageCircle, LogOut, LogIn, FileText, User
} from 'lucide-react';
import { UserRole } from './App';

interface SidebarProps {
  isOnline: boolean;
  role: UserRole;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOnline, role, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const config = useLiveQuery(() => db.settings.get('config'));
  const settings = config?.value;

  const adminMenu = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'POS Sales', icon: ShoppingCart, path: '/sales' },
    { name: 'Customer DB', icon: Users, path: '/customers' },
    { name: 'Canteen Menu', icon: Package, path: '/inventory' },
    { name: 'Reports', icon: BarChart3, path: '/reports' },
    { name: 'Settings', icon: SettingsIcon, path: '/settings' },
  ];

  const guestMenu = [
    { name: 'Home', icon: LayoutDashboard, path: '/' },
    { name: 'Canteen Menu', icon: Package, path: '/inventory' },
  ];

  const customerMenu = [
    { name: 'Home', icon: LayoutDashboard, path: '/' },
    { name: 'My Statement', icon: FileText, path: '/my-statement' },
    { name: 'Canteen Menu', icon: Package, path: '/inventory' },
  ];

  const menuItems = role === 'admin' ? adminMenu : (role === 'customer' ? customerMenu : guestMenu);

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-3 bg-indigo-600 text-white rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg overflow-hidden shrink-0">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ShoppingCart className="w-6 h-6" />
              )}
            </div>
            <h1 className="text-lg font-black text-slate-800 leading-tight tracking-tighter">
              {settings?.canteenName || 'Cafe UAV'}
            </h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full w-fit">
            {isOnline ? (
              <><Wifi size={10} className="text-green-500" /> <span className="text-[8px] text-slate-500 font-black uppercase tracking-wider">Cloud Connected</span></>
            ) : (
              <><WifiOff size={10} className="text-rose-500" /> <span className="text-[8px] text-slate-500 font-black uppercase tracking-wider">Offline Cache</span></>
            )}
          </div>
        </div>

        <nav className="mt-2 px-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all group
                  ${isActive 
                    ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}
                `}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'} />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-8 left-0 w-full px-6 space-y-4">
          {role === 'guest' ? (
            <Link to="/login" className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-xs hover:bg-indigo-100 transition-all border border-indigo-100">
              <LogIn size={16} /> PORTAL LOGIN
            </Link>
          ) : (
            <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-4 bg-rose-50 text-rose-600 rounded-2xl font-black text-xs hover:bg-rose-100 transition-all border border-rose-100">
              <LogOut size={16} /> LOGOUT
            </button>
          )}

          <div className="p-4 bg-slate-900 rounded-[28px] text-white shadow-2xl flex items-center gap-3 border border-white/5">
            <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 overflow-hidden bg-slate-800 shrink-0">
              {settings?.managerImageUrl ? (
                <img src={settings.managerImageUrl} alt="Manager" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-indigo-600"><User size={16} /></div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[8px] opacity-40 font-black uppercase tracking-widest truncate">{role} Mode</p>
              <p className="text-xs font-black truncate">{settings?.managerName || 'LAC Zubayer'}</p>
            </div>
          </div>
        </div>
      </div>

      {isOpen && <div className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden backdrop-blur-sm" onClick={() => setIsOpen(false)} />}
    </>
  );
};

export default Sidebar;
