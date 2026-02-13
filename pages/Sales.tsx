
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../db';
import { InventoryItem, PaymentType, TransactionItem, Transaction, Customer } from '../types';
import { ShoppingCart, Plus, Minus, X, CheckCircle2, Search, Calculator, Shield, Car, PlusCircle, Scan, ArrowDown, XCircle, UserCheck, Loader2, Layers, ArrowDownCircle, LayoutGrid } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';

const Sales: React.FC = () => {
  const [cart, setCart] = useState<TransactionItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Mobile UI State
  const [activeTab, setActiveTab] = useState<'catalog' | 'basket'>('catalog');
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customItem, setCustomItem] = useState({ name: '', price: '' });

  const fetchData = async () => {
    const { data: invData } = await supabase.from('inventory').select('*');
    const { data: custData } = await supabase.from('customers').select('*').order('name');
    if (invData) setInventory(invData as InventoryItem[]);
    if (custData) setCustomers(custData as Customer[]);
  };

  useEffect(() => {
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

  const updateQuantity = (name: string, price: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.item_name === name && item.price === price) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    if (!selectedCustomerId) {
      alert("Please select a Member to charge this transaction to their account.");
      return;
    }

    setIsProcessing(true);
    try {
      const currentTotal = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
      const transactionData = {
        customer_id: selectedCustomerId,
        items: cart,
        total_amount: currentTotal,
        payment_type: PaymentType.BAKI,
        timestamp: Date.now(),
        type: 'sale'
      };

      const { data: newTrans, error: transError } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (transError) throw transError;

      const stockUpdates = cart.map(async (item) => {
        const invItem = inventory.find(i => i.id === item.item_id);
        if (invItem) {
          const newQty = Math.max(0, invItem.stock_quantity - item.quantity);
          return supabase.from('inventory').update({ stock_quantity: newQty }).eq('id', item.item_id);
        }
      });
      await Promise.all(stockUpdates);

      setLastTransaction(newTrans as any);
      setSuccess(true);
      setCart([]);
      setSelectedCustomerId(null);
      setMemberSearchTerm('');
      
      await fetchData();
      setActiveTab('catalog'); // Switch back to menu after success
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      alert("Transaction Failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const total = useMemo(() => cart.reduce((acc, i) => acc + (i.price * i.quantity), 0), [cart]);

  const specialFunds = [
    { name: 'Unit Fund', icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { name: 'Car Wash', icon: Car, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { name: 'Others', icon: PlusCircle, color: 'text-amber-600', bg: 'bg-amber-50' }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-screen lg:h-[calc(100vh-140px)] animate-premium relative pb-24 lg:pb-0">
      
      {/* Mobile Sticky Tab Switcher */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[150] bg-white border-t border-slate-200 p-2 flex gap-2 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <button 
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'catalog' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}
        >
          <LayoutGrid size={16} /> MENU
        </button>
        <button 
          onClick={() => setActiveTab('basket')}
          className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all relative ${activeTab === 'basket' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}
        >
          <ShoppingCart size={16} /> BASKET
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-[9px] border-2 border-white shadow-sm">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* Catalog Column */}
      <div className={`lg:col-span-7 flex flex-col gap-6 lg:gap-8 ${activeTab === 'basket' ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex justify-between items-center px-2 lg:px-0">
          <div>
            <h2 className="text-xl lg:text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">Canteen POS</h2>
            <div className="flex items-center gap-2 mt-1">
              <Scan size={14} className="text-indigo-600" />
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Active Node</p>
            </div>
          </div>
          <button onClick={() => { setCustomItem({ name: '', price: '' }); setShowCustomModal(true); }} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-3 lg:px-6 lg:py-4 rounded-xl lg:rounded-[24px] font-black text-[9px] lg:text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl">
            <Plus size={16} /> <span className="hidden sm:inline">CUSTOM ENTRY</span><span className="sm:hidden">CUSTOM</span>
          </button>
        </div>

        <div className="relative group px-2 lg:px-0">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Search catalog..."
            className="w-full pl-14 pr-6 py-4 rounded-2xl lg:rounded-[28px] border border-slate-200 bg-white shadow-sm focus:ring-8 focus:ring-indigo-500/5 outline-none font-bold text-sm"
            value={productSearchTerm}
            onChange={(e) => setProductSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 lg:gap-4 shrink-0 px-2 lg:px-0">
          {specialFunds.map((fund) => (
            <button
              key={fund.name}
              onClick={() => { setCustomItem({ name: fund.name, price: '' }); setShowCustomModal(true); }}
              className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 lg:gap-4 p-3 lg:p-5 rounded-2xl lg:rounded-[32px] border border-slate-100 bg-white hover:border-indigo-400 transition-all shadow-sm active:scale-95 group`}
            >
              <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl ${fund.bg} ${fund.color} flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform shrink-0`}>
                <fund.icon size={18} />
              </div>
              <div className="text-center sm:text-left overflow-hidden">
                <div className="text-[7px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Fee</div>
                <div className="font-black text-slate-800 text-[8px] lg:text-sm leading-none truncate">{fund.name}</div>
              </div>
            </button>
          ))}
        </div>
        
        <div className="space-y-2 lg:overflow-y-auto pr-0 lg:pr-4 custom-scrollbar pb-10 px-2 lg:px-0 flex-1">
          {filteredInventory.map(item => (
            <div 
              key={item.id} 
              onClick={() => addToCart(item)} 
              className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-400 hover:shadow-xl transition-all text-left flex items-center justify-between group active:scale-95 cursor-pointer border-b-4"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all shrink-0">
                  <Layers size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[8px] text-indigo-400 font-black uppercase tracking-widest leading-none mb-1">{item.category}</div>
                  <div className="font-black text-slate-800 text-sm lg:text-base uppercase truncate leading-tight">{item.item_name}</div>
                  <div className={`text-[8px] lg:text-[9px] font-bold mt-1 ${item.stock_quantity > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    Stock: {item.stock_quantity}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 lg:gap-6">
                <span className="font-black text-slate-900 text-lg lg:text-2xl tracking-tighter">৳{item.price}</span>
                <div className="bg-slate-900 text-white p-2.5 lg:p-3 rounded-xl shadow-lg group-hover:bg-indigo-600 transition-colors">
                  <Plus size={18} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Basket Column */}
      <div className={`lg:col-span-5 bg-white lg:rounded-[56px] border border-slate-200 shadow-2xl flex flex-col overflow-hidden border-t-8 border-t-indigo-600 relative mx-0 lg:mx-0 ${activeTab === 'catalog' ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-6 lg:p-10 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-black flex items-center gap-3 text-slate-800 uppercase tracking-tight text-base lg:text-lg">
            <ShoppingCart size={22} className="text-indigo-600" /> Member Basket
          </h3>
          <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black tracking-widest">{cart.length} ITEMS</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-3 custom-scrollbar min-h-[300px] lg:min-h-0">
          {cart.map((item, idx) => (
            <div key={`${item.item_name}-${item.price}-${idx}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-[24px] lg:rounded-[32px] border border-slate-100 hover:bg-white transition-all">
              <div className="flex-1 min-w-0 pr-4">
                <div className="font-black text-slate-800 text-xs lg:text-sm tracking-tight truncate uppercase">{item.item_name}</div>
                <div className="text-[9px] lg:text-[10px] text-indigo-600 font-black uppercase tracking-[0.2em] mt-1">৳{item.price} × {item.quantity}</div>
              </div>
              <div className="flex items-center gap-3 lg:gap-4">
                <div className="flex items-center bg-white rounded-xl border border-slate-200 px-1.5 py-1 shadow-inner">
                  <button onClick={() => updateQuantity(item.item_name, item.price, -1)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"><Minus size={12} /></button>
                  <span className="w-6 text-center font-black text-xs text-slate-800">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.item_name, item.price, 1)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"><Plus size={12} /></button>
                </div>
                <button onClick={() => setCart(prev => prev.filter((_,idx2) => idx2 !== idx))} className="text-slate-300 hover:text-rose-600 transition-all"><X size={18} /></button>
              </div>
            </div>
          ))}
          {cart.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 py-16 opacity-30 uppercase font-bold tracking-widest italic text-xs">Basket Empty</div>}
        </div>

        <div className="p-6 lg:p-10 bg-slate-50 border-t border-slate-200 space-y-6 shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
          <div className="space-y-4">
            <div className="relative" ref={dropdownRef}>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2 block ml-1">Charge Account</label>
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-all" size={20} />
                <input 
                  type="text"
                  placeholder={selectedCustomer ? `${selectedCustomer.uid} | ${selectedCustomer.name}` : "SID or Name..."}
                  className={`w-full pl-14 pr-14 py-4 lg:py-5 rounded-[28px] lg:rounded-[32px] border-2 outline-none font-black text-base lg:text-lg transition-all ${
                    selectedCustomerId ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xl' : 'border-slate-200 bg-slate-800 text-white focus:border-indigo-500'
                  }`}
                  value={memberSearchTerm}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => { setMemberSearchTerm(e.target.value); setIsDropdownOpen(true); }}
                />
                {selectedCustomerId && <button onClick={() => setSelectedCustomerId(null)} className="absolute right-5 top-1/2 -translate-y-1/2 text-rose-500"><XCircle size={24} /></button>}
              </div>

              {isDropdownOpen && (
                <div className="absolute bottom-full mb-4 left-0 w-full bg-white border border-slate-200 rounded-[32px] lg:rounded-[40px] shadow-2xl overflow-hidden z-[110] animate-premium">
                  <div className="max-h-[200px] lg:max-h-[250px] overflow-y-auto custom-scrollbar">
                    {filteredCustomers.map(c => (
                        <button 
                          key={c.id}
                          onClick={() => { setSelectedCustomerId(c.id!); setMemberSearchTerm(''); setIsDropdownOpen(false); }}
                          className={`w-full text-left px-6 py-4 hover:bg-indigo-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0 ${selectedCustomerId === c.id ? 'bg-indigo-50' : ''}`}
                        >
                          <div>
                            <div className="font-black text-slate-800 text-xs lg:text-sm tracking-tight uppercase">{c.name}</div>
                            <div className="text-[9px] text-indigo-500 font-black tracking-widest">{c.uid}</div>
                          </div>
                          {selectedCustomerId === c.id && <CheckCircle2 size={18} className="text-indigo-600" />}
                        </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 lg:pt-6 border-t border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <span className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Total Bill</span>
              <span className="text-3xl lg:text-5xl font-black text-slate-800 tracking-tighter">৳{total.toLocaleString()}</span>
            </div>

            <button 
              onClick={handleCheckout}
              disabled={cart.length === 0 || !selectedCustomerId || isProcessing}
              className={`w-full py-5 lg:py-6 rounded-2xl lg:rounded-[32px] font-black text-base lg:text-lg flex items-center justify-center gap-3 transition-all shadow-2xl ${
                cart.length > 0 && selectedCustomerId && !isProcessing
                  ? 'bg-slate-900 text-white hover:bg-black active:scale-0.98' 
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : success ? <CheckCircle2 size={28} className="animate-bounce" /> : <><Calculator size={20} /> CHARGE ACCOUNT</>}
            </button>
            {lastTransaction && (
              <button onClick={() => setShowReceipt(true)} className="w-full mt-4 py-2 text-indigo-600 font-black text-[9px] uppercase tracking-widest underline underline-offset-8 decoration-indigo-200 transition-all flex items-center justify-center gap-2">
                <ArrowDown size={14} /> View Memo #{lastTransaction.id}
              </button>
            )}
          </div>
        </div>
      </div>

      {showCustomModal && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[40px] lg:rounded-[56px] p-8 lg:p-12 space-y-6 lg:space-y-8 shadow-2xl border border-white/20">
            <h3 className="text-xl lg:text-2xl font-black tracking-tighter uppercase text-slate-800">Custom Charge</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Label</label>
                <input className="w-full p-5 bg-slate-900 text-white rounded-[24px] font-black text-sm uppercase outline-none" placeholder="Description" value={customItem.name} onChange={e => setCustomItem({...customItem, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Rate (৳)</label>
                <input autoFocus type="number" className="w-full p-5 bg-slate-900 text-white rounded-[24px] font-black text-2xl outline-none text-center" placeholder="0.00" value={customItem.price} onChange={e => setCustomItem({...customItem, price: e.target.value})} />
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <button onClick={() => { if(!customItem.name || !customItem.price) return; addToCart({id: null, item_name: customItem.name, price: Number(customItem.price)}); setShowCustomModal(false); }} className="w-full bg-indigo-600 text-white py-5 rounded-[24px] font-black text-base shadow-xl active:scale-95 transition-all uppercase">INJECT TO CART</button>
              <button onClick={() => setShowCustomModal(false)} className="w-full py-4 text-slate-400 font-bold uppercase text-[9px] tracking-widest">DISCARD</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showReceipt && lastTransaction && createPortal(
        <ReceiptModal transaction={lastTransaction} onClose={() => setShowReceipt(false)} />,
        document.body
      )}
    </div>
  );
};

export default Sales;
