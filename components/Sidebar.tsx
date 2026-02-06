import React, { useState } from 'react';
// @google/genai Coding Guidelines: Re-importing core router components to address export recognition errors
import { Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Settings as SettingsIcon,
  Menu,
  X,
  Wifi,
  WifiOff,
  MessageCircle,
  LogOut,
  LogIn,
  FileText,
  User
} from 'lucide-react';
import { UserRole } from '../App';

interface SidebarProps {
  isOnline: boolean;
  role: UserRole;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOnline, role, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const settings = useLiveQuery(() => db.settings.get('config'));

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

  const contactManager = () => {
    if (settings?.value?.managerPhone) {
      const phone = settings.value.managerPhone.replace(/\D/g, '');
      window.open(`https://wa.me/${phone}`, '_blank');
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-3 bg-indigo-600 text-white rounded-2xl shadow-xl"
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
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 overflow-hidden shrink-0">
              {settings?.value?.logoUrl ? (
                <img src={settings.value.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ShoppingCart className="w-6 h-6" />
              )}
            </div>
            <h1 className="text-xl font-black text-slate-800 leading-tight tracking-tighter">
              {settings?.value?.canteenName || 'UAV Cafeteria'}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full w-fit">
            {isOnline ? (
              <><Wifi size={12} className="text-green-500" /> <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Live</span></>
            ) : (
              <><WifiOff size={12} className="text-rose-500" /> <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Offline</span></>
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
                  flex items-center gap-3 px-4 py-3 rounded-2xl transition-all
                  ${isActive 
                    ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20 scale-[1.02]' 
                    : 'text-slate-600 hover:bg-slate-50'}
                `}
              >
                <Icon size={18} />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-8 left-0 w-full px-6 space-y-3">
          <button 
            onClick={contactManager}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-xs hover:bg-emerald-100 transition-all border border-emerald-100"
          >
            <MessageCircle size={16} />
            Help Center
          </button>
          
          {role === 'guest' ? (
            <Link 
              to="/login"
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-