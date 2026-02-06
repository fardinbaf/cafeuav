
import React, { useState, useEffect } from 'react';
import { supabase, db } from '../db';
import { ShoppingCart, Lock, KeyRound, User, Hash } from 'lucide-react';
import { UserRole } from '../App';
import { useNavigate, Link } from 'react-router-dom';

interface LoginProps {
  onLogin: (role: UserRole, uid?: string) => void;
  currentRole: UserRole;
}

const Login: React.FC<LoginProps> = ({ onLogin, currentRole }) => {
  const [loginType, setLoginType] = useState<'admin' | 'customer'>('customer');
  const [password, setPassword] = useState('');
  const [uid, setUid] = useState('');
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'config').single();
      if (data) setSettings(data.value);
    };
    fetchConfig();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await supabase.from('settings').select('value').eq('key', 'config').single();
    const correctPassword = data?.value.adminPassword || 'admin123';

    if (password === correctPassword) {
      onLogin('admin');
      navigate('/');
    } else {
      setError('Incorrect Manager Password');
      setPassword('');
    }
  };

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .eq('uid', uid)
      .single();

    if (data) {
      onLogin('customer', uid);
      navigate('/my-statement');
    } else {
      setError('ID not found');
      setUid('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-[32px] shadow-xl mb-6 overflow-hidden">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <ShoppingCart className="w-10 h-10 text-indigo-600" />
            )}
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter">
            {settings?.canteenName || 'Login Portal'}
          </h1>
        </div>

        <div className="flex bg-white p-1 rounded-2xl border mb-6 shadow-sm">
          <button onClick={() => setLoginType('customer')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase ${loginType === 'customer' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Member</button>
          <button onClick={() => setLoginType('admin')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase ${loginType === 'admin' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Manager</button>
        </div>

        <form onSubmit={loginType === 'admin' ? handleAdminLogin : handleCustomerLogin} className="bg-white p-8 rounded-[40px] border shadow-xl space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              {loginType === 'admin' ? <Lock size={12} /> : <Hash size={12} />}
              {loginType === 'admin' ? 'System Key' : 'Member ID'}
            </label>
            <input 
              type={loginType === 'admin' ? 'password' : 'text'}
              required
              className="w-full px-5 py-4 rounded-2xl bg-slate-800 text-white font-black"
              placeholder={loginType === 'admin' ? '••••••••' : 'e.g. 469000'}
              value={loginType === 'admin' ? password : uid}
              onChange={(e) => loginType === 'admin' ? setPassword(e.target.value) : setUid(e.target.value)}
            />
          </div>
          {error && <div className="text-rose-500 font-black text-[10px] text-center uppercase">{error}</div>}
          <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-[24px] font-black text-lg shadow-xl">LOG IN</button>
        </form>

        <div className="mt-10 flex items-center justify-between text-slate-400 text-[10px] font-black uppercase">
          <Link to="/" className="hover:text-indigo-600">← Back</Link>
          <span className="opacity-40 font-mono">SECURE SYNC</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
