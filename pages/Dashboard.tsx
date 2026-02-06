import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../db';
import { Customer, Transaction, InventoryItem } from '../types';
import { TrendingUp, Search, MessageCircle, X, Utensils, ChefHat, Timer, User, Check, Plus, AlertCircle, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';

const Dashboard: React.FC<{ role: string }> = ({ role }) => {
  const [data, setData] = useState<{
    transactions: Transaction[],
    customers: Customer[],
    inventory: InventoryItem[],
    settings: any,
    dailyMenuIds: number[]
  } | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<Customer | null>(null);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [trans, cust, inv, conf, menu] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('inventory').select('*'),
        supabase.from('settings').select('value').eq('key', 'config').maybeSingle(),
        supabase.from('settings').select('value').eq('key', 'dailyMenu').maybeSingle()
      ]);
      setData({
        transactions: trans.data || [],
        customers: cust.data || [],
        inventory: inv.data || [],
        settings: conf.data?.value,
        dailyMenuIds: menu.data?.value || []
      });
    };
    fetch();
  }, []);

  const stats = useMemo(() => {
    if (!data) return { sales: 0, collections: 0, baki: 0 };
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const mTrans = data.transactions.filter(t => t.timestamp >= monthStart.getTime());
    return {
      sales: mTrans.filter(t => t.type !== 'payment').reduce((a, b) => a + Number(b.total_amount), 0),
      collections: mTrans.filter(t => t.type === 'payment').reduce((a, b) => a + Number(b.total_amount), 0),
      baki: data.customers.reduce((a, b) => a + Number(b.total_baki), 0)
    };
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const start = new Date(d.setHours(0,0,0,0)).getTime();
      const end = new Date(d.setHours(23,59,59,999)).getTime();
      const total = data.transactions
        .filter(t => t.type !== 'payment' && t.timestamp >= start && t.timestamp <= end)
        .reduce((a, b) => a + Number(b.total_amount), 0);
      return { name: d.toLocaleDateString('en-US', { weekday: 'short' }), total };
    });
  }, [data]);

  if (!data) return <div className="h-screen flex items-center justify-center animate-pulse text-indigo-600 font-black tracking-widest uppercase">Initializing Command Center...</div>;

  return (
    <div className="space-y-8 animate-premium pb-24">
      <header className="bg-white rounded-[48px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col lg:flex-row transition-all">
        <div className="lg:w-1/3 bg-slate-900 p-12 text-white relative overflow-hidden flex flex-col justify-center">
          <Utensils className="absolute -right-16 -bottom-16 opacity-5" size={300} />
          <div className="relative z-10">
            <div className="w-24 h-24 rounded-[32px] bg-white/10 backdrop-blur-2xl flex items-center justify-center mb-8 border border-white/20 shadow-2xl overflow-hidden">
              <img src={data.settings?.logoUrl} alt="Logo" className="w-full h-full object-contain p-3" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter mb-2">{data.settings?.canteenName}</h1>
            <div className="flex items-center gap-2 text-indigo-400 font-black text-[10px] uppercase tracking-widest">
              <Timer size={14} /> Elite Management System
            </div>
          </div>
        </div>
        <div className="lg:w-2/3 p-12 flex flex-col md:flex-row items-center justify-between gap-10 bg-white">
          <div className="flex items-center gap-8">
            <div className="w-28 h-28 rounded-full border-8 border-slate-50 shadow-2xl overflow-hidden shrink-0 group">
              <img src={data.settings?.managerImageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            </div>
            <div>
              <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1">Station Commander</div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">{data.settings?.managerName}</h2>
              <div className="flex items-center gap-2 text-slate-500 text-sm font-bold mt-2">
                <MessageCircle size={16} className="text-emerald-500" /> {data.settings?.managerPhone}
              </div>
            </div>
          </div>
          {role === 'admin' && (
            <button onClick={() => setIsMenuModalOpen(true)} className="bg-indigo-600 text-white px-10 py-6 rounded-[28px] font-black text-xs flex items-center gap-3 shadow-2xl hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-indigo-600/30">
              <ChefHat size={20} /> CURATE DAILY SPECIALS
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white p-10 rounded-[56px] border border-slate-100 shadow-xl relative overflow-hidden group">
            <div className="flex justify-between items-center mb-10">
               <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <ShoppingCart className="text-indigo-600" /> Today's Hot Selection
              </h3>
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-rose-50 rounded-full">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">LIVE MENU</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {data.inventory.filter(i => data.dailyMenuIds.includes(i.id!)).map(item => (
                <div key={item.id} className="p-8 rounded-[36px] bg-slate-50 border border-slate-100 flex justify-between items-center group/card hover:bg-white hover:border-indigo-100 hover:shadow-2xl transition-all duration-300">
                  <div>
                    <div className="text-[9px] font-black text-indigo-400 uppercase mb-2 tracking-widest">{item.category}</div>
                    <div className="font-black text-slate-800 text-xl tracking-tight">{item.item_name}</div>
                    <div className="text-indigo-600 font-black text-2xl mt-1">৳{item.price}</div>
                  </div>
                  <div className={`px-4 py-2 rounded-2xl text-[10px] font-black border-2 ${item.stock_quantity > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                    {item.stock_quantity > 0 ? 'AVAILABLE' : 'SOLD OUT'}
                  </div>
                </div>
              ))}
              {data.dailyMenuIds.length === 0 && <div className="col-span-full py-16 text-center text-slate-300 font-bold italic border-2 border-dashed border-slate-100 rounded-[40px]">No specials designated for today.</div>}
            </div>
          </section>

          <section className="bg-white p-12 rounded-[56px] border border-slate-100 shadow-xl">
            <h3 className="text-xl font-black text-slate-800 mb-10 flex items-center gap-3"><TrendingUp className="text-indigo-600" /> Weekly Performance Matrix</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 800}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 800}} />
                  <Tooltip cursor={{fill: '#f8fafc', radius: 12}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px rgba(0,0,0,0.1)', fontWeight: 900, backgroundColor: '#1e293b', color: '#fff'}} itemStyle={{color: '#fff'}} />
                  <Bar dataKey="total" radius={[12, 12, 0, 0]} fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900 p-12 rounded-[56px] text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 blur-[60px]" />
            <h3 className="text-2xl font-black mb-8 flex items-center gap-4"><Search className="text-indigo-400" /> Account Validator</h3>
            <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed opacity-80">Access real-time outstanding balance and account status via Member UID.</p>
            <input 
              type="text" placeholder="Enter SID (e.g. 469000)" 
              className="w-full bg-slate-800 border border-slate-700 rounded-[28px] p-6 text-white font-black mb-6 focus:ring-4 ring-indigo-500/20 outline-none text-center tracking-widest transition-all"
              value={lookupId} onChange={e => setLookupId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setLookupResult(data?.customers.find(c => c.uid === lookupId) || null)}
            />
            <button 
              onClick={() => {
                const res = data?.customers.find(c => c.uid === lookupId);
                if (res) setLookupResult(res);
                else alert("Identifier not found.");
              }} 
              className="w-full bg-indigo-600 py-6 rounded-[28px] font-black text-xs tracking-[0.2em] uppercase shadow-2xl hover:bg-indigo-500 transition-all active:scale-95"
            >
              VALIDATE IDENTITY
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-xl group hover:border-indigo-200 transition-all">
              <div className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Cycle Billing</div>
              <div className="text-5xl font-black text-slate-800 tracking-tighter">৳{stats.sales.toLocaleString()}</div>
            </div>
            <div className="bg-emerald-50 p-10 rounded-[48px] border border-emerald-100 shadow-xl">
              <div className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Liquid Collection</div>
              <div className="text-5xl font-black text-emerald-700 tracking-tighter">৳{stats.collections.toLocaleString()}</div>
            </div>
            <div className="bg-rose-50 p-10 rounded-[48px] border border-rose-100 shadow-xl relative overflow-hidden group">
              <AlertCircle className="absolute -right-4 -top-4 text-rose-100 group-hover:rotate-12 transition-transform" size={100} />
              <div className="text-rose-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Global Arrears</div>
              <div className="text-5xl font-black text-rose-600 tracking-tighter">৳{stats.baki.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {lookupResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[64px] shadow-[0_50px_100px_rgba(0,0,0,0.4)] p-12 text-center relative border border-white/20">
            <button onClick={() => setLookupResult(null)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-600 transition-colors"><X size={32} /></button>
            <div className="w-28 h-28 bg-indigo-50 text-indigo-600 rounded-[40px] flex items-center justify-center mx-auto mb-10 shadow-xl border border-indigo-100">
              <User size={56} />
            </div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tighter">Identity Confirmed</h3>
            <p className="text-xl font-bold text-indigo-600 mt-2">{lookupResult.name}</p>
            <div className="my-10 p-10 bg-slate-900 rounded-[48px] shadow-2xl ring-1 ring-white/10">
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Net Account Value</div>
              <div className="text-7xl font-black text-white tracking-tighter">৳{lookupResult.total_baki.toLocaleString()}</div>
              <div className="mt-6 inline-flex items-center gap-2 text-[10px] font-black text-rose-400 uppercase tracking-widest bg-rose-500/10 px-4 py-2 rounded-full">
                <AlertCircle size={14} /> Outstanding Baki
              </div>
            </div>
            <Link to="/login" className="block w-full bg-indigo-600 text-white py-7 rounded-[32px] font-black tracking-[0.2em] uppercase text-xs shadow-[0_20px_40px_rgba(79,70,229,0.3)] hover:bg-indigo-700 transition-all active:scale-[0.98]">ACCESS PERSONAL PORTAL</Link>
          </div>
        </div>
      )}

      {isMenuModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[64px] shadow-2xl flex flex-col max-h-[85vh] border border-white/20">
            <div className="p-12 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-4xl font-black text-slate-800 tracking-tighter">Menu Curator</h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Select Active Daily Specials</p>
              </div>
              <button onClick={() => setIsMenuModalOpen(false)} className="text-slate-300 hover:text-slate-600 transition-colors"><X size={32} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-12 grid grid-cols-1 sm:grid-cols-2 gap-6 custom-scrollbar">
              {data?.inventory.map(item => (
                <button 
                  key={item.id}
                  onClick={async () => {
                    if (!data) return;
                    const next = data.dailyMenuIds.includes(item.id!) ? data.dailyMenuIds.filter(id => id !== item.id) : [...data.dailyMenuIds, item.id!];
                    await supabase.from('settings').upsert({ key: 'dailyMenu', value: next });
                    setData({ ...data, dailyMenuIds: next });
                  }}
                  className={`p-8 rounded-[40px] border-4 flex items-center justify-between transition-all duration-300 group ${data?.dailyMenuIds.includes(item.id!) ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-2xl' : 'border-slate-50 hover:border-indigo-200 hover:bg-slate-50'}`}
                >
                  <div className="text-left">
                    <span className="font-black text-xl block leading-tight">{item.item_name}</span>
                    <span className="text-sm font-bold opacity-60 mt-1 block">৳{item.price}</span>
                  </div>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${data?.dailyMenuIds.includes(item.id!) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
                    {data?.dailyMenuIds.includes(item.id!) ? <Check size={20} /> : <Plus size={20} />}
                  </div>
                </button>
              ))}
            </div>
            <div className="p-12 border-t bg-slate-50/50 flex justify-end">
              <button onClick={() => setIsMenuModalOpen(false)} className="bg-slate-900 text-white px-16 py-6 rounded-[32px] font-black text-xs tracking-widest uppercase shadow-2xl active:scale-95 transition-all">FINALIZE COMMAND</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;