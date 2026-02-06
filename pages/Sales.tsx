import React, { useState, useMemo, useRef, useEffect } from 'react';
import { supabase } from '../db';
import { InventoryItem, PaymentType, TransactionItem, Transaction, Customer } from '../types';
import { ShoppingCart, Plus, Minus, X, CheckCircle2, User, Search, Calculator, Shield, Car, PlusCircle } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';

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

  const selectedCustomer = useMemo(() => 
    customers.find(c => c.id === selectedCustomerId), 
    [customers, selectedCustomerId]
  );

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.item_name === item.item_name);
      if (existing) {
        return prev.map(i => i.item_name === item.item_name ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item_id: item.id || Date.now(), item_name: item.item_name, price: item.price, quantity: 1 }];
    });
  };

  const updateQuantity = (name: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.item_name === name) {
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

      const { data: newTrans, error: transError } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (transError) throw transError;

      if (paymentType === PaymentType.BAKI && selectedCustomerId && selectedCustomer) {
        await supabase.from('customers')
          .update({ total_baki: Number(selectedCustomer.total_baki) + currentTotal })
          .eq('id', selectedCustomerId);
      }

      setLastTransaction(newTrans as any);
      setSuccess(true);
      setCart([]);
      setSelectedCustomerId(null);
      setMemberSearchTerm('');
      setPaymentType(PaymentType.CASH);
      setTimeout(() => setSuccess(false), 3000);
      
      const { data: custData } = await supabase.from('customers').select('*').order('name');
      if (custData) setCustomers(custData as any);
      
    } catch (err: any) {
      alert("Transaction Failed: " + err.message);
    }
  };

  const total = useMemo(() => cart.reduce((acc, i) => acc + (i.price * i.quantity), 0), [cart]);

  const specialFunds = [
    { name: 'Unit Fund', icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50', price: 100 },
    { name: 'Car Wash', icon: Car, color: 'text-emerald-600', bg: 'bg-emerald-50', price: 50 },
    { name: 'Others', icon: PlusCircle, color: 'text-amber-600', bg: 'bg-amber-50', price: 0 }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-screen lg:h-[calc(100vh-140px)] animate-premium">
      <div className="lg:col-span-7 flex flex-col gap-8 overflow-hidden">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Active Menu</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Live Selection</p>
          </div>
          <button onClick={() => setShowCustomModal(true)} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-[24px] font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95">
            <Plus size={16} /> Add Custom
          </button>
        </div>

        {/* Special Funds Row */}
        <div className="grid grid-cols-3 gap-4 shrink-0">
          {specialFunds.map((fund) => (
            <button
              key={fund.name}
              onClick={() => addToCart({ item_name: fund.name, price: fund.price })}
              className={`flex items-center gap-4 p-5 rounded-[32px] border border-slate-100 bg-white hover:border-indigo-400 transition-all shadow-sm active:scale-95 group`}
            >
              <div className={`w-12 h-12 rounded-2xl ${fund.bg} ${fund.color} flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
                <fund.icon size={24} />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Charge</div>
                <div className="font-black text-slate-800 text-sm leading-none">{fund.name}</div>
              </div>
            </button>
          ))}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 overflow-y-auto pr-4 custom-scrollbar pb-10">
          {inventory.map(item => (
            <button key={item.id} onClick={() => addToCart(item)} className="bg-white p-6 rounded-[40px] border border-slate-200 shadow-sm hover:border-indigo-400 hover:shadow-2xl transition-all text-left flex flex-col justify-between group active:scale-95 h-44 border-b-8">
              <div>
                <div className="text-[9px] text-indigo-400 font-black mb-2 uppercase tracking-widest">{item.category}</div>
                <div className="font-black text-slate-800 text-lg leading-tight line-clamp-2">{item.item_name}</div>
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

      <div className="lg:col-span-5 bg-white rounded-[56px] border border-slate-200 shadow-2xl flex flex-col overflow-hidden border-t-8 border-t-indigo-600 relative">
        <div className="p-10 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-black flex items-center gap-3 text-slate-800 uppercase tracking-tight text-xl">
            <ShoppingCart size={24} className="text-indigo-600" />
            Active Cart
          </h3>
          <span className="px-5 py-2 bg-indigo-600 text-white rounded-2xl text-[10px] font-black tracking-widest">{cart.length} ITEMS</span>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
          {cart.map((item, idx) => (
            <div key={`${item.item_name}-${idx}`} className="flex items-center justify-between p-6 bg-slate-50 rounded-[32px] border border-slate-100 hover:bg-white hover:shadow-xl transition-all">
              <div className="flex-1 min-w-0 pr-4">
                <div className="font-black text-slate-800 text-lg tracking-tight truncate">{item.item_name}</div>
                <div className="text-[10px] text-indigo-600 font-black uppercase tracking-[0.2em] mt-2">৳{item.price} × {item.quantity} = ৳{item.price * item.quantity}</div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center bg-white rounded-2xl border border-slate-200 px-3 py-2 shadow-inner">
                  <button onClick={() => updateQuantity(item.item_name, -1)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Minus size={16} /></button>
                  <span className="w-10 text-center font-black text-lg text-slate-800">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.item_name, 1)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Plus size={16} /></button>
                </div>
                <button onClick={() => setCart(prev => prev.filter((_,idx2) => idx2 !== idx))} className="text-slate-300 hover:text-rose-600 transition-all"><X size={24} /></button>
              </div>
            </div>
          ))}
          {cart.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50"><ShoppingCart size={80} strokeWidth={1} /><p className="font-bold italic">Cart is empty</p></div>}
        </div>

        <div className="p-10 bg-slate-50 border-t border-slate-200 space-y-8 shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
          <div className="space-y-6">
            <div className="relative" ref={dropdownRef}>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 block ml-1">Member Identity</label>
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-all" size={20} />
                <input 
                  type="text"
                  placeholder={selectedCustomer ? `${selectedCustomer.uid} | ${selectedCustomer.name}` : "Search SID or Name..."}
                  className={`w-full pl-14 pr-14 py-6 rounded-[32px] border-2 outline-none font-black text-lg transition-all ${
                    selectedCustomerId ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xl' : 'border-slate-200 bg-slate-800 text-white focus:border-indigo-500'
                  }`}
                  value={memberSearchTerm}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => { setMemberSearchTerm(e.target.value); setIsDropdownOpen(true); }}
                />
              </div>

              {isDropdownOpen && (
                <div className="absolute bottom-full mb-4 left-0 w-full bg-white border border-slate-200 rounded-[40px] shadow-2xl overflow-hidden z-[110] animate-premium">
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    {filteredCustomers.map(c => (
                        <button 
                          key={c.id}
                          onClick={() => { setSelectedCustomerId(c.id!); setMemberSearchTerm(''); setIsDropdownOpen(false); }}
                          className={`w-full text-left px-8 py-5 hover:bg-indigo-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0 ${selectedCustomerId === c.id ? 'bg-indigo-50' : ''}`}
                        >
                          <div>
                            <div className="font-black text-slate-800 text-lg tracking-tight">{c.name}</div>
                            <div className="text-[10px] text-indigo-500 font-black tracking-widest">{c.uid}</div>
                          </div>
                          {selectedCustomerId === c.id && <CheckCircle2 size={24} className="text-indigo-600" />}
                        </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[PaymentType.CASH, PaymentType.BAKI, PaymentType.UCB].map(type => (
                <button
                  key={type}
                  onClick={() => setPaymentType(type)}
                  className={`py-5 rounded-[24px] font-black text-[10px] uppercase tracking-widest border-2 transition-all shadow-sm ${
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

          <div className="pt-8 border-t border-slate-200">
            <div className="flex justify-between items-center mb-10">
              <span className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Net Payable</span>
              <span className="text-6xl font-black text-slate-800 tracking-tighter">৳{total.toLocaleString()}</span>
            </div>

            <button 
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className={`w-full py-7 rounded-[32px] font-black text-xl flex items-center justify-center gap-4 transition-all shadow-2xl ${
                cart.length > 0 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]' 
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              {success ? <CheckCircle2 size={32} className="animate-bounce" /> : <><Calculator size={28} /> EXECUTE BILLING</>}
            </button>
            {lastTransaction && (
              <button onClick={() => setShowReceipt(true)} className="w-full mt-4 py-3 text-indigo-600 font-black text-[10px] uppercase tracking-widest underline underline-offset-8 decoration-indigo-200 hover:decoration-indigo-600 transition-all">Generate Invoice #{lastTransaction.id}</button>
            )}
          </div>
        </div>
      </div>

      {showCustomModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[56px] p-12 space-y-8 shadow-2xl border border-white/20">
            <h3 className="text-3xl font-black tracking-tighter">Custom Entry</h3>
            <div className="space-y-4">
              <input className="w-full p-6 bg-slate-800 text-white rounded-[28px] font-black" placeholder="Item Name" value={customItem.name} onChange={e => setCustomItem({...customItem, name: e.target.value})} />
              <input type="number" className="w-full p-6 bg-slate-800 text-white rounded-[28px] font-black text-3xl" placeholder="৳ 0.00" value={customItem.price} onChange={e => setCustomItem({...customItem, price: e.target.value})} />
            </div>
            <button onClick={() => { addToCart({id: Date.now(), item_name: customItem.name, price: Number(customItem.price)}); setShowCustomModal(false); }} className="w-full bg-indigo-600 text-white py-6 rounded-[28px] font-black text-lg shadow-xl active:scale-95 transition-all">INJECT TO CART</button>
            <button onClick={() => setShowCustomModal(false)} className="w-full py-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cancel</button>
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