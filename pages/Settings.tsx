import React, { useState, useEffect } from 'react';
import { db, supabase } from '../db';
import { Settings as SettingsType } from '../types';
import { Save, Shield, Database, Trash2, User, Phone, KeyRound, Image as ImageIcon, Loader2, Code } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsType>({
    canteenName: '',
    managerName: '',
    managerPhone: '',
    adminPassword: '',
    logoUrl: '',
    managerImageUrl: '',
    footerText: ''
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'config').maybeSingle();
      if (data?.value) {
        setSettings(data.value);
        await db.settings.put({ key: 'config', value: data.value });
      } else {
        const local = await db.settings.get('config');
        if (local) setSettings(local.value);
      }
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await supabase.from('settings').upsert({ key: 'config', value: settings });
      await db.settings.put({ key: 'config', value: settings });
      alert('Settings synchronized!');
      window.location.reload();
    } catch (err: any) {
      alert('Sync failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const clearData = async () => {
    if (confirm('CRITICAL ACTION: This will delete ALL local transactions, members, and menu cache on this device.')) {
      await db.transactions.clear();
      await db.customers.clear();
      await db.inventory.clear();
      alert('Local database cleared.');
    }
  };

  return (
    <div className="max-w-3xl space-y-8 pb-20 animate-premium">
      <div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">System Configuration</h2>
        <p className="text-slate-500 font-medium text-sm tracking-widest uppercase opacity-60">Identity & Parameters</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-xl space-y-10">
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Canteen Name</label>
                <input required className="w-full px-5 py-4 rounded-2xl border bg-slate-800 text-white font-black" value={settings.canteenName} onChange={e => setSettings({...settings, canteenName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Logo URL</label>
                <input className="w-full px-5 py-4 rounded-2xl border bg-slate-800 text-white text-sm" value={settings.logoUrl} onChange={e => setSettings({...settings, logoUrl: e.target.value})} />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Manager Name</label>
                <input required className="w-full px-5 py-4 rounded-2xl border bg-slate-800 text-white font-bold" value={settings.managerName} onChange={e => setSettings({...settings, managerName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">WhatsApp Phone</label>
                <input required className="w-full px-5 py-4 rounded-2xl border bg-slate-800 text-white font-bold" value={settings.managerPhone} onChange={e => setSettings({...settings, managerPhone: e.target.value})} />
              </div>
            </div>

            <div className="space-y-2 border-t pt-8">
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Admin Password</label>
              <input required type="text" className="w-full px-5 py-4 rounded-2xl border bg-slate-800 text-white font-bold" value={settings.adminPassword} onChange={e => setSettings({...settings, adminPassword: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-xl space-y-6">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase"><Code size={24} className="text-indigo-600" /> Footer Branding</h3>
          <textarea className="w-full px-5 py-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-sm min-h-[120px]" value={settings.footerText} onChange={e => setSettings({...settings, footerText: e.target.value})} placeholder="HTML tags supported..." />
        </div>
        
        <button type="submit" disabled={isSaving} className="w-full bg-indigo-600 text-white py-6 rounded-[32px] font-black text-lg shadow-2xl flex items-center justify-center gap-3 uppercase">
          {isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />} {isSaving ? 'SYNCHRONIZING...' : 'SYNC ALL CHANGES'}
        </button>
      </form>

      <div className="bg-rose-50/30 p-10 rounded-[40px] border border-rose-100 space-y-6">
        <h3 className="font-black text-xl text-rose-600 flex items-center gap-2"><Database size={24} /> Danger Zone</h3>
        <button onClick={clearData} className="w-full flex items-center justify-center gap-3 text-rose-600 bg-white border-2 border-rose-100 px-8 py-5 rounded-[22px] font-black hover:bg-rose-600 hover:text-white transition-all">
          <Trash2 size={20} /> ERASE LOCAL CACHE
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
