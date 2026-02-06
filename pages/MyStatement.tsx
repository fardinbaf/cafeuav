
import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../db';
import { PaymentType, Demand, InventoryItem, Customer, Transaction } from '../types';
import { FileText, Clock, ChevronRight, Hash, ArrowDownLeft, ShoppingCart, Utensils, Check, Zap } from 'lucide-react';

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: custData } = await supabase.from('customers').select('*').eq('uid', uid).single();
      const { data: menuData } = await supabase.from('settings').select('value').eq('key', 'dailyMenu').single();
      const { data: invData } = await supabase.from('inventory').select('*');
      
      if (custData) {
        setCustomer(custData as Customer);
        const { data: transData } = await supabase.from('transactions').select('*').eq('customer_id', custData.id);
        const { data: demData } = await supabase.from('demands').select('*').eq('customer_id', custData.id);
        if (transData) setTransactions(transData as Transaction[]);
        if (demData) setMyDemands(demData as Demand[]);
      }
      
      if (menuData) setDailyMenuIds(menuData.value || []);
      if (invData) setInventory(invData as InventoryItem[]);
      setLoading(false);
    };
    fetchData();
  }, [uid]);

  const dailyMenuItems = useMemo(() => {
    return inventory.filter(item => dailyMenuIds.includes(item.id!));
  }, [inventory, dailyMenuIds]);

  const handlePlaceDemand = async (item: InventoryItem) => {
    if (!customer) return;
    const demand = {
      customer_id: customer.id!,
      customer_name: customer.name,
      item_id: item.id!,
      item_name: item.item_name,
      timestamp: Date.now(),
      status: 'pending' as const
    };

    const { data, error } = await supabase.from('demands').insert(demand).select().single();
    if (data) {
      setMyDemands([...myDemands, data as Demand]);
      alert("Pre-order recorded!");
    }
  };

  const myHistory = useMemo(() => {
    return transactions.sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions]);

  if (loading) return <div className="p-20 text-center animate-pulse text-slate-400 font-bold uppercase">Loading...</div>;
  if (!customer) return <div className="p-20 text-center font-bold">Member profile not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter">Assalamu Alaikum, {customer.name}!</h2>
          <p className="text-slate-500 font-medium mt-1">Statement Portal</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border shadow-xl flex items-center gap-6">
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID</div>
            <div className="font-black text-slate-800">{customer.uid}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Balance</div>
            <div className="text-2xl font-black text-rose-600">৳{customer.total_baki.toLocaleString()}</div>
          </div>
        </div>
      </header>

      <section className="bg-white p-8 rounded-[40px] border shadow-xl">
        <h3 className="text-2xl font-black mb-6">Today's Specials</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dailyMenuItems.map(item => (
            <div key={item.id} className="bg-slate-50 p-6 rounded-3xl border flex justify-between items-center">
              <div>
                <div className="text-[10px] font-black text-indigo-400 uppercase">{item.category}</div>
                <div className="text-xl font-black">{item.item_name}</div>
                <div className="font-black text-indigo-600">৳{item.price}</div>
              </div>
              <button onClick={() => handlePlaceDemand(item)} className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg active:scale-95"><Zap size={24} /></button>
            </div>
          ))}
        </div>
      </section>

      <div className="bg-white rounded-[32px] border overflow-hidden shadow-xl">
        <div className="p-6 border-b bg-slate-50/50">
          <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2"><Clock size={18} /> Activity History</h3>
        </div>
        <div className="divide-y">
          {myHistory.map((t) => (
            <div key={t.id} className="p-6 flex items-center justify-between">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500">
                  {t.type === 'payment' ? <ArrowDownLeft size={24} /> : <ShoppingCart size={24} />}
                </div>
                <div>
                  <div className="font-black text-slate-800">{t.type === 'payment' ? 'Bill Settlement' : t.items.map(i => i.item_name).join(', ')}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{new Date(t.timestamp).toLocaleDateString()} • {t.payment_type}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-black ${t.type === 'payment' ? 'text-emerald-600' : 'text-slate-800'}`}>৳{t.total_amount}</div>
                <div className="text-[10px] opacity-30 font-black tracking-widest uppercase">ID #{t.id}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MyStatement;
