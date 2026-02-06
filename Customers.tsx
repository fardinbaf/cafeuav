
// @google/genai Coding Guidelines: This file uses standard React patterns.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './db';
import { parseExcelToCustomers } from './excel';
import { Customer, PaymentType, InventoryItem, TransactionItem } from './types';
import { 
  Search, 
  MessageCircle, 
  UserPlus,
  Trash2,
  X,
  FileText,
  Edit2,
  ShoppingCart,
  Banknote,
  FileSpreadsheet,
  ChevronRight,
  Shield,
  Car,
  PlusCircle,
  Check,
  Zap,
  Loader2,
  ChevronDown,
  AlertTriangle,
  Plus
} from 'lucide-react';
import StatementModal from './StatementModal';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Special Fund State
  const [selectedSpecialType, setSelectedSpecialType] = useState('Unit Fund');
  const [specialAmount, setSpecialAmount] = useState<string>('100');

  const [newCustomer, setNewCustomer] = useState<Omit<Customer, 'id'>>({
    uid: '',
    name: '',
    phone: '+880',
    email: '',
    total_baki: 0
  });

  const fetchAll = async () => {
    const { data: custData, error: cErr } = await supabase.from('customers').select('*').order('name', { ascending: true });
    const { data: invData, error: iErr } = await supabase.from('inventory').select('*');
    if (custData) setCustomers(custData as Customer[]);
    if (invData) setInventory(invData as InventoryItem[]);
    if (cErr || iErr) console.error("Database fetch failed:", cErr || iErr);
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
      item.item_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(itemSearch.toLowerCase())
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
      await fetchAll();
    } catch (err: any) {
      alert("Import failed: " + err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editingCustomer) {
        const { id, ...updateData } = newCustomer as any;
        const { error } = await supabase.from('customers').update(updateData).eq('id', editingCustomer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('customers').insert([newCustomer]);
        if (error) throw error;
      }
      setIsAddingManual(false);
      setEditingCustomer(null);
      setNewCustomer({ uid: '', name: '', phone: '+880', email: '', total_baki: 0 });
      await fetchAll();
    } catch (err: any) {
      alert("Operation failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickChargeConfirm = async () => {
    if (!quickChargeCustomer || tempCart.length === 0) return;
    const total = tempCart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    setIsProcessing(true);

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

      setQuickChargeCustomer(null);
      setTempCart([]);
      await fetchAll(); 
    } catch (err: any) {
      alert("Transaction failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer) return;
    const amount = parseFloat(payAmount);
    
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    setIsProcessing(true);
    try {
      const { error: transError } = await supabase.from('transactions').insert({
        customer_id: paymentCustomer.id,
        total_amount: amount,
        payment_type: payMethod,
        items: [],
        timestamp: Date.now(),
        type: 'payment'
      });
      
      if (transError) throw transError;

      setPaymentCustomer(null);
      setPayAmount('');
      await fetchAll(); 
      alert("Payment recorded successfully.");
    } catch (err: any) {
      alert("Bill settlement failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteCustomer = async (id: number) => {
    const cust = customers.find(c => c.id === id);
    if (!cust) return;

    const confirmMessage = `⚠️ CRITICAL ACTION: Are you sure you want to delete ${cust.name}?
    
    This will PERMANENTLY erase:
    • Member Identity & UID (${cust.uid})
    • All Linked Transaction History
    • Current Baki Balance (৳${cust.total_baki})
    • All Pending Pre-orders
    
    This action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      setDeletingId(id);
      setIsProcessing(true);
      try {
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        
        // Success: Update local state immediately
        setCustomers(prev => prev.filter(c => c.id !== id));
        alert(`${cust.name} has been purged from the system.`);
      } catch (err: any) {
        console.error("Deletion Error:", err);
        alert("System could not delete member. Details: " + (err.message || "Network Error"));
      } finally {
        setDeletingId(null);
        setIsProcessing(false);
      }
    }
  };

  const addSpecialChargeToCart = () => {
    const val = parseFloat(specialAmount);
    if (isNaN(val) || val < 0) {
      alert("Please specify a valid amount.");
      return;
    }
    setTempCart(prev => [...prev, { item_id: Date.now(), item_name: selectedSpecialType, price: val, quantity: 1 }]);
    setSpecialAmount('');
  };

  const contactOnWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  return (
    <div className="space-y-4 lg:space-y-8 pb-20 animate-premium">
      <div className="flex flex-col lg:flex-row justify-between gap-4 px-2 lg:px-0">
        <div>
          <h2 className="text-xl lg:text-3xl font-black text-slate-800 tracking-tight leading-none uppercase">Member Database</h2>
          <p className="text-slate-500 text-[10px] font-medium mt-1 uppercase tracking-widest opacity-60">Identity Management Node</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:gap-3">
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting || isProcessing}
            className="flex-1 sm:flex-none bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-2.5 lg:px-4 lg:py-3.5 rounded-xl font-black text-[9px] lg:text-[10px] flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all shadow-sm uppercase tracking-widest disabled:opacity-50"
          >
            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
            IMPORT
          </button>
          <button onClick={() => { setIsAddingManual(true); setEditingCustomer(null); setNewCustomer({uid:'', name:'', phone:'+880', email:'', total_baki:0}); }} className="flex-1 sm:flex-none bg-indigo-600 text-white px-5 py-2.5 lg:px-6 lg:py-3.5 rounded-xl font-black text-[9px] lg:text-[10px] shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
            <UserPlus size={16} /> NEW MEMBER
          </button>
        </div>
      </div>

      <div className="relative group px-2 lg:px-0">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
        <input 
          type="text" 
          placeholder="Filter SID or Name..."
          className="w-full pl-12 pr-6 py-3.5 lg:py-4 rounded-2xl border border-slate-200 bg-white shadow-sm focus:ring-4 focus:ring-indigo-500/10 outline-none font-medium transition-all text-xs lg:text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6 px-2 lg:px-0">
        {filteredCustomers.map(customer => (
          <div key={customer.id} className="bg-white p-4 lg:p-6 rounded-[32px] lg:rounded-[48px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group border-b-4 lg:border-b-8 hover:border-indigo-600">
             <div className="flex justify-between items-start mb-4 lg:mb-6">
               <div className="flex items-center gap-3 lg:gap-4">
                 <div className="w-10 h-10 lg:w-16 lg:h-16 bg-slate-900 text-white rounded-[16px] lg:rounded-[24px] flex items-center justify-center font-black text-lg lg:text-2xl shadow-xl">
                   {customer.name.charAt(0)}
                 </div>
                 <div className="min-w-0">
                   <div className="flex items-center gap-2">
                     <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-black text-[7px] lg:text-[8px] uppercase tracking-widest whitespace-nowrap">ID #{customer.uid}</span>
                   </div>
                   <h4 className="font-black text-sm lg:text-lg text-slate-800 mt-1 line-clamp-1 tracking-tight uppercase">{customer.name}</h4>
                   <div className="text-[9px] lg:text-[10px] text-slate-400 font-bold">{customer.phone}</div>
                 </div>
               </div>
               <div className="text-right shrink-0">
                 <div className="text-[7px] lg:text-[8px] font-black text-slate-400 uppercase tracking-widest">TOTAL BAKI</div>
                 <div className={`text-base lg:text-xl font-black tracking-tighter ${customer.total_baki > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>৳{customer.total_baki.toLocaleString()}</div>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-2 pb-4">
               <button onClick={() => setQuickChargeCustomer(customer)} className="bg-rose-50 text-rose-600 py-2.5 lg:py-3 rounded-xl font-black text-[8px] lg:text-[9px] uppercase tracking-widest hover:bg-rose-100 transition-colors flex items-center justify-center gap-2">
                 <ShoppingCart size={12} /> Add Baki
               </button>
               <button onClick={() => setPaymentCustomer(customer)} className="bg-emerald-50 text-emerald-600 py-2.5 lg:py-3 rounded-xl font-black text-[8px] lg:text-[9px] uppercase tracking-widest hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2">
                 <Banknote size={12} /> Pay Bill
               </button>
             </div>

             <div className="pt-3 lg:pt-4 border-t border-slate-50 flex items-center justify-between">
                <button onClick={() => setStatementCustomer(customer)} className="text-indigo-600 font-black text-[8px] lg:text-[9px] uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform bg-indigo-50 px-2.5 py-1.5 lg:px-3 lg:py-1.5 rounded-lg">
                  <FileText size={12} /> Statement <ChevronRight size={10} />
                </button>
                <div className="flex gap-1 items-center">
                  <button onClick={() => contactOnWhatsApp(customer.phone)} title="WhatsApp Contact" className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"><MessageCircle size={16} /></button>
                  <button onClick={() => { setEditingCustomer(customer); setNewCustomer(customer); setIsAddingManual(true); }} title="Edit Profile" className="p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 rounded-lg"><Edit2 size={14} /></button>
                  <button 
                    onClick={() => deleteCustomer(customer.id!)} 
                    title="Delete Member" 
                    disabled={isProcessing && deletingId === customer.id}
                    className="p-2 text-slate-300 hover:text-rose-600 transition-colors bg-slate-50 rounded-lg disabled:opacity-50"
                  >
                    {isProcessing && deletingId === customer.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* Forms and Modals remain consistent with previous turn logic for adding/editing/paying */}
      {isAddingManual && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-fade-in">
          <form onSubmit={handleAddManual} className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-8 space-y-6 animate-premium border border-white/20">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter">{editingCustomer ? 'Update Profile' : 'New Member'}</h3>
              <button type="button" onClick={() => { setIsAddingManual(false); setEditingCustomer(null); }} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100"><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <input required placeholder="SID (e.g. 469000)" className="w-full p-4 rounded-2xl bg-slate-900 text-white font-black text-sm outline-none focus:ring-4 ring-indigo-500/20" value={newCustomer.uid} onChange={e => setNewCustomer({...newCustomer, uid: e.target.value})} />
              <input required placeholder="Full Name" className="w-full p-4 rounded-2xl bg-slate-900 text-white font-black text-sm outline-none focus:ring-4 ring-indigo-500/20" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
              <input required placeholder="WhatsApp Phone" className="w-full p-4 rounded-2xl bg-slate-900 text-white font-black text-sm outline-none focus:ring-4 ring-indigo-500/20" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
            </div>
            <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white py-5 rounded-[24px] font-black text-lg shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
              {isProcessing ? 'PROCESSING...' : (editingCustomer ? 'UPDATE MEMBER' : 'SAVE TO SYSTEM')}
            </button>
          </form>
        </div>
      )}

      {quickChargeCustomer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 lg:p-4 bg-slate-900/70 backdrop-blur-xl animate-fade-in">
          <div className="bg-white w-full max-w-6xl rounded-[32px] lg:rounded-[64px] h-[95vh] lg:h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl">
            <div className="flex-1 p-4 lg:p-10 overflow-y-auto bg-slate-50 flex flex-col custom-scrollbar relative">
               <div className="flex justify-between items-center mb-6">
                 <div>
                   <h3 className="text-xl lg:text-3xl font-black text-slate-800 tracking-tighter uppercase">Direct Charge</h3>
                   <p className="text-slate-400 font-bold uppercase text-[8px] lg:text-[9px] tracking-widest">Member: {quickChargeCustomer.name}</p>
                 </div>
                 <button onClick={() => { setQuickChargeCustomer(null); setTempCart([]); }} className="p-3 bg-white rounded-full shadow-sm hover:bg-slate-50 transition-all"><X size={24} /></button>
               </div>

               <div className="bg-white p-4 lg:p-8 rounded-[32px] border border-slate-200 shadow-sm mb-6">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <select 
                        className="w-full bg-slate-100 p-4 rounded-2xl text-xs font-black appearance-none outline-none focus:ring-4 ring-indigo-500/10 cursor-pointer"
                        value={selectedSpecialType}
                        onChange={(e) => {
                          setSelectedSpecialType(e.target.value);
                          if(e.target.value === 'Unit Fund') setSpecialAmount('100');
                          else if(e.target.value === 'Car Wash') setSpecialAmount('50');
                          else setSpecialAmount('');
                        }}
                      >
                        <option value="Unit Fund">Unit Fund (৳100)</option>
                        <option value="Car Wash">Car Wash (৳50)</option>
                        <option value="Others">Others (Custom)</option>
                      </select>
                      <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        placeholder="Amount" 
                        className="flex-1 sm:w-32 bg-slate-100 p-4 rounded-2xl text-xs font-black outline-none focus:ring-4 ring-indigo-500/10"
                        value={specialAmount}
                        onChange={(e) => setSpecialAmount(e.target.value)}
                      />
                      <button onClick={addSpecialChargeToCart} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl shadow-xl active:scale-95 transition-all">
                         <Check size={20} />
                      </button>
                    </div>
                  </div>
               </div>
               
               <div className="relative mb-6">
                 <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input type="text" placeholder="Filter products..." className="w-full pl-12 pr-6 py-4 rounded-[28px] border border-slate-200 bg-white outline-none focus:ring-8 ring-indigo-500/5 font-bold text-sm" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-10">
                 {filteredInventory.map(item => (
                   <button 
                    key={item.id} 
                    onClick={() => setTempCart([...tempCart, { item_id: item.id!, item_name: item.item_name, price: item.price, quantity: 1 }])}
                    className="bg-white p-6 lg:p-8 rounded-[40px] border border-slate-200 flex flex-col justify-between items-start hover:border-indigo-400 hover:shadow-2xl transition-all text-left group min-h-[160px] active:scale-95 shadow-sm border-b-8"
                   >
                     <span className="font-black text-sm lg:text-xl text-slate-800 line-clamp-2 leading-tight uppercase group-hover:text-indigo-600 transition-colors">{item.item_name}</span>
                     <div className="w-full flex justify-between items-end mt-4">
                        <span className="font-black text-indigo-600 text-2xl lg:text-4xl tracking-tighter">৳{item.price}</span>
                        <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          <Plus size={24} />
                        </div>
                     </div>
                   </button>
                 ))}
               </div>
            </div>
            
            <div className="w-full md:w-[380px] p-6 lg:p-10 bg-white border-l border-slate-100 flex flex-col shadow-[-15px_0_30px_rgba(0,0,0,0.02)]">
               <h4 className="text-xl font-black mb-6 flex items-center gap-3 uppercase">
                 <ShoppingCart size={20} className="text-rose-500" /> Current Basket
               </h4>
               <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar max-h-[30vh] md:max-h-none">
                 {tempCart.length ? tempCart.map((it, idx) => (
                   <div key={idx} className="p-4 bg-slate-50 rounded-[24px] font-bold flex justify-between items-center group hover:bg-white hover:shadow-lg transition-all border border-slate-100">
                     <div className="min-w-0 pr-4">
                       <div className="text-[11px] text-slate-800 truncate uppercase tracking-tight">{it.item_name}</div>
                       <div className="text-[9px] text-slate-400 uppercase tracking-widest mt-1">Rate: ৳{it.price}</div>
                     </div>
                     <button onClick={() => setTempCart(prev => prev.filter((_,i) => i !== idx))} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><X size={16} /></button>
                   </div>
                 )) : <div className="h-full flex flex-col items-center justify-center text-slate-300 text-xs gap-3"><ShoppingCart size={48} opacity={0.1} /><p className="italic font-bold uppercase tracking-widest">Basket Empty</p></div>}
               </div>
               <div className="pt-6 border-t mt-6 space-y-4">
                 <div className="flex justify-between items-end">
                   <span className="text-slate-400 font-black uppercase text-[9px] tracking-widest">Total Value</span>
                   <span className="text-4xl lg:text-5xl font-black text-slate-800 tracking-tighter">৳{tempCart.reduce((a,b)=>a+(b.price * b.quantity),0)}</span>
                 </div>
                 <button 
                  onClick={handleQuickChargeConfirm} 
                  disabled={tempCart.length === 0 || isProcessing}
                  className="w-full bg-rose-600 text-white py-5 rounded-[28px] font-black text-lg shadow-2xl hover:bg-rose-700 active:scale-[0.98] disabled:bg-slate-200 transition-all uppercase tracking-widest"
                 >
                   {isProcessing ? 'SYNCING...' : 'CONFIRM BAKI'}
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {paymentCustomer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xl animate-fade-in">
           <div className="bg-white p-10 rounded-[48px] lg:rounded-[64px] w-full max-w-md shadow-2xl animate-premium border border-white/20">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Pay Bill</h3>
                <button onClick={() => { setPaymentCustomer(null); setPayAmount(''); }} className="p-2 bg-slate-50 rounded-full"><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="text-center mb-8 p-6 bg-slate-50 rounded-[32px] shadow-inner">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Outstanding Balance</div>
                <div className="text-4xl font-black text-rose-600 tracking-tighter">৳{paymentCustomer.total_baki.toLocaleString()}</div>
              </div>
              <form onSubmit={handleCollectPayment} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Received Amount</label>
                  <input autoFocus required type="number" placeholder="৳ 0.00" className="w-full p-5 rounded-[24px] bg-slate-900 text-white font-black text-3xl mb-1 outline-none focus:ring-8 ring-emerald-500/10 text-center tracking-tighter" value={payAmount} onChange={e=>setPayAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-1 text-center">Collection Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[PaymentType.CASH, PaymentType.UCB].map(m => (
                      <button type="button" key={m} onClick={() => setPayMethod(m)} className={`py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${payMethod === m ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>{m}</button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={isProcessing || !payAmount} className="w-full bg-emerald-600 text-white py-5 rounded-[24px] font-black text-lg mt-8 shadow-2xl hover:bg-emerald-700 active:scale-[0.98] transition-all uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-3">
                  {isProcessing ? <Loader2 size={24} className="animate-spin" /> : 'RECORD PAYMENT'}
                </button>
              </form>
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
