
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../db';
import { parseExcelToCustomers } from '../utils/excel';
import { Customer, PaymentType, InventoryItem, TransactionItem, Transaction } from '../types';
import { 
  Search, 
  UserPlus,
  Trash2,
  X,
  FileText,
  Edit2,
  ShoppingCart,
  Banknote,
  FileSpreadsheet,
  ChevronRight,
  Loader2,
  ChevronDown,
  Plus,
  Minus,
  XCircle,
  ShoppingBag,
  Layers,
  Zap,
  Phone
} from 'lucide-react';
import StatementModal from '../components/StatementModal';

const Customers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
    const { data: custData } = await supabase.from('customers').select('*').order('name', { ascending: true });
    const { data: transData } = await supabase.from('transactions').select('*');
    const { data: invData } = await supabase.from('inventory').select('*');
    
    if (custData) setCustomers(custData as Customer[]);
    if (transData) setTransactions(transData as Transaction[]);
    if (invData) setInventory(invData as InventoryItem[]);
  };

  useEffect(() => { fetchAll(); }, []);

  const customerBalances = useMemo(() => {
    const balances: Record<number, number> = {};
    customers.forEach(c => {
      const custTrans = transactions.filter(t => t.customer_id === c.id);
      
      const salesTotal = custTrans
        .filter(t => t.type === 'sale' && t.payment_type === PaymentType.BAKI)
        .reduce((sum, t) => {
          const itemsTotal = t.items.reduce((iSum, item) => {
            const currentPrice = inventory.find(inv => inv.item_name === item.item_name)?.price ?? item.price;
            return iSum + (currentPrice * item.quantity);
          }, 0);
          return sum + itemsTotal;
        }, 0);

      const paymentsTotal = custTrans
        .filter(t => t.type === 'payment')
        .reduce((sum, t) => sum + Number(t.total_amount), 0);

      balances[c.id!] = salesTotal - paymentsTotal;
    });
    return balances;
  }, [customers, transactions, inventory]);

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

  const addToCart = (item: any) => {
    setTempCart(prev => {
      const existingIndex = prev.findIndex(i => i.item_name === item.item_name && i.price === item.price);
      if (existingIndex > -1) {
        const newCart = [...prev];
        newCart[existingIndex] = { ...newCart[existingIndex], quantity: newCart[existingIndex].quantity + 1 };
        return newCart;
      }
      return [...prev, { item_id: item.id || Date.now(), item_name: item.item_name, price: item.price, quantity: 1 }];
    });
  };

  const updateQuantity = (name: string, price: number, delta: number) => {
    setTempCart(prev => prev.map(item => {
      if (item.item_name === name && item.price === price) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

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
    if (!quickChargeCustomer || tempCart.length === 0 || isProcessing) return;
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

      const stockUpdates = tempCart.map(async (item) => {
        const invItem = inventory.find(i => i.id === item.item_id);
        if (invItem) {
          const newQty = Math.max(0, invItem.stock_quantity - item.quantity);
          return supabase.from('inventory').update({ stock_quantity: newQty }).eq('id', item.item_id);
        }
      });
      await Promise.all(stockUpdates);

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
    if (isNaN(amount) || amount <= 0) return;

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
    } catch (err: any) {
      alert("Bill settlement failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteCustomer = async (id: number) => {
    if (confirm("⚠️ This will permanently delete this member. Proceed?")) {
      setDeletingId(id);
      setIsProcessing(true);
      try {
        await supabase.from('customers').delete().eq('id', id);
        setCustomers(prev => prev.filter(c => c.id !== id));
      } catch (err: any) {
        alert("Deletion failed: " + err.message);
      } finally {
        setDeletingId(null);
        setIsProcessing(false);
      }
    }
  };

  const addSpecialChargeToCart = () => {
    const val = parseFloat(specialAmount);
    if (isNaN(val)) return;
    addToCart({ id: null, item_name: selectedSpecialType, price: val });
    setSpecialAmount('');
  };

  const cartTotal = useMemo(() => tempCart.reduce((a, b) => a + (b.price * b.quantity), 0), [tempCart]);

  return (
    <div className="space-y-4 lg:space-y-8 pb-20 animate-premium">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between gap-4 px-2 lg:px-0">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">Member Database</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest opacity-60">Identity Management Node</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting || isProcessing}
            className="flex-1 sm:flex-none bg-emerald-50 text-emerald-600 border border-emerald-100 px-4 py-3 rounded-xl font-black text-[10px] flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all uppercase"
          >
            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
            IMPORT
          </button>
          <button onClick={() => { setIsAddingManual(true); setEditingCustomer(null); setNewCustomer({uid:'', name:'', phone:'+880', email:'', total_baki:0}); }} className="flex-1 sm:flex-none bg-indigo-600 text-white px-5 py-3 rounded-xl font-black text-[10px] shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 uppercase">
            <UserPlus size={16} /> NEW MEMBER
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative group px-2 lg:px-0">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
        <input 
          type="text" 
          placeholder="Filter SID or Name..."
          className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-200 bg-white shadow-sm focus:ring-4 focus:ring-indigo-500/10 outline-none font-medium transition-all text-xs"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-2 lg:px-0">
        {filteredCustomers.map(customer => {
          const calculatedBalance = customerBalances[customer.id!] || 0;
          return (
            <div key={customer.id} className="bg-white p-6 rounded-[32px] lg:rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group border-b-8 hover:border-indigo-600">
               <div className="flex justify-between items-start mb-6">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 lg:w-16 lg:h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-lg">
                     {customer.name.charAt(0)}
                   </div>
                   <div className="min-w-0">
                     <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-black text-[7px] lg:text-[8px] uppercase tracking-widest whitespace-nowrap">ID #{customer.uid}</span>
                     <h4 className="font-black text-sm lg:text-lg text-slate-800 mt-1 line-clamp-1 uppercase tracking-tight">{customer.name}</h4>
                   </div>
                 </div>
                 <div className="text-right">
                   <div className="text-[7px] lg:text-[8px] font-black text-slate-400 uppercase tracking-widest">TOTAL BAKI</div>
                   <div className={`text-base lg:text-xl font-black ${calculatedBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>৳{calculatedBalance.toLocaleString()}</div>
                 </div>
               </div>

               <div className="space-y-2 pb-4">
                 <div className="grid grid-cols-2 gap-2">
                   {/* REDDISH STYLE ADD BAKI BUTTON */}
                   <button onClick={() => setQuickChargeCustomer(customer)} className="bg-rose-50 text-rose-600 border border-rose-100 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5">
                     <ShoppingCart size={14} /> Add Baki
                   </button>
                   <button onClick={() => setPaymentCustomer(customer)} className="bg-emerald-50 text-emerald-600 border border-emerald-100 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5">
                     <Banknote size={14} /> Pay Bill
                   </button>
                 </div>
               </div>

               <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <button onClick={() => setStatementCustomer(customer)} className="text-indigo-600 font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5 hover:translate-x-1 transition-transform bg-indigo-50 px-3 py-2 rounded-lg">
                    <FileText size={16} /> Statement <ChevronRight size={12} />
                  </button>
                  <div className="flex gap-1 items-center">
                    {/* WHATSAPP CALL ICON BEFORE EDIT */}
                    <a href={`tel:${customer.phone}`} className="p-2 text-slate-400 hover:text-emerald-500 transition-colors" title="Call Member">
                      <Phone size={18} />
                    </a>
                    <button onClick={() => { setEditingCustomer(customer); setNewCustomer(customer); setIsAddingManual(true); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={18} /></button>
                    <button onClick={() => deleteCustomer(customer.id!)} disabled={isProcessing && deletingId === customer.id} className="p-2 text-slate-300 hover:text-rose-600 transition-colors disabled:opacity-50">
                      {isProcessing && deletingId === customer.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    </button>
                  </div>
               </div>
            </div>
          );
        })}
      </div>

      {/* Manual Add Modal */}
      {isAddingManual && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-fade-in">
          <form onSubmit={handleAddManual} className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-8 space-y-6 animate-premium border border-white/20">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{editingCustomer ? 'Update Profile' : 'New Member'}</h3>
              <button type="button" onClick={() => { setIsAddingManual(false); setEditingCustomer(null); }} className="p-2.5 bg-slate-50 rounded-full hover:bg-slate-100"><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 block">Serial ID</label>
                <input required placeholder="e.g. 469000" className="w-full p-4.5 rounded-2xl bg-slate-900 text-white font-black text-sm outline-none" value={newCustomer.uid} onChange={e => setNewCustomer({...newCustomer, uid: e.target.value})} />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 block">Member Name</label>
                <input required placeholder="Full Name" className="w-full p-4.5 rounded-2xl bg-slate-900 text-white font-black text-sm outline-none" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 block">WhatsApp Mobile</label>
                <input required placeholder="+8801..." className="w-full p-4.5 rounded-2xl bg-slate-900 text-white font-black text-sm outline-none" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
              </div>
            </div>
            <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white py-5 rounded-[24px] font-black text-base shadow-xl uppercase tracking-widest active:scale-95 transition-all">
              {isProcessing ? <Loader2 className="animate-spin" /> : (editingCustomer ? 'UPDATE PROFILE' : 'SAVE TO SYSTEM')}
            </button>
          </form>
        </div>,
        document.body
      )}

      {/* DIRECT CHARGE MODAL - Portalled and Centered */}
      {quickChargeCustomer && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 lg:p-4 bg-slate-900/80 backdrop-blur-2xl animate-fade-in overflow-hidden">
          <div className="bg-white w-full lg:max-w-5xl h-full lg:h-auto lg:max-h-[90vh] lg:rounded-[48px] overflow-hidden shadow-2xl flex flex-col border border-white/20">
            
            {/* Top Bar - Sticky */}
            <div className="p-4 lg:p-6 border-b bg-white flex justify-between items-center shrink-0 sticky top-0 z-50">
               <div>
                 <h3 className="text-lg lg:text-2xl font-black text-slate-800 uppercase leading-none tracking-tight">Direct Charge</h3>
                 <p className="text-indigo-600 font-bold text-[10px] uppercase tracking-widest mt-1">Member: {quickChargeCustomer.uid} | {quickChargeCustomer.name}</p>
               </div>
               <button onClick={() => { setQuickChargeCustomer(null); setTempCart([]); }} className="p-2.5 bg-slate-100 text-slate-400 rounded-full hover:bg-rose-50 hover:text-rose-500 transition-all">
                  <X size={20} />
               </button>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
              
              {/* Catalog Section */}
              <div className="flex-1 flex flex-col bg-slate-50 lg:w-[55%] border-b lg:border-b-0 lg:border-r border-slate-100 overflow-hidden">
                <div className="p-4 lg:p-6 space-y-3 bg-slate-50/50 shrink-0">
                  <div className="flex flex-row gap-2 items-stretch h-11 lg:h-12">
                    <div className="flex-[3] relative min-w-0">
                      <select 
                        className="w-full h-full bg-white px-3 rounded-xl text-[10px] lg:text-xs font-black appearance-none outline-none border border-slate-200 shadow-sm pr-8"
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
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <input type="number" placeholder="৳" className="w-16 lg:w-24 bg-white px-2 rounded-xl text-xs font-black outline-none border border-slate-200 shadow-sm" value={specialAmount} onChange={(e) => setSpecialAmount(e.target.value)} />
                    <button onClick={addSpecialChargeToCart} className="bg-indigo-600 text-white px-4 lg:px-6 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center shrink-0">
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Filter items..." className="w-full pl-12 pr-6 py-3.5 rounded-xl border border-slate-200 bg-white outline-none font-bold text-xs" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
                  </div>
                </div>

                <div className="flex-1 px-4 lg:px-6 pb-8 space-y-2 overflow-y-auto custom-scrollbar">
                  {filteredInventory.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => addToCart(item)}
                      className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-indigo-500 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                          <Layers size={18} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-xs lg:text-sm text-slate-800 uppercase tracking-tight truncate leading-tight">{item.item_name}</h4>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.category}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm lg:text-base font-black text-indigo-600">৳{item.price}</span>
                        <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg group-hover:scale-110 transition-transform">
                          <Plus size={14} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Basket Section */}
              <div className="lg:w-[45%] flex flex-col bg-white border-t lg:border-t-0 border-slate-100 overflow-hidden relative">
                <div className="p-4 lg:p-6 border-b bg-white flex justify-between items-center shrink-0">
                  <h4 className="text-sm lg:text-base font-black flex items-center gap-2 uppercase">
                    <ShoppingBag size={18} className="text-rose-500" /> Member Basket
                    <span className="bg-rose-50 text-rose-600 px-2.5 py-1 rounded-lg text-[10px] font-black">{tempCart.length}</span>
                  </h4>
                </div>

                <div className="flex-1 p-4 lg:p-6 space-y-4 overflow-y-auto custom-scrollbar pb-32">
                  {tempCart.length ? (
                    <div className="space-y-3">
                      {tempCart.map((it, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 rounded-2xl font-bold flex justify-between items-center border border-slate-100">
                          <div className="min-w-0 flex-1 pr-4">
                            <div className="text-xs text-slate-800 truncate uppercase tracking-tight font-black">{it.item_name}</div>
                            <div className="text-[9px] text-slate-400 uppercase tracking-widest mt-1.5 font-black">@ ৳{it.price} each</div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1">
                              <button onClick={(e) => { e.stopPropagation(); updateQuantity(it.item_name, it.price, -1); }} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><Minus size={14} /></button>
                              <span className="w-8 text-center text-xs font-black text-slate-800">{it.quantity}</span>
                              <button onClick={(e) => { e.stopPropagation(); updateQuantity(it.item_name, it.price, 1); }} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><Plus size={14} /></button>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setTempCart(prev => prev.filter((_,i) => i !== idx)); }} className="text-slate-300 hover:text-rose-600 transition-colors">
                              <XCircle size={20} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-300 text-[10px] uppercase tracking-widest font-black opacity-30 italic text-center">Basket Empty</div>
                  )}
                </div>

                {/* Sticky Footer - Redesigned to be inline */}
                {tempCart.length > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-5 lg:p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50">
                    <div className="flex items-center justify-between gap-4">
                      <button 
                        onClick={handleQuickChargeConfirm} 
                        disabled={isProcessing}
                        className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-black active:scale-[0.98] transition-all uppercase tracking-widest shrink-0"
                      >
                        {isProcessing ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Apply'}
                      </button>
                      <div className="flex flex-col items-end">
                        <span className="text-slate-400 font-black uppercase text-[8px] tracking-[0.2em] leading-none mb-1">Total Charge</span>
                        <span className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tighter leading-none">৳{cartTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bill Payment Modal - Portalled and Viewport Fixed */}
      {paymentCustomer && createPortal(
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-xl animate-fade-in">
           <div className="bg-white p-8 lg:p-12 rounded-t-[48px] sm:rounded-[64px] w-full max-w-md shadow-2xl border border-white/20 pb-16 sm:pb-12">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Record Payment</h3>
                <button onClick={() => { setPaymentCustomer(null); setPayAmount(''); }} className="p-2.5 bg-slate-50 rounded-full text-slate-400"><X size={24} /></button>
              </div>
              <div className="text-center mb-8 p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Outstanding Balance</div>
                <div className="text-4xl font-black text-rose-600 tracking-tighter">৳{(customerBalances[paymentCustomer.id!] || 0).toLocaleString()}</div>
              </div>
              <form onSubmit={handleCollectPayment} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Received Amount</label>
                  <input autoFocus required type="number" placeholder="৳ 0.00" className="w-full p-6 rounded-[24px] bg-slate-900 text-white font-black text-4xl mb-1 outline-none text-center tracking-tighter ring-indigo-500/20 focus:ring-8 transition-all" value={payAmount} onChange={e=>setPayAmount(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4">
                  {[PaymentType.CASH, PaymentType.UCB].map(m => (
                    <button type="button" key={m} onClick={() => setPayMethod(m)} className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${payMethod === m ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>{m}</button>
                  ))}
                </div>
                <button type="submit" disabled={isProcessing || !payAmount} className="w-full bg-emerald-600 text-white py-6 rounded-[28px] font-black text-lg mt-8 shadow-2xl shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.98] uppercase tracking-widest disabled:opacity-50 transition-all">
                  {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : 'SETTLE ACCOUNT'}
                </button>
              </form>
           </div>
        </div>,
        document.body
      )}

      {statementCustomer && (
        <StatementModal customer={statementCustomer} onClose={() => setStatementCustomer(null)} />
      )}
    </div>
  );
};

export default Customers;
