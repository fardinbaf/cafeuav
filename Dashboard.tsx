
import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from './db';
import { Customer, Transaction, InventoryItem, Demand, PaymentType } from './types';
import { TrendingUp, Search, MessageCircle, X, Utensils, ChefHat, Timer, User, Check, Plus, AlertCircle, ShoppingCart, ArrowRight, Bell, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';

const Dashboard: React.FC<{ role: string }> = ({ role }) => {
  const [data, setData] = useState<{
    transactions: Transaction[],
    customers: Customer[],
    inventory: InventoryItem[],
    settings: any,
    dailyMenuIds: number[],
    pendingDemands: Demand[]
  } | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<Customer | null>(null);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [menuSearchTerm, setMenuSearchTerm] = useState('');
  const [isProcessingDemand, setIsProcessingDemand] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [trans, cust, inv, conf, menu, demandsRaw] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('inventory').select('*'),
        supabase.from('settings').select('value').eq('key', 'config').maybeSingle(),
        supabase.from('settings').select('value').eq('key', 'dailyMenu').maybeSingle(),
        supabase.from('demands').select('*').eq('status', 'pending').order('timestamp', { ascending: true })
      ]);

      setData({
        transactions: trans.data || [],
        customers: cust.data || [],
        inventory: inv.data || [],
        settings: conf.data?.value,
        dailyMenuIds: menu.data?.value || [],
        pendingDemands: (demandsRaw.data || []) as Demand[]
      });
    } catch (err) {
      console.error("Dashboard refresh error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
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

  const handleApproveDemand = async (demand: Demand) => {
    if (!data) return;
    setIsProcessingDemand(demand.id!);
    try {
      const item = data.inventory.find(i => i.id === demand.item_id);
      if (!item) throw new Error("Item not found");

      // Relying solely on trigger for balance update
      const { error: tError } = await supabase.from('transactions').insert({
        customer_id: demand.customer_id,
        items: [{ item_id: item.id, item_name: item.item_name, price: item.price, quantity: 1 }],
        total_amount: item.price,
        payment_type: PaymentType.BAKI,
        timestamp: Date.now(),
        type: 'sale',
        note: `Approved Pre-order: ${item.item_name}`
      });
      if (tError) throw tError;

      await supabase.from('inventory').update({ stock_quantity: Math.max(0, item.stock_quantity - 1) }).eq('id', item.id);
      await supabase.from('demands').update({ status: 'fulfilled' }).eq('id', demand.id);

      await fetchData();
    } catch (err: any) {
      alert("Error approving pre-order: " + err.message);
    } finally {
      setIsProcessingDemand(null);
    }
  };

  const handleCancelDemand = async (id: number) => {
    if (!confirm("Reject this request?")) return;
    setIsProcessingDemand(id);
    try {
      const { error } = await supabase
        .from('demands')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
      
      await fetchData();
    } catch (err: any) {
      console.error("Cancellation Failed:", err);
      alert("System could not reject request. Error: " + err.message);
    } finally {
      setIsProcessingDemand(null);
    }
  };

  const filteredCurationMenu = useMemo(() => {
    if (!data) return [];
    return data.inventory.filter(item => 
      item.item_name.toLowerCase().includes(menuSearchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(menuSearchTerm.toLowerCase())
    );
  }, [data, menuSearchTerm]);

  if (!data) return <div className="h-screen flex items-center justify-center animate-pulse text-indigo-600 font-black uppercase">Loading Station...</div>;

  return (
    <div className="space-y-8 animate-premium pb-24">
      <header className={`bg-white rounded-[40px] lg:rounded-[48px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col transition-all border-b-8 border-b-indigo-600 ${role === 'admin' ? '' : 'lg:flex-row'}`}>
        <div className={`${role === 'admin' ? 'w-full' : 'lg:w-1/3'} bg-slate-900 p-8 lg:p-12 text-white relative overflow-hidden flex flex-col justify-center items-center text-center`}>
          <Utensils className="absolute -right-16 -bottom-16 opacity-5" size={300} />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 lg:w-28 lg:h-28 rounded-[24px] lg:rounded-[36px] bg-white/10 backdrop-blur-2xl flex items-center justify-center mb-6 border border-white/20 shadow-2xl overflow-hidden">
              <img src={data.settings?.logoUrl} alt="Logo" className="w-full h-full object-contain p-3" />
            </div>
            <h1 className="text-3xl lg:text-5xl font-black tracking-tighter mb-2 uppercase leading-none">{data.settings?.canteenName}</h1>
            <div className="flex items-center gap-2 text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em]">
              <Timer size={14} /> System Node Active
            </div>
            {role === 'admin' && (
              <button onClick={() => setIsMenuModalOpen(true)} className="mt-8 bg-indigo-600 text-white px-10 py-5 rounded-[24px] font-black text-xs flex items-center justify-center gap-3 shadow-2xl hover:bg-indigo-700 transition-all">
                <ChefHat size={20} /> CURATE DAILY MENU
              </button>
            )}
          </div>
        </div>

        {role !== 'admin' && (
          <div className="lg:w-2/3 p-8 lg:p-12 flex flex-col sm:flex-row items-center justify-between gap-8 bg-white">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full border-4 border-slate-50 shadow-xl overflow-hidden">
                <img src={data.settings?.managerImageUrl} className="w-full h-full object-cover" />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-black text-indigo-600 uppercase mb-1">Station Commander</div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{data.settings?.managerName}</h2>
                <div className="text-slate-500 text-xs font-bold mt-1">{data.settings?.managerPhone}</div>
              </div>
            </div>
            <Link to={role === 'customer' ? '/my-statement' : '/login'} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all">
              {role === 'customer' ? 'ORDER NOW' : 'ACCESS PORTAL'}
            </Link>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {role === 'admin' && data.pendingDemands.length > 0 && (
            <section className="bg-indigo-50 p-6 lg:p-10 rounded-[40px] border border-indigo-100 shadow-xl animate-premium">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-indigo-900 flex items-center gap-3 uppercase">
                  <Bell className="text-indigo-600" /> Pending Pre-Orders
                </h3>
              </div>
              <div className="space-y-2">
                {data.pendingDemands.map(demand => (
                  <div key={demand.id} className="bg-white p-4 rounded-[24px] border border-indigo-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm shrink-0">{demand.customer_name.charAt(0)}</div>
                      <div className="min-w-0">
                        <div className="font-black text-slate-800 text-sm truncate uppercase leading-none mb-1">{demand.customer_name}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{demand.item_name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleApproveDemand(demand)} disabled={isProcessingDemand === demand.id} className="bg-emerald-500 text-white p-3 rounded-xl hover:bg-emerald-600 transition-all">
                        {isProcessingDemand === demand.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={20} />}
                      </button>
                      <button onClick={() => handleCancelDemand(demand.id!)} disabled={isProcessingDemand === demand.id} className="p-3 text-slate-300 hover:text-rose-500 transition-all">
                        <XCircle size={24} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-white p-8 lg:p-10 rounded-[40px] border border-slate-100 shadow-xl">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 mb-8"><TrendingUp className="text-indigo-600" /> Performance Matrix</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 800}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 800}} />
                  <Tooltip cursor={{fill: '#f8fafc', radius: 12}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 800}} />
                  <Bar dataKey="total" radius={[12, 12, 0, 0]} fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900 p-10 lg:p-12 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 blur-[60px]" />
            <h3 className="text-xl font-black mb-6 flex items-center gap-4"><Search className="text-indigo-400" /> Account Check</h3>
            <input 
              type="text" placeholder="Enter Member SID..." 
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-5 text-white font-black mb-4 focus:ring-4 ring-indigo-500/20 outline-none text-center tracking-widest"
              value={lookupId} onChange={e => setLookupId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setLookupResult(data.customers.find(c => c.uid === lookupId) || null)}
            />
            <button 
              onClick={() => setLookupResult(data.customers.find(c => c.uid === lookupId) || null)} 
              className="w-full bg-indigo-600 py-5 rounded-2xl font-black text-[10px] tracking-widest uppercase hover:bg-indigo-500 transition-all"
            >
              VALIDATE IDENTITY
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-8 lg:p-10 rounded-[32px] border border-slate-100 shadow-xl border-b-8 border-b-slate-200">
              <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Cycle Billing</div>
              <div className="text-4xl font-black text-slate-800">৳{stats.sales.toLocaleString()}</div>
            </div>
            <div className="bg-rose-50 p-8 lg:p-10 rounded-[32px] border border-rose-100 shadow-xl border-b-8 border-b-rose-200">
              <div className="text-rose-400 text-[10px] font-black uppercase tracking-widest mb-1">Global Baki</div>
              <div className="text-4xl font-black text-rose-600">৳{stats.baki.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {lookupResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[48px] shadow-2xl p-10 text-center relative">
            <button onClick={() => setLookupResult(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 transition-colors"><X size={32} /></button>
            <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-xl border border-indigo-100"><User size={48} /></div>
            <h3 className="text-2xl font-black text-slate-800">{lookupResult.name}</h3>
            <div className="my-8 p-8 bg-slate-900 rounded-[32px] shadow-2xl">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Liability Balance</div>
              <div className="text-6xl font-black text-white tracking-tighter">৳{lookupResult.total_baki.toLocaleString()}</div>
            </div>
            <button onClick={() => setLookupResult(null)} className="w-full bg-indigo-600 text-white py-6 rounded-[28px] font-black tracking-widest uppercase text-xs shadow-xl active:scale-95">CLOSE ACCOUNT VIEW</button>
          </div>
        </div>
      )}

      {isMenuModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[48px] shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-10 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-3xl font-black text-slate-800">Daily Curator</h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Select Active Service items</p>
              </div>
              <button onClick={() => setIsMenuModalOpen(false)} className="text-slate-300 hover:text-slate-600 transition-colors"><X size={32} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 sm:grid-cols-2 gap-4 custom-scrollbar">
              {filteredCurationMenu.map(item => (
                <button 
                  key={item.id}
                  onClick={async () => {
                    const next = data.dailyMenuIds.includes(item.id!) ? data.dailyMenuIds.filter(id => id !== item.id) : [...data.dailyMenuIds, item.id!];
                    await supabase.from('settings').upsert({ key: 'dailyMenu', value: next });
                    setData({ ...data, dailyMenuIds: next });
                  }}
                  className={`p-6 rounded-[32px] border-4 flex items-center justify-between transition-all ${data.dailyMenuIds.includes(item.id!) ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xl' : 'border-slate-50 hover:border-indigo-200'}`}
                >
                  <div className="text-left">
                    <span className="font-black text-lg block leading-tight">{item.item_name}</span>
                    <span className="text-xs font-bold opacity-60">৳{item.price}</span>
                  </div>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${data.dailyMenuIds.includes(item.id!) ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {data.dailyMenuIds.includes(item.id!) ? <Check size={18} /> : <Plus size={18} />}
                  </div>
                </button>
              ))}
            </div>
            <div className="p-10 border-t bg-slate-50/50 flex justify-end">
              <button onClick={() => setIsMenuModalOpen(false)} className="bg-slate-900 text-white px-16 py-5 rounded-[24px] font-black text-xs tracking-widest uppercase shadow-2xl">FINALIZE DAILY MENU</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
