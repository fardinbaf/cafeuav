
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { supabase } from './db';
import { InventoryItem, PaymentType, TransactionItem, Transaction, Customer } from './types';
import { ShoppingCart, Plus, Minus, X, CheckCircle2, User, Search, Calculator, Shield, Car, PlusCircle, Scan, ArrowDown, XCircle } from 'lucide-react';
import ReceiptModal from './ReceiptModal';

const Sales: React.FC = () => {
  const [cart, setCart] = useState<TransactionItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.CASH);
  const [success, setSuccess] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customItem, setCustomItem] = useState({ name: '', price: '' });

  useEffect(() => {
    const fetchData = async () => {
      const { data: invData } = await supabase.from('inventory').select('*');
      const { data: custData } = await supabase.from('customers').select('*').order('name');
      if (invData) setInventory(invData as InventoryItem[]);
      if (custData) setCustomers(custData as Customer[]);
    };
    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || 
      c.uid.toLowerCase().includes(memberSearchTerm.toLowerCase())
    ).slice(0, 10);
  }, [customers, memberSearchTerm]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => 
      item.item_name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(productSearchTerm.toLowerCase())
    );
  }, [inventory, productSearchTerm]);

  const selectedCustomer = useMemo(() => 
    customers.find(c => c.id === selectedCustomerId), 
    [customers, selectedCustomerId]
  );

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.item_name === item.item_name && i.price === item.price);
      if (existing) {
        return prev.map(i => (i.item_name === item.item_name && i.price === item.price) ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item_id: item.id || Date.now(), item_name: item.item_name, price: item.price, quantity: 1 }];
    });
  };

  const openFundEntry = (name: string) => {
    setCustomItem({ name, price: '' });
    setShowCustomModal(true);
  };

  const updateQuantity = (name: string, price: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.item_name === name && item.price === price) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentType === PaymentType.BAKI && !selectedCustomerId) {
      alert("Identifier Required for Baki Transactions.");
      return;
    }

    try {
      const currentTotal = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
      const transactionData = {
        customer_id: selectedCustomerId,
        items: cart,
        total_amount: currentTotal,
        payment_type: paymentType,
        timestamp: Date.now(),
        type: 'sale'
      };

      // CRITICAL: We only insert the transaction record.
      // THE DATABASE TRIGGER 'tr_sync_balance' handles all math for 'total_baki'.
      // Redundant frontend math caused the double-subtraction error reported.
      const { data: newTrans, error: transError } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (transError) throw transError;

      setLastTransaction(newTrans as any);
      setSuccess(true);
      setCart([]);
      setSelectedCustomerId(null);
      setMemberSearchTerm('');
      setPaymentType(PaymentType.CASH);
      
      // Refresh local customer registry to reflect trigger changes
      const { data: custData } = await supabase.from('customers').select('*').order('name');
      if (custData) setCustomers(custData as any);
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      alert("Transaction Failed: " + err.message);
    }
  };

  const total = useMemo(() => cart.reduce((acc, i) => acc + (i.price * i.quantity), 0), [cart]);

  const specialFunds = [
    { name: 'Unit Fund', icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { name: 'Car Wash', icon: Car, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { name: 'Others', icon: PlusCircle, color: 'text-amber-600', bg: 'bg-amber-50' }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-screen lg:h-[calc(100vh-140px)] animate-premium">
      <div className="lg:col-span-7 flex flex-col gap-8 overflow-hidden">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Canteen POS</h2>
            <div className="flex items-center gap-2 mt-1">
              <Scan size={14} className="text-indigo-600" />
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Active Billing Session</p>
            </div>
          </div>
          <button onClick={() => { setCustomItem({ name: '', price: '' }); setShowCustomModal(true); }} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-[24px] font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95">
            <Plus size={16} /> Custom Entry
          </button>
        </div>

        <div className="relative group px-2 lg:px-0">
          <Search className="absolute left-6 lg:left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Search menu items..."
            className="w-full pl-14 pr-6 py-4 rounded-[28px] border border-slate-200 bg-white shadow-sm focus:ring-8 focus:ring-indigo-500/5 outline-none font-bold text-sm"
            value={productSearchTerm}
            onChange={(e) => setProductSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-4 shrink-0 px-2 lg:px-0">
          {specialFunds.map((fund) => (
            <button
              key={fund.name}
              onClick={() => openFundEntry(fund.name)}
              className={`flex items-center gap-4 p-5 rounded-[32px] border border-slate-100 bg-white hover:border-indigo-400 transition-all shadow-sm active:scale-95 group`}
            >
              <div className={`w-12 h-12 rounded-2xl ${fund.bg} ${fund.color} flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform shrink-0`}>
                <fund.icon size={24} />
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Fee</div>
                <div className="font-black text-slate-800 text-sm leading-none">{fund.name}</div>
              </div>
            </button>
          ))}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-6 overflow-y-auto pr-4 custom-scrollbar pb-10 px-2 lg:px-0">
          {filteredInventory.map(item => (
            <button key={item.id} onClick={() => addToCart(item)} className="bg-white p-6 rounded-[40px] border border-slate-200 shadow-sm hover:border-indigo-400 hover:shadow-2xl transition-all text-left flex flex-col justify-between group active:scale-95 h-44 border-b-8">
              <div>
                <div className="text-[9px] text-indigo-400 font-black mb-2 uppercase tracking-widest">{item.category}</div>
                <div className="font-black text-slate-800 text-lg leading-tight line-clamp-2 uppercase">{item.item_name}</div>
              </div>
              <div className="flex items-center justify-between mt-auto">
                <span className="font-black text-slate-900 text-2xl tracking-tighter">৳{item.price}</span>
                <div className="bg-slate-50 p-3 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                  <Plus size={20} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-5 bg-white rounded-[56px] border border-slate-200 shadow-2xl flex flex-col overflow-hidden border-t-8 border-t-indigo-600 relative mx-2 lg:mx-0">
        <div className="p-8 lg:p-10 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-black flex items-center gap-3 text-slate-800 uppercase tracking-tight text-lg">
            <ShoppingCart size={24} className="text-indigo-600" />
            Selection
          </h3>
          <span className="px-5 py-2 bg-indigo-600 text-white rounded-2xl text-[10px] font-black tracking-widest">{cart.length} UNITS</span>
        </div>

        <div className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-4 custom-scrollbar min-h-[200px]">
          {cart.map((item, idx) => (
            <div key={`${item.item_name}-${item.price}-${idx}`} className="flex items-center justify-between p-5 bg-slate-50 rounded-[32px] border border-slate-100 hover:bg-white hover:shadow-xl transition-all">
              <div className="flex-1 min-w-0 pr-4">
                <div className="font-black text-slate-800 text-sm tracking-tight truncate uppercase">{item.item_name}</div>
                <div className="text-[10px] text-indigo-600 font-black uppercase tracking-[0.2em] mt-1">৳{item.price} × {item.quantity}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-white rounded-xl border border-slate-200 px-2 py-1 shadow-inner">
                  <button onClick={() => updateQuantity(item.item_name, item.price, -1)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><Minus size={14} /></button>
                  <span className="w-8 text-center font-black text-sm text-slate-800">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.item_name, item.price, 1)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><Plus size={14} /></button>
                </div>
                <button onClick={() => setCart(prev => prev.filter((_,idx2) => idx2 !== idx))} className="text-slate-300 hover:text-rose-600 transition-all"><X size={20} /></button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 py-20 opacity-30">
              <ShoppingCart size={80} strokeWidth={1} />
              <p className="font-bold italic uppercase tracking-widest">Basket Empty</p>
            </div>
          )}
        </div>

        <div className="p-8 lg:p-10 bg-slate-50 border-t border-slate-200 space-y-6 shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
          <div className="space-y-4">
            <div className="relative" ref={dropdownRef}>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2 block ml-1">Member Selection</label>
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-all" size={20} />
                <input 
                  type="text"
                  placeholder={selectedCustomer ? `${selectedCustomer.uid} | ${selectedCustomer.name}` : "Search Member..."}
                  className={`w-full pl-14 pr-14 py-5 rounded-[32px] border-2 outline-none font-black text-lg transition-all ${
                    selectedCustomerId ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xl' : 'border-slate-200 bg-slate-800 text-white focus:border-indigo-500'
                  }`}
                  value={memberSearchTerm}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => { setMemberSearchTerm(e.target.value); setIsDropdownOpen(true); }}
                />
                {selectedCustomerId && (
                  <button onClick={() => {setSelectedCustomerId(null); setMemberSearchTerm('');}} className="absolute right-5 top-1/2 -translate-y-1/2 text-rose-500">
                    <XCircle size={24} />
                  </button>
                )}
              </div>

              {isDropdownOpen && (
                <div className="absolute bottom-full mb-4 left-0 w-full bg-white border border-slate-200 rounded-[40px] shadow-2xl overflow-hidden z-[110] animate-premium">
                  <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                    {filteredCustomers.map(c => (
                        <button 
                          key={c.id}
                          onClick={() => { setSelectedCustomerId(c.id!); setMemberSearchTerm(''); setIsDropdownOpen(false); }}
                          className={`w-full text-left px-8 py-4 hover:bg-indigo-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0 ${selectedCustomerId === c.id ? 'bg-indigo-50' : ''}`}
                        >
                          <div>
                            <div className="font-black text-slate-800 text-sm tracking-tight uppercase">{c.name}</div>
                            <div className="text-[10px] text-indigo-500 font-black tracking-widest">{c.uid}</div>
                          </div>
                          {selectedCustomerId === c.id && <CheckCircle2 size={20} className="text-indigo-600" />}
                        </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 lg:gap-3">
              {[PaymentType.CASH, PaymentType.BAKI, PaymentType.UCB].map(type => (
                <button
                  key={type}
                  onClick={() => setPaymentType(type)}
                  className={`py-4 lg:py-5 rounded-[24px] font-black text-[10px] uppercase tracking-widest border-2 transition-all shadow-sm ${
                    paymentType === type 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xl' 
                      : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <span className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Total Bill</span>
              <span className="text-5xl font-black text-slate-800 tracking-tighter">৳{total.toLocaleString()}</span>
            </div>

            <button 
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className={`w-full py-6 rounded-[32px] font-black text-lg flex items-center justify-center gap-4 transition-all shadow-2xl ${
                cart.length > 0 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]' 
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              {success ? <CheckCircle2 size={32} className="animate-bounce" /> : <><Calculator size={24} /> FINALIZE BILL</>}
            </button>
            {lastTransaction && (
              <button onClick={() => setShowReceipt(true)} className="w-full mt-4 py-3 text-indigo-600 font-black text-[10px] uppercase tracking-widest underline underline-offset-8 decoration-indigo-200 hover:decoration-indigo-600 transition-all flex items-center justify-center gap-2">
                <ArrowDown size={14} /> Generate Memo #{lastTransaction.id}
              </button>
            )}
          </div>
        </div>
      </div>

      {showCustomModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[56px] p-10 lg:p-12 space-y-8 shadow-2xl border border-white/20">
            <h3 className="text-2xl lg:text-3xl font-black tracking-tighter uppercase text-slate-800">Custom Charge</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Label</label>
                <input className="w-full p-5 lg:p-6 bg-slate-900 text-white rounded-[28px] font-black text-sm uppercase outline-none focus:ring-4 ring-indigo-500/20" placeholder="Description" value={customItem.name} onChange={e => setCustomItem({...customItem, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rate (৳)</label>
                <input autoFocus type="number" className="w-full p-5 lg:p-6 bg-slate-900 text-white rounded-[28px] font-black text-3xl outline-none focus:ring-4 ring-indigo-500/20 text-center tracking-tighter" placeholder="0.00" value={customItem.price} onChange={e => setCustomItem({...customItem, price: e.target.value})} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => { if(!customItem.name || !customItem.price) return; addToCart({id: Date.now(), item_name: customItem.name, price: Number(customItem.price)}); setShowCustomModal(false); }} className="w-full bg-indigo-600 text-white py-6 rounded-[28px] font-black text-lg shadow-xl active:scale-95 transition-all">INJECT TO CART</button>
              <button onClick={() => setShowCustomModal(false)} className="w-full py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-600">DISCARD</button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && lastTransaction && (
        <ReceiptModal transaction={lastTransaction} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  );
};

export default Sales;
