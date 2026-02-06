
import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from './db';
import { Demand, InventoryItem, Customer, Transaction } from './types';
import { Clock, ShoppingCart, Utensils, Zap, Search, User, CreditCard, Loader2, AlertCircle, History, PackageCheck, Ban, Timer, XCircle } from 'lucide-react';

interface MyStatementProps {
  uid: string;
}

const MyStatement: React.FC<MyStatementProps> = ({ uid }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [dailyMenuIds, setDailyMenuIds] = useState<number[]>([]);
  const [myDemands, setMyDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessingDemand, setIsProcessingDemand] = useState<number | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  // 08:00 PM (20) to 12:00 PM (12) Logic
  const now = new Date();
  const currentHour = now.getHours();
  const isOrderingOpen = currentHour >= 20 || currentHour < 12;

  // Window where queue is cleared/locked: 12 PM to 8 PM
  const isPastAutoCancel = currentHour >= 12 && currentHour < 20;

  const fetchData = async () => {
    try {
      const { data: custData } = await supabase.from('customers').select('*').eq('uid', uid).single();
      const { data: menuData } = await supabase.from('settings').select('value').eq('key', 'dailyMenu').maybeSingle();
      const { data: invData } = await supabase.from('inventory').select('*');
      
      if (custData) {
        setCustomer(custData as Customer);
        const { data: transData } = await supabase.from('transactions').select('*').eq('customer_id', custData.id);
        const { data: demData } = await supabase.from('demands').select('*').eq('customer_id', custData.id).order('timestamp', { ascending: false });
        
        let demands = (demData || []) as Demand[];

        // Automated cycle cleanup for Void window
        if (isPastAutoCancel) {
          const pendingToCancel = demands.filter(d => d.status === 'pending');
          if (pendingToCancel.length > 0) {
            await Promise.all(pendingToCancel.map(d => 
              supabase.from('demands').update({ status: 'cancelled' }).eq('id', d.id)
            ));
            const { data: updatedDemData } = await supabase.from('demands').select('*').eq('customer_id', custData.id).order('timestamp', { ascending: false });
            demands = (updatedDemData || []) as Demand[];
          }
        }

        if (transData) setTransactions(transData as Transaction[]);
        setMyDemands(demands);
      }
      
      if (menuData) setDailyMenuIds(menuData.value || []);
      if (invData) setInventory(invData as InventoryItem[]);
    } catch (err) {
      console.error("Statement sync error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [uid]);

  const dailyMenuItems = useMemo(() => {
    return inventory.filter(item => 
      dailyMenuIds.includes(item.id!) && 
      (item.item_name.toLowerCase().includes(productSearchTerm.toLowerCase()) || 
       item.category.toLowerCase().includes(productSearchTerm.toLowerCase()))
    );
  }, [inventory, dailyMenuIds, productSearchTerm]);

  const handlePlaceDemand = async (item: InventoryItem) => {
    if (!customer || !item.id) return;
    if (!isOrderingOpen) {
      alert("Ordering Terminal Offline: Resumes at 08:00 PM sharp.");
      return;
    }
    
    setIsProcessingDemand(item.id);
    try {
      const { data, error } = await supabase.from('demands').insert([{
        customer_id: customer.id!,
        customer_name: customer.name,
        item_id: item.id,
        item_name: item.item_name,
        timestamp: Date.now(),
        status: 'pending'
      }]).select().single();
      if (error) throw error;
      setMyDemands(prev => [data as Demand, ...prev]);
    } catch (err: any) {
      alert("System Sync Error: " + err.message);
    } finally {
      setIsProcessingDemand(null);
    }
  };

  const handleCancelDemand = async (id: number) => {
    if (!confirm("Revoke this pre-order?")) return;
    await supabase.from('demands').update({ status: 'cancelled' }).eq('id', id);
    fetchData();
  };

  const myHistory = useMemo(() => {
    return [...transactions].sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions]);

  if (loading) return <div className="h-[80vh] flex flex-col items-center justify-center gap-4 animate-premium"><Loader2 className="animate-spin text-indigo-600" size={48} /><p className="font-black text-xs uppercase tracking-widest text-slate-400">Authenticating Statement...</p></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-12 animate-premium">
      <header className="bg-white rounded-[48px] border border-slate-200 shadow-2xl overflow-hidden p-8 lg:p-12 flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-8">
            <div className="w-24 h-24 lg:w-32 lg:h-32 bg-slate-900 text-white rounded-[40px] flex items-center justify-center shadow-2xl ring-8 ring-indigo-50"><User size={56} /></div>
            <div className="text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
                <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">MEMBER TERMINAL</span>
                <span className="text-slate-400 font-bold text-xs uppercase">SID #{customer?.uid}</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-black text-slate-800 tracking-tighter leading-none mb-4">Assalamu Alaikum,<br/><span className="text-indigo-600">{customer?.name}</span></h2>
              <div className="flex items-center justify-center lg:justify-start gap-2 text-slate-400 font-bold text-sm"><CreditCard size={14} /> Real-time Audit Synced</div>
            </div>
          </div>
          
          <div className="bg-slate-900 p-8 lg:p-10 rounded-[48px] shadow-2xl min-w-[300px] border-b-8 border-indigo-600">
            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">Liability Assessment</div>
            <div className="text-5xl font-black text-white tracking-tighter mb-2">৳{customer?.total_baki.toLocaleString()}</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Arrears</p>
          </div>
      </header>

      <section className="bg-white p-8 lg:p-10 rounded-[48px] border shadow-xl border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-6">
          <div className="w-full">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3 uppercase"><Utensils className="text-indigo-600" /> Active Service Items</h3>
            <div className="flex items-center gap-3 mt-2">
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${isOrderingOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <Timer size={14} className={isOrderingOpen ? "animate-pulse" : ""} /> {isOrderingOpen ? 'ORDERING ACTIVE' : 'TERMINAL CLOSED'}
              </div>
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">08:00 PM - 12:00 PM</span>
            </div>
          </div>
          <div className="relative w-full sm:w-80"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Filter daily menu..." className="w-full pl-14 pr-6 py-4 rounded-3xl bg-slate-50 border border-slate-100 focus:border-indigo-600 focus:bg-white outline-none font-bold text-sm transition-all" value={productSearchTerm} onChange={e => setProductSearchTerm(e.target.value)} /></div>
        </div>

        {!isOrderingOpen && (
          <div className="mb-8 p-6 bg-rose-50 border border-rose-100 rounded-[32px] flex items-center gap-4 text-rose-600">
            <AlertCircle size={32} /><p className="font-black text-sm uppercase">Pre-ordering cycle has ended. The kitchen is currently processing active requests. Ordering resumes at 08:00 PM tonight.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {dailyMenuItems.map(item => (
            <div key={item.id} className="bg-slate-50 p-6 lg:p-8 rounded-[40px] border border-slate-100 flex justify-between items-center transition-all hover:shadow-2xl hover:bg-white group">
              <div>
                <div className="text-[10px] font-black text-indigo-400 uppercase mb-1">{item.category}</div>
                <div className="text-2xl font-black text-slate-800 tracking-tight uppercase mb-1">{item.item_name}</div>
                <div className="text-indigo-600 font-black text-xl">৳{item.price}</div>
              </div>
              <button 
                onClick={() => handlePlaceDemand(item)} 
                disabled={isProcessingDemand === item.id || !isOrderingOpen}
                className={`p-6 rounded-3xl shadow-xl transition-all active:scale-95 ${isProcessingDemand === item.id || !isOrderingOpen ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                {isProcessingDemand === item.id ? <Loader2 className="animate-spin" size={28} /> : <Zap size={28} fill="currentColor" />}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-[48px] border shadow-2xl border-slate-100 overflow-hidden">
        <div className="p-8 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><History size={22} className="text-indigo-600" /> Cycle Registry</h3>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active + Logged Entries</div>
        </div>
        <div className="divide-y divide-slate-50">
          {/* Active Pre-orders first */}
          {myDemands.filter(d => d.status === 'pending').map(d => (
            <div key={d.id} className="p-8 bg-indigo-50/50 flex items-center justify-between animate-pulse">
               <div className="flex gap-6 items-center">
                 <div className="w-16 h-16 rounded-3xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm"><Loader2 className="animate-spin" /></div>
                 <div><div className="font-black text-xl text-indigo-900 uppercase">PRE-ORDER: {d.item_name}</div><div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Pending Kitchen Approval</div></div>
               </div>
               <button onClick={() => handleCancelDemand(d.id!)} className="p-4 text-slate-400 hover:text-rose-600 hover:bg-white rounded-2xl transition-all shadow-sm"><XCircle size={28} /></button>
            </div>
          ))}
          {/* Historical transactions */}
          {myHistory.map((t) => (
            <div key={t.id} className="p-8 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex gap-6 items-center">
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-inner ${t.type === 'payment' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}><ShoppingCart size={28} /></div>
                <div><div className="font-black text-xl text-slate-800 tracking-tight">{t.type === 'payment' ? 'Debt Settlement' : t.items.map(i => i.item_name).join(', ')}</div><div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{new Date(t.timestamp).toLocaleDateString()} • {t.payment_type}</div></div>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-black tracking-tighter ${t.type === 'payment' ? 'text-emerald-600' : 'text-slate-800'}`}>{t.type === 'payment' ? '-' : ''}৳{t.total_amount.toLocaleString()}</div>
                <div className="text-[10px] opacity-30 font-black uppercase mt-1">UUID #{t.id?.toString().padStart(6, '0')}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default MyStatement;
