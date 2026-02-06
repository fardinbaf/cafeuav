import React, { useState, useEffect } from 'react';
import { db, supabase } from './db';
import { Settings as SettingsType } from './types';
import { Save, Shield, Database, Trash2, User, Phone, KeyRound, Image as ImageIcon, Loader2 } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsType>({
    canteenName: '',
    managerName: '',
    managerPhone: '',
    adminPassword: '',
    logoUrl: '',
    managerImageUrl: ''
  });

  useEffect(() => {
    const load = async () => {
      // First, try to get the most recent config from Supabase
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'config')
        .maybeSingle();

      if (data?.value) {
        setSettings(data.value);
        // Sync local cache
        await db.settings.put({ key: 'config', value: data.value });
      } else {
        // Fallback to local Dexie if Supabase fails/offline
        const localConfig = await db.settings.get('config');
        if (localConfig) setSettings(localConfig.value);
      }
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // 1. Update Supabase (Remote Source of Truth)
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'config', value: settings });

      if (error) throw error;

      // 2. Update Local Dexie (Offline Cache)
      await db.settings.put({ key: 'config', value: settings });
      
      alert('Settings synchronized across cloud and local storage!');
      // Reload to ensure all components (Sidebar/Dashboard) refresh their context
      window.location.reload();
    } catch (err: any) {
      console.error('Settings Sync Error:', err);
      alert('Failed to save settings to cloud: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const clearData = async () => {
    if (confirm('CRITICAL ACTION: This will delete ALL local transactions, customers, and inventory data on this device. Cloud data remains safe.')) {
      await db.transactions.clear();
      await db.customers.clear();
      await db.inventory.clear();
      alert('Local cache cleared.');
    }
  };

  return (
    <div className="max-w-3xl space-y-8 pb-20 animate-premium">
      <div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">System Configuration</h2>
        <p className="text-slate-500 font-medium">Manage your canteen's identity, branding and permissions</p>
      </div>

      <form onSubmit={handleSave} className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-xl space-y-10">
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                <Shield size={16} className="text-indigo-600" />
                Canteen Name
              </label>
              <input 
                required
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-lg font-black bg-slate-800 text-white placeholder:text-slate-500"
                value={settings.canteenName}
                onChange={e => setSettings({...settings, canteenName: e.target.value})}
                placeholder="e.g. Skyline Cafeteria"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                <ImageIcon size={16} className="text-indigo-600" />
                Canteen Logo URL
              </label>
              <input 
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-mono bg-slate-800 text-white placeholder:text-slate-500"
                value={settings.logoUrl}
                onChange={e => setSettings({...settings, logoUrl: e.target.value})}
                placeholder="https://images.unsplash.com/..."
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-50 pt-8">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                <User size={16} className="text-indigo-600" />
                Manager Name
              </label>
              <input 
                required
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-lg font-bold bg-slate-800 text-white placeholder:text-slate-500"
                value={settings.managerName}
                onChange={e => setSettings({...settings, managerName: e.target.value})}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                <ImageIcon size={16} className="text-indigo-600" />
                Manager Photo URL
              </label>
              <input 
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-mono bg-slate-800 text-white placeholder:text-slate-500"
                value={settings.managerImageUrl}
                onChange={e => setSettings({...settings, managerImageUrl: e.target.value})}
                placeholder="https://images.unsplash.com/..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-50 pt-8">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                <Phone size={16} className="text-indigo-600" />
                WhatsApp Phone
              </label>
              <input 
                required
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-lg font-mono font-bold bg-slate-800 text-white placeholder:text-slate-500"
                value={settings.managerPhone}
                onChange={e => setSettings({...settings, managerPhone: e.target.value})}
                placeholder="+8801700000000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                <KeyRound size={16} className="text-indigo-600" />
                Admin Password
              </label>
              <input 
                required
                type="text"
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-lg font-mono font-bold bg-slate-800 text-white placeholder:text-slate-500"
                value={settings.adminPassword}
                onChange={e => setSettings({...settings, adminPassword: e.target.value})}
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>
        
        <button 
          type="submit" 
          disabled={isSaving}
          className="w-full bg-indigo-600 text-white py-6 rounded-[24px] font-black text-lg flex items-center justify-center gap-3 hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-2xl shadow-indigo-600/30 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
          {isSaving ? 'SYNCHRONIZING...' : 'UPDATE SYSTEM CONFIG'}
        </button>
      </form>

      <div className="bg-rose-50/30 p-10 rounded-[40px] border border-rose-100 space-y-6">
        <h3 className="font-black text-xl tracking-tight text-rose-600 flex items-center gap-2">
          <Database size={24} /> Danger Zone
        </h3>
        <p className="text-xs text-rose-400 font-bold uppercase tracking-widest leading-relaxed">Warning: Clearing local database will permanently erase all transaction records and customer history cached on THIS device. Cloud data is safe.</p>
        <button 
          onClick={clearData}
          className="w-full flex items-center justify-center gap-3 text-rose-600 bg-white border-2 border-rose-100 px-8 py-5 rounded-[22px] font-black hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-md active:scale-[0.98]"
        >
          <Trash2 size={20} />
          ERASE LOCAL CACHE
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;