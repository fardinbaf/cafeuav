import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../db';
import { parseExcelToCustomers } from '../utils/excel';
import { Customer, PaymentType, InventoryItem, TransactionItem } from '../types';
import { 
  Plus, 
  Search, 
  MessageCircle, 
  UserPlus,
  Trash2,
  X,
  FileText,
  User,
  Edit2,
  ShoppingCart,
  Banknote,
  FileSpreadsheet,
  ChevronRight,
  Shield,
  Car,
  PlusCircle
} from 'lucide-react';
import StatementModal from '../components/StatementModal';

const Customers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [quickChargeCustomer, setQuickChargeCustomer] = useState<Customer | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [tempCart, setTempCart] = useState<TransactionItem[]>([]);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<PaymentType>(PaymentType.CASH);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [newCustomer, setNewCustomer] = useState<Omit<Customer, 'id'>>({
    uid: '',
    name: '',
    phone: '+880',
    email: '',
    total_baki: 0
  });

  const fetchAll = async () => {
    const { data: custData } = await supabase.from('customers').select('*').order('name', { ascending: true });
    const { data: invData } = await supabase.from('inventory').select('*');
    if (custData) setCustomers(custData as Customer[]);
    if (invData) setInventory(invData as InventoryItem[]);
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.uid.includes(searchTerm)
    );
  }, [customers, searchTerm]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => 
      item.item_name.toLowerCase().includes(itemSearch.toLowerCase())
    );
  }, [inventory, itemSearch]);

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const imported = await parseExcelToCustomers(file);
      const { error } = await supabase.from('customers').upsert(imported, { onConflict: 'uid' });
      if (error) throw error;
      alert(`Successfully imported ${imported.length} members.`);
      fetchAll();
    } catch (err) {
      console.error(err);
      alert("Import failed. Ensure UID column exists.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        // Fix 400 error: Omit the 'id' field from the payload
        const { id, ...updatePayload } = newCustomer as any;
        const { error } = await supabase.from('customers').update(updatePayload).eq('id', editingCustomer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('customers').insert([newCustomer]);
        if (error) throw error;
      }
      setIsAddingManual(false);
      setEditingCustomer(null);
      setNewCustomer({ uid: '', name: '', phone: '+880', email: '', total_baki: 0 });
      fetchAll();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleQuickChargeConfirm = async () => {
    if (!quickChargeCustomer || tempCart.length === 0) return;
    const total = tempCart.reduce((acc, i) => acc + (i.price * i.quantity), 0);

    try {
      const { error: transError } = await supabase.from('transactions').insert({
        customer_id: quickChargeCustomer.id,
        items: tempCart,
        total_amount: total,
        payment_type: PaymentType.BAKI,
        timestamp: Date.now(),
        type: 'sale'
      });

      if (transError) throw transError;

      const { error: custError } = await supabase.from('customers').update({ 
        total_baki: Number(quickChargeCustomer.total_baki) + total 
      }).eq('id', quickChargeCustomer.id);

      if (custError) throw custError;

      setQuickChargeCustomer(null);
      setTempCart([]);
      fetchAll();
    } catch (err: any) {
      alert("Failed to record transaction: " + err.message);
    }
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      await supabase.from('transactions').insert({
        customer_id: paymentCustomer.id,
        total_amount: amount,
        payment_type: payMethod,
        timestamp: Date.now(),
        type: 'payment'
      });

      await supabase.from('customers').update({ 
        total_baki: Math.max(0, Number(paymentCustomer.total_baki) - amount) 
      }).eq('id', paymentCustomer.id);

      setPaymentCustomer(null);
      setPayAmount('');
      fetchAll();
    } catch (err: any) {
      alert("Payment settlement failed: " + err.message);
    }
  };

  const addSpecialToQuickCart = (name: string, price: number) => {
    setTempCart(prev => [...prev, { item_id: Date.now(), item_name: name, price: price, quantity: 1 }]);
  };

  const deleteCustomer = async (id: number) => {
    if (confirm("Delete this member and their history?")) {
      await supabase.from('customers').delete().eq('id', id);
      fetchAll();
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-premium">
      <div className="flex flex-col lg:flex-row justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Member Database</h2>
          <p className="text-slate-500 text-sm font-medium">Real-time Management</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex-1 sm:flex-none bg-emerald-50 text-emerald-600 border border-emerald-100 px-5 py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all"
          >
            {isImporting ? <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent animate-spin rounded-full"></div> : <FileSpreadsheet size={18} />}
            IMPORT EXCEL
          </button>
          <button onClick={() => { setIsAddingManual(true); setEditingCustomer(null); setNewCustomer({ uid: '', name: '', phone: '+880', email: '', total_baki: 0 }); }} className="flex-1 sm:flex-none bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
            <UserPlus size={18} /> REGISTER NEW
          </button>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
        <input 
          type="text" 
          placeholder="Search accounts by Name or Unique ID..."
          className="w-full pl-14 pr-4 py-5 rounded-[28px] border border-slate-200 bg-white shadow-sm focus:ring-4 focus:ring-indigo-500/10 outline-none font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => (
          <div key={customer.id} className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
             <div className="flex justify-between items-start mb-6">
               <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-slate-900 text-white rounded-[20px] flex items-center justify-center font-black text-lg">
                   {customer.name.charAt(0)}
                 </div>
                 <div>
                   <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest">ID #{customer.uid}</span>
                   <h4 className="font-black text-lg text-slate-800 mt-1 line-clamp-1">{customer.name}</h4>
                   <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold mt-1">
                     <MessageCircle size={10} className="text-emerald-500" />
                     {customer.phone}
                   </div>
                 </div>
               </div>
               <div className="text-right">
                 <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">BALANCE</div>
                 <div className={`text-xl font-black ${customer.total_baki > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>৳{customer.total_baki.toLocaleString()}</div>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-2 pb-4">
               <button onClick={() => setQuickChargeCustomer(customer)} className="bg-rose-50 text-rose-600 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-colors flex items-center justify-center gap-2">
                 <ShoppingCart size={14} /> Add Baki
               </button>
               <button onClick={() => setPaymentCustomer(customer)} className="bg-emerald-50 text-emerald-600 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2">
                 <Banknote size={14} /> Pay Bill
               </button>
             </div>

             <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                <button 
                  onClick={() => setStatementCustomer(customer)}
                  className="text-indigo-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 hover:translate-x-1 transition-transform"
                >
                  <FileText size={14} /> Full Statement <ChevronRight size={12} />
                </button>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingCustomer(customer); setNewCustomer(customer); setIsAddingManual(true); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={16} /></button>
                  <button onClick={() => deleteCustomer(customer.id!)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={16} /></button>
                </div>
             </div>
          </div>
        ))}
      </div>

      {isAddingManual && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleAddManual} className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-8 space-y-6 animate-premium">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-800">{editingCustomer ? 'Edit Profile' : 'New Member Registration'}</h3>
              <button type="button" onClick={() => { setIsAddingManual(false); setEditingCustomer(null); }} className="p-2"><X size={24} className="text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <input required placeholder="Unique ID (e.g. 469000)" className="w-full p-4 rounded-2xl bg-slate-800 text-white font-bold" value={newCustomer.uid} onChange={e => setNewCustomer({...newCustomer, uid: e.target.value})} />
              <input required placeholder="Full Name" className="w-full p-4 rounded-2xl bg-slate-800 text-white font-bold" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
              <input required placeholder="WhatsApp Phone (+880...)" className="w-full p-4 rounded-2xl bg-slate-800 text-white font-bold" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
              <input type="email" placeholder="Email Address (Optional)" className="w-full p-4 rounded-2xl bg-slate-800 text-white font-bold" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl">{editingCustomer ? 'UPDATE PROFILE' : 'SAVE TO DATABASE'}</button>
          </form>
        </div>
      )}

      {quickChargeCustomer && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white w-full max-w-5xl rounded-[40px] h-[85vh] flex flex-col md:flex-row overflow-hidden shadow-2xl animate-premium">
            <div className="flex-1 p-8 overflow-y-auto bg-slate-50 flex flex-col">
               <div className="flex justify-between items-center mb-6">
                 <div>
                   <h3 className="text-2xl font-black text-slate-800">Direct Baki Charge</h3>
                   <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Adding items to {quickChargeCustomer.name}</p>
                 </div>
                 <button onClick={() => { setQuickChargeCustomer(null); setTempCart([]); }} className="p-2 bg-white rounded-full shadow-sm"><X size={24} /></button>
               </div>

               {/* Special Funds Row for Rapid Access */}
               <div className="grid grid-cols-3 gap-4 mb-8">
                 <button onClick={() => addSpecialToQuickCart('Unit Fund', 100)} className="flex flex-col items-center gap-2 p-4 rounded-[28px] bg-white border border-indigo-100 hover:border-indigo-500 hover:shadow-lg transition-all active:scale-95 group">
                   <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <Shield size={20} />
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">Unit Fund</span>
                 </button>
                 <button onClick={() => addSpecialToQuickCart('Car Wash', 50)} className="flex flex-col items-center gap-2 p-4 rounded-[28px] bg-white border border-emerald-100 hover:border-emerald-500 hover:shadow-lg transition-all active:scale-95 group">
                   <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <Car size={20} />
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">Car Wash</span>
                 </button>
                 <button onClick={() => addSpecialToQuickCart('Others', 0)} className="flex flex-col items-center gap-2 p-4 rounded-[28px] bg-white border border-amber-100 hover:border-amber-500 hover:shadow-lg transition-all active:scale-95 group">
                   <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <PlusCircle size={20} />
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">Others</span>
                 </button>
               </div>
               
               <div className="relative mb-6">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input type="text" placeholder="Search menu..." className="w-full pl-11 pr-4 py-3.5 rounded-2xl border bg-white outline-none focus:ring-4 ring-indigo-500/10" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-2 custom-scrollbar">
                 {filteredInventory.map(item => (
                   <button 
                    key={item.id} 
                    onClick={() => setTempCart([...tempCart, { item_id: item.id!, item_name: item.item_name, price: item.price, quantity: 1 }])}
                    className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-between items-start hover:border-indigo-400 transition-all text-left group h-28"
                   >
                     <span className="font-black text-sm text-slate-800 line-clamp-2">{item.item_name}</span>
                     <span className="font-black text-indigo-600 text-lg">৳{item.price}</span>
                   </button>
                 ))}
               </div>
            </div>
            <div className="w-full md:w-[380px] p-8 bg-white border-l flex flex-col shadow-[-10px_0_20px_rgba(0,0,0,0.02)]">
               <h4 className="text-xl font-black mb-6 flex items-center gap-2">
                 <ShoppingCart size={20} className="text-rose-500" />
                 Pending Charge
               </h4>
               <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                 {tempCart.length ? tempCart.map((it, idx) => (
                   <div key={idx} className="p-4 bg-slate-50 rounded-2xl font-bold flex justify-between items-center group">
                     <div className="min-w-0 pr-2">
                       <div className="text-xs text-slate-800 truncate">{it.item_name}</div>
                       <div className="text-[10px] text-slate-400">Rate: ৳{it.price}</div>
                     </div>
                     <button onClick={() => setTempCart(prev => prev.filter((_,i) => i !== idx))} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={16} /></button>
                   </div>
                 )) : <div className="h-full flex items-center justify-center text-slate-300 text-sm italic">No items selected</div>}
               </div>
               <div className="pt-6 border-t mt-6">
                 <div className="flex justify-between items-end mb-6">
                   <span className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Grand Total</span>
                   <span className="text-4xl font-black text-slate-800 tracking-tighter">৳{tempCart.reduce((a,b)=>a+(b.price * b.quantity),0)}</span>
                 </div>
                 <button 
                  onClick={handleQuickChargeConfirm} 
                  disabled={tempCart.length === 0}
                  className="w-full bg-rose-600 text-white py-5 rounded-[24px] font-black text-lg shadow-xl shadow-rose-600/20 active:scale-[0.98] disabled:bg-slate-200"
                 >
                   CONFIRM BAKI
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {paymentCustomer && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
           <div className="bg-white p-10 rounded-[40px] w-full max-w-md shadow-2xl animate-premium">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-800">Settle Bill</h3>
                <button onClick={() => setPaymentCustomer(null)} className="p-2"><X size={24} className="text-slate-400" /></button>
              </div>
              <div className="text-center mb-8">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Current Baki</div>
                <div className="text-4xl font-black text-rose-600">৳{paymentCustomer.total_baki.toLocaleString()}</div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1">Receive Amount</label>
                  <input type="number" placeholder="৳ 0.00" className="w-full p-5 rounded-2xl bg-slate-800 text-white font-black text-3xl mb-4 outline-none focus:ring-4 ring-emerald-500/20" value={payAmount} onChange={e=>setPayAmount(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1">Collection Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[PaymentType.CASH, PaymentType.UCB].map(m => (
                      <button key={m} onClick={() => setPayMethod(m)} className={`py-4 rounded-xl font-black text-xs transition-all border-2 ${payMethod === m ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>{m}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={handleCollectPayment} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-xl mt-8 shadow-xl shadow-emerald-600/20 active:scale-[0.98]">RECORD SETTLEMENT</button>
           </div>
        </div>
      )}

      {statementCustomer && (
        <StatementModal customer={statementCustomer} onClose={() => setStatementCustomer(null)} />
      )}
    </div>
  );
};

export default Customers;