
import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../db';
import { Customer, Transaction, InventoryItem, Demand, PaymentType } from '../types.ts';
import { TrendingUp, Search, X, Utensils, ChefHat, Check, Plus, AlertCircle, Loader2, Layers, CheckCircle, XCircle, Clock, ShoppingBag, User } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';

const Dashboard: React.FC<{ role: string }> = ({ role }) => {
  const isAdmin = role === 'admin';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [isActioningDemand, setIsActioningDemand] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

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
        transactions: (trans.data || []) as Transaction[],
        customers: (cust.data || []) as Customer[],
        inventory: (inv.data || []) as InventoryItem[],
        settings: conf.data?.value,
        dailyMenuIds: menu.data?.value || [],
        pendingDemands: (demandsRaw.data || []) as Demand[]
      });
      setCurrentTime(new Date());
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
    
    const totalBaki = data.transactions.reduce((acc, t) => {
      if (t.type === 'sale' && t.payment_type === PaymentType.BAKI) {
        const livePriceSum = t.items.reduce((iSum, item) => {
          const livePrice = data.inventory.find(inv => inv.item_name === item.item_name)?.price ?? item.price;
          return iSum + (livePrice * item.quantity);
        }, 0);
        return acc + livePriceSum;
      }
      if (t.type === 'payment') return acc - Number(t.total_amount);
      return acc;
    }, 0);

    return {
      sales: mTrans.filter(t => t.type !== 'payment').reduce((a, b) => a + Number(b.total_amount), 0),
      collections: mTrans.filter(t => t.type === 'payment').reduce((a, b) => a + Number(b.total_amount), 0),
      baki: totalBaki
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

  const handleToggleMenuItem = async (id: number) => {
    if (!data) return;
    const newMenu = data.dailyMenuIds.includes(id) 
      ? data.dailyMenuIds.filter(mid => mid !== id)
      : [...data.dailyMenuIds, id];
    
    setData({ ...data, dailyMenuIds: newMenu });
    await supabase.from('settings').upsert({ key: 'dailyMenu', value: newMenu });
  };

  const handleApproveDemand = async (demand: Demand) => {
    if (!data) return;
    setIsActioningDemand(demand.id!);
    try {
      const item = data.inventory.find(i => i.id === demand.item_id);
      if (!item) throw new Error("Item not found in inventory");

      // 1. Create Transaction
      const { error: transError } = await supabase.from('transactions').insert({
        customer_id: demand.customer_id,
        items: [{ item_id: item.id, item_name: item.item_name, price: item.price, quantity: 1 }],
        total_amount: item.price,
        payment_type: PaymentType.BAKI,
        timestamp: Date.now(),
        type: 'sale'
      });
      if (transError) throw transError;

      // 2. Mark Demand as Fulfilled
      const { error: demError } = await supabase.from('demands').update({ status: 'fulfilled' }).eq('id', demand.id);
      if (demError) throw demError;

      // 3. Update Stock
      const newQty = Math.max(0, item.stock_quantity - 1);
      await supabase.from('inventory').update({ stock_quantity: newQty }).eq('id', item.id);

      await fetchData();
    } catch (err: any) {
      alert("Fulfillment failed: " + err.message);
    } finally {
      setIsActioningDemand(null);
    }
  };

  const handleCancelDemand = async (demandId: number) => {
    if (!confirm("Reject this order?")) return;
    setIsActioningDemand(demandId);
    try {
      await supabase.from('demands').update({ status: 'cancelled' }).eq('id', demandId);
      await fetchData();
    } catch (err: any) {
      alert("Cancellation failed: " + err.message);
    } finally {
      setIsActioningDemand(null);
    }
  };

  const filteredMenuInventory = useMemo(() => {
    if (!data) return [];
    return data.inventory.filter(i => 
      i.item_name.toLowerCase().includes(menuSearchTerm.toLowerCase()) ||
      i.category.toLowerCase().includes(menuSearchTerm.toLowerCase())
    );
  }, [data, menuSearchTerm]);

  if (!data) return <div className="h-screen flex items-center justify-center animate-pulse text-indigo-600 font-black uppercase tracking-widest">Syncing Cafe...</div>;

  return (
    <div className="space-y-8 animate-premium pb-12">
      <header className={`bg-white rounded-[40px] lg:rounded-[48px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col transition-all border-b-8 border-b-indigo-600 ${isAdmin ? '' : 'lg:flex-row'}`}>
        <div className={`${isAdmin ? 'w-full' : 'lg:w-1/3'} bg-slate-900 p-8 lg:p-12 text-white relative overflow-hidden flex flex-col justify-center items-center text-center`}>
          <Utensils className="absolute -right-16 -bottom-16 opacity-5" size={300} />
          <div className="relative z-10 flex flex-col items-center">
            <Link to="/" className="w-20 h-20 lg:w-28 lg:h-28 rounded-[24px] lg:rounded-[36px] bg-white/10 backdrop-blur-2xl flex items-center justify-center mb-6 border border-white/20 shadow-2xl overflow-hidden hover:opacity-80">
              <img src={data.settings?.logoUrl} alt="Logo" className="w-full h-full object-contain p-3" />
            </Link>
            <h1 className="text-3xl lg:text-5xl font-black tracking-tighter mb-2 uppercase leading-none">{data.settings?.canteenName}</h1>
            <div className="flex items-center gap-2 text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em]">
              🍽️ Eat Good Food, Serve Good!
            </div>
            {isAdmin && (
              <button onClick={() => setIsMenuModalOpen(true)} className="mt-8 bg-indigo-600 text-white px-10 py-5 rounded-[24px] font-black text-xs flex items-center justify-center gap-3 shadow-2xl hover:bg-indigo-700 transition-all uppercase tracking-widest">
                <ChefHat size={20} /> Curate Daily Menu
              </button>
            )}
          </div>
        </div>

        {!isAdmin && (
          <div className="lg:w-2/3 p-8 lg:p-12 flex flex-col sm:flex-row items-center justify-between gap-8 bg-white">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full border-4 border-slate-50 shadow-xl overflow-hidden">
                <img src={data.settings?.managerImageUrl} className="w-full h-full object-cover" />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-black text-indigo-600 uppercase mb-1">Running Manager</div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{data.settings?.managerName}</h2>
                <div className="text-slate-500 text-xs font-bold mt-1">{data.settings?.managerPhone}</div>
              </div>
            </div>
            <Link to={role === 'customer' ? '/my-statement' : '/login'} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all">
              Personal Portal
            </Link>
          </div>
        )}
      </header>

      {isAdmin && data.pendingDemands.length > 0 && (
        <section className="bg-rose-50 p-6 lg:p-10 rounded-[40px] border border-rose-100 shadow-xl mx-2 lg:mx-0">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-rose-800 flex items-center gap-3 uppercase">
              <Clock className="text-rose-600 animate-pulse" /> Pending Pre-orders
            </h3>
            <span className="bg-rose-600 text-white px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest">
              {data.pendingDemands.length} Requests
            </span>
          </div>
          
          {/* CHANGED FROM GRID TO LIST */}
          <div className="space-y-3">
            {data.pendingDemands.map(demand => (
              <div key={demand.id} className="bg-white p-4 md:p-6 rounded-[28px] shadow-sm border border-rose-100 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-rose-400 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black shrink-0 shadow-lg">
                    {demand.customer_name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 uppercase text-sm leading-tight">{demand.item_name}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 rounded-lg">
                        <User size={10} className="text-indigo-600" />
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{demand.customer_name}</span>
                      </div>
                      <span className="text-slate-200 hidden sm:inline">•</span>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg">
                        <Clock size={10} className="text-slate-400" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{new Date(demand.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => handleApproveDemand(demand)}
                    disabled={isActioningDemand === demand.id}
                    className="flex-1 md:flex-none bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10"
                  >
                    {isActioningDemand === demand.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={14} />} 
                    <span className="md:inline">APPROVE</span>
                  </button>
                  <button 
                    onClick={() => handleCancelDemand(demand.id!)}
                    disabled={isActioningDemand === demand.id}
                    className="flex-1 md:flex-none bg-white text-rose-600 border border-rose-100 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isActioningDemand === demand.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={14} />} 
                    <span className="md:inline">REJECT</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white p-6 lg:p-10 rounded-[40px] border border-slate-100 shadow-xl mx-2 lg:mx-0">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 mb-8 uppercase"><TrendingUp className="text-indigo-600" /> Cafe Performance </h3>
            <div className="w-full" style={{ height: 350, minWidth: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 800}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 800}} />
                  <Tooltip cursor={{fill: '#f8fafc', radius: 12}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 800}} />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]} fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="space-y-8 px-2 lg:px-0">
          <div className="bg-slate-900 p-8 lg:p-12 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
            <h3 className="text-xl font-black mb-6 flex items-center gap-4 uppercase"><Search className="text-indigo-400" /> Account Check</h3>
            <input 
              type="text" placeholder="Enter Member SID..." 
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white font-black mb-4 focus:ring-4 ring-indigo-500/20 outline-none text-center tracking-widest uppercase text-sm"
              value={lookupId} onChange={e => setLookupId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setLookupResult(data.customers.find(c => c.uid === lookupId) || null)}
            />
            <button 
              onClick={() => setLookupResult(data.customers.find(c => c.uid === lookupId) || null)} 
              className="w-full bg-indigo-600 py-5 rounded-2xl font-black text-[10px] tracking-widest uppercase hover:bg-indigo-50 transition-all shadow-xl active:scale-95"
            >
              VALIDATE IDENTITY
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="bg-white p-6 lg:p-10 rounded-[32px] border border-slate-100 shadow-xl border-b-8 border-b-slate-200">
              <div className="text-slate-400 text-[8px] lg:text-[10px] font-black uppercase tracking-widest mb-1">Cycle Sales</div>
              <div className="text-xl lg:text-4xl font-black text-slate-800">৳{stats.sales.toLocaleString()}</div>
            </div>
            <div className="bg-rose-50 p-6 lg:p-10 rounded-[32px] border border-rose-100 shadow-xl border-b-8 border-b-rose-200">
              <div className="text-rose-400 text-[8px] lg:text-[10px] font-black uppercase tracking-widest mb-1">Global Debt</div>
              <div className="text-xl lg:text-4xl font-black text-rose-600">৳{stats.baki.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {isMenuModalOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-fade-in overflow-hidden">
          <div className="bg-white w-full max-w-2xl rounded-[48px] shadow-2xl p-8 lg:p-12 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-8 shrink-0">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                <ChefHat className="text-indigo-600" /> Curate Daily Menu
              </h3>
              <button onClick={() => setIsMenuModalOpen(false)} className="p-3 bg-slate-100 rounded-full hover:bg-rose-50 hover:text-rose-500 transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="relative mb-6 shrink-0">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search catalog..." 
                className="w-full pl-14 pr-6 py-4 rounded-[28px] border border-slate-200 bg-slate-50 outline-none font-bold text-sm focus:bg-white transition-all"
                value={menuSearchTerm}
                onChange={e => setMenuSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 pb-6">
              {filteredMenuInventory.map(item => {
                const isSelected = data.dailyMenuIds.includes(item.id!);
                return (
                  <button 
                    key={item.id}
                    onClick={() => handleToggleMenuItem(item.id!)}
                    className={`w-full p-5 rounded-3xl border-2 transition-all flex items-center justify-between group ${isSelected ? 'border-indigo-600 bg-indigo-50 shadow-lg' : 'border-slate-100 bg-white hover:border-indigo-200'}`}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                        <Layers size={22} />
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category}</div>
                        <div className="font-black text-slate-800 uppercase tracking-tight">{item.item_name}</div>
                      </div>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      {isSelected ? <Check size={18} /> : <Plus size={18} />}
                    </div>
                  </button>
                );
              })}
            </div>

            <button onClick={() => setIsMenuModalOpen(false)} className="mt-8 bg-slate-900 text-white py-5 rounded-[28px] font-black text-sm tracking-widest uppercase shadow-2xl hover:bg-black transition-all">
              Save Selection
            </button>
          </div>
        </div>,
        document.body
      )}

      {lookupResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[48px] shadow-2xl p-8 lg:p-10 text-center relative">
            <button onClick={() => setLookupResult(null)} className="absolute top-6 right-6 lg:top-8 lg:right-8 text-slate-300 hover:text-slate-600 transition-colors"><X size={28} /></button>
            <div className="w-20 h-20 lg:w-24 lg:h-24 bg-indigo-50 text-indigo-600 rounded-[32px] flex items-center justify-center mx-auto mb-6 lg:mb-8 shadow-xl border border-indigo-100 font-black">{lookupResult.name.charAt(0)}</div>
            <h3 className="text-xl lg:text-2xl font-black text-slate-800 uppercase">{lookupResult.name}</h3>
            <div className="my-6 lg:my-8 p-6 lg:p-8 bg-slate-900 rounded-[32px] shadow-2xl">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Liability Balance</div>
              <div className="text-4xl lg:text-6xl font-black text-white tracking-tighter">৳{lookupResult.total_baki.toLocaleString()}</div>
            </div>
            <button onClick={() => setLookupResult(null)} className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black tracking-widest uppercase text-xs shadow-xl active:scale-95">CLOSE VIEW</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
