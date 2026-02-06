import React, { useState, useEffect } from 'react';
import { supabase } from './db';
import { ShoppingCart, Lock, Hash } from 'lucide-react';
import { UserRole } from './App';
import { useNavigate, Link } from 'react-router-dom';

interface LoginProps {
  onLogin: (role: UserRole, uid?: string) => void;
  currentRole: UserRole;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loginType, setLoginType] = useState<'admin' | 'customer'>('customer');
  const [password, setPassword] = useState('');
  const [uid, setUid] = useState('');
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'config').single().then(({data}) => {
      if (data) setSettings(data.value);
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (loginType === 'admin') {
      if (password === (settings?.adminPassword || 'admin123')) {
        onLogin('admin');
        navigate('/');
      } else setError('Invalid Management Key');
    } else {
      const { data } = await supabase.from('customers').select('*').eq('uid', uid).single();
      if (data) {
        onLogin('customer', uid);
        navigate('/my-statement');
      } else setError('SID not found in database');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 animate-premium">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-28 h-28 bg-white rounded-[40px] shadow-2xl mb-8 border border-white/20">
            {settings?.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-cover p-4" /> : <ShoppingCart className="w-12 h-12 text-indigo-600" />}
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter">{settings?.canteenName || 'Elite Access'}</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] mt-3">Secure Command Node</p>
        </div>

        <div className="flex bg-slate-200/50 p-1.5 rounded-[32px] border border-slate-200 mb-8">
          <button onClick={() => setLoginType('customer')} className={`flex-1 py-4 rounded-[28px] font-black text-[10px] uppercase tracking-widest transition-all ${loginType === 'customer' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500'}`}>Member Portal</button>
          <button onClick={() => setLoginType('admin')} className={`flex-1 py-4 rounded-[28px] font-black text-[10px] uppercase tracking-widest transition-all ${loginType === 'admin' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500'}`}>Manager Hub</button>
        </div>

        <form onSubmit={handleLogin} className="bg-white p-12 rounded-[56px] border border-slate-100 shadow-2xl space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2 ml-1">
              {loginType === 'admin' ? <Lock size={14} /> : <Hash size={14} />}
              {loginType === 'admin' ? 'System Access Key' : 'Service Identifier (SID)'}
            </label>
            <input 
              type={loginType === 'admin' ? 'password' : 'text'}
              required
              className="w-full px-8 py-6 rounded-[32px] bg-slate-900 text-white font-black text-lg focus:ring-4 ring-indigo-500/20 outline-none transition-all placeholder:text-slate-600"
              placeholder={loginType === 'admin' ? '••••••••' : 'e.g. 469000'}
              value={loginType === 'admin' ? password : uid}
              onChange={(e) => loginType === 'admin' ? setPassword(e.target.value) : setUid(e.target.value)}
            />
          </div>
          {error && <p className="text-rose-500 font-black text-[10px] text-center uppercase tracking-widest animate-pulse">{error}</p>}
          <button type="submit" className="w-full bg-indigo-600 text-white py-7 rounded-[32px] font-black text-xl shadow-[0_25px_50px_rgba(79,70,229,0.3)] hover:bg-indigo-700 active:scale-95 transition-all">ESTABLISH SESSION</button>
        </form>

        <div className="mt-12 text-center">
          <Link to="/" className="text-slate-400 hover:text-indigo-600 font-black text-[10px] uppercase tracking-[0.4em] transition-colors">← Exit to Dashboard</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;