
import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from './db';
import { Customer, Transaction, InventoryItem } from './types';
import { X, Printer, Share2, Calculator, Loader2 } from 'lucide-react';

interface StatementModalProps {
  customer: Customer;
  onClose: () => void;
}

const StatementModal: React.FC<StatementModalProps> = ({ customer: initialCustomer, onClose }) => {
  const [settings, setSettings] = useState<any>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatementData = async () => {
      setLoading(true);
      try {
        // Fetch current snapshot to ensure any pay bill transactions are fully reflected
        const [
          { data: configData },
          { data: invData },
          { data: transData },
          { data: freshCust }
        ] = await Promise.all([
          supabase.from('settings').select('value').eq('key', 'config').single(),
          supabase.from('inventory').select('*'),
          supabase.from('transactions').select('*').eq('customer_id', initialCustomer.id),
          supabase.from('customers').select('*').eq('id', initialCustomer.id).single()
        ]);

        if (configData) setSettings(configData.value);
        if (invData) setInventory(invData as InventoryItem[]);
        if (transData) setTransactions(transData as Transaction[]);
        if (freshCust) setCustomer(freshCust as Customer);
      } catch (err) {
        console.error("Statement fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatementData();
  }, [initialCustomer.id]);

  const bengaliMonths = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  const currentMonth = bengaliMonths[new Date().getMonth()];
  const currentYear = new Date().getFullYear();
  const monthLabel = `${currentMonth} ${currentYear}`;

  const displayName = customer.uid.length <= 5 ? `${customer.name} Sir` : customer.name;

  const { processedItems, canteenFoodTotal, specialFunds, monthlyPayments } = useMemo(() => {
    if (!transactions.length) return { processedItems: [], canteenFoodTotal: 0, specialFunds: { unitFund: 0, carWash: 0, others: 0 }, monthlyPayments: 0 };
    
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthTrans = transactions.filter(t => t.timestamp >= startOfMonth.getTime());
    const monthlySales = thisMonthTrans.filter(t => t.type !== 'payment');
    const monthlyPaymentsSum = thisMonthTrans.filter(t => t.type === 'payment').reduce((acc, t) => acc + Number(t.total_amount), 0);
    
    const itemMap = new Map<string, { qty: number, historicalRate: number }>();
    const funds = { unitFund: 0, carWash: 0, others: 0 };

    monthlySales.forEach(t => {
      t.items.forEach(item => {
        if (item.item_name === 'Unit Fund') {
          funds.unitFund += (item.price * item.quantity);
        } else if (item.item_name === 'Car Wash') {
          funds.carWash += (item.price * item.quantity);
        } else if (item.item_name === 'Others') {
          funds.others += (item.price * item.quantity);
        } else {
          const existing = itemMap.get(item.item_name);
          if (existing) {
            existing.qty += item.quantity;
          } else {
            itemMap.set(item.item_name, { qty: item.quantity, historicalRate: item.price });
          }
        }
      });
    });

    const items = Array.from(itemMap.entries()).map(([name, data]) => {
      const currentInvItem = inventory.find(i => i.item_name === name);
      const activeRate = currentInvItem ? currentInvItem.price : data.historicalRate;
      return {
        name,
        qty: data.qty,
        rate: activeRate,
        total: data.qty * activeRate
      };
    });

    return {
      processedItems: items,
      canteenFoodTotal: items.reduce((acc, i) => acc + i.total, 0),
      specialFunds: funds,
      monthlyPayments: monthlyPaymentsSum
    };
  }, [transactions, inventory]);

  const totalCalculatedThisMonth = canteenFoodTotal + specialFunds.unitFund + specialFunds.carWash + specialFunds.others;
  const previousArrears = useMemo(() => {
    return Number(customer.total_baki) - (totalCalculatedThisMonth - monthlyPayments);
  }, [customer.total_baki, totalCalculatedThisMonth, monthlyPayments]);

  const grandTotal = Number(customer.total_baki);

  const handlePrint = () => window.print();

  const handleWhatsAppShare = () => {
    const cleanPhone = customer.phone.replace(/\D/g, '');
    let message = `*মাসিক বিল বিবরণী - ${monthLabel}*\n\n` +
      `*নাম:* ${displayName}\n` +
      `*আইডি:* ${customer.uid}\n\n` +
      `১. ক্যান্টিন বিল: ৳${canteenFoodTotal.toFixed(2)}\n`;
    
    let index = 2;
    if (specialFunds.unitFund > 0) message += `${index++}. ইউনিট ফান্ড: ৳${specialFunds.unitFund}\n`;
    if (specialFunds.carWash > 0) message += `${index++}. গাড়ি ওয়াশ: ৳${specialFunds.carWash}\n`;
    if (specialFunds.others > 0) message += `${index++}. অন্যান্য: ৳${specialFunds.others}\n`;
    if (previousArrears > 0) message += `${index++}. পূর্বের বকেয়া: ৳${previousArrears.toFixed(2)}\n`;
    if (monthlyPayments > 0) message += `${index++}. পরিশোধ (এই মাস): -৳${monthlyPayments.toFixed(2)}\n`;

    message += `--------------------------\n` +
      `*সর্বমোট প্রদেয়: ৳${grandTotal.toFixed(2)}*\n\n` +
      `অনুরোধক্রমে বিলটি পরিশোধ করার জন্য বলা হলো।\n` +
      `_${settings?.canteenName || 'CAFE UAV'}_`;
    
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  if (loading) return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white p-12 rounded-[48px] shadow-2xl flex flex-col items-center gap-6 animate-premium border border-white/20">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <div className="text-center">
          <p className="font-black text-slate-800 text-lg uppercase tracking-tight">Syncing Accounts</p>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1 italic">Building Member Statement...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md no-print">
      <div className="bg-white w-full max-w-5xl rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-[95vh] animate-premium">
        <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 no-print flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
              <Calculator size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px] md:text-xs">Statement Builder</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Itemized Breakdown</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all shadow-sm">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-12 bg-white custom-scrollbar printable-area">
          <div className="max-w-2xl mx-auto font-serif text-black bg-white">
            <table className="w-full border-2 border-black border-collapse text-sm md:text-lg">
              <tbody>
                <tr>
                  <td className="border-2 border-black p-2 md:p-3 font-bold w-1/3">মাসের নাম</td>
                  <td className="border-2 border-black p-2 md:p-3 text-center font-bold uppercase">{monthLabel}</td>
                </tr>
                <tr>
                  <td className="border-2 border-black p-2 md:p-3 font-bold">পদবী ও নাম</td>
                  <td className="border-2 border-black p-2 md:p-3 text-center font-bold uppercase">{displayName} ({customer.uid})</td>
                </tr>
              </tbody>
            </table>

            <table className="w-full border-2 border-black border-collapse mt-0 text-sm md:text-lg">
              <thead>
                <tr className="bg-slate-50 print:bg-transparent">
                  <th className="border-2 border-black p-2 text-center font-bold w-[40%] uppercase">দ্রব্যের নাম</th>
                  <th className="border-2 border-black p-2 text-center font-bold w-[20%] uppercase">পরিমাণ</th>
                  <th className="border-2 border-black p-2 text-center font-bold w-[20%] uppercase">দর</th>
                  <th className="border-2 border-black p-2 text-center font-bold w-[20%] uppercase">টাকা</th>
                </tr>
              </thead>
              <tbody>
                {processedItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border-2 border-black p-2 font-medium uppercase tracking-tighter">{item.name}</td>
                    <td className="border-2 border-black p-2 text-center font-bold">{item.qty}</td>
                    <td className="border-2 border-black p-2 text-center">{item.rate}</td>
                    <td className="border-2 border-black p-2 text-right pr-4 font-bold">{item.total.toFixed(2)}</td>
                  </tr>
                ))}
                
                <tr className="bg-slate-50/30">
                  <td colSpan={3} className="border-2 border-black p-2 text-center font-bold uppercase">মোট ক্যান্টিন বিল (খাবার)</td>
                  <td className="border-2 border-black p-2 text-right pr-4 font-black">{canteenFoodTotal.toFixed(2)}</td>
                </tr>
                
                {specialFunds.unitFund > 0 && (
                  <tr>
                    <td colSpan={3} className="border-2 border-black p-2 text-center font-bold uppercase">ইউনিট ফান্ড</td>
                    <td className="border-2 border-black p-2 text-right pr-4 font-bold">{specialFunds.unitFund.toFixed(2)}</td>
                  </tr>
                )}

                {specialFunds.carWash > 0 && (
                  <tr>
                    <td colSpan={3} className="border-2 border-black p-2 text-center font-bold uppercase">গাড়ি ওয়াশ</td>
                    <td className="border-2 border-black p-2 text-right pr-4 font-bold">{specialFunds.carWash.toFixed(2)}</td>
                  </tr>
                )}

                {specialFunds.others > 0 && (
                  <tr>
                    <td colSpan={3} className="border-2 border-black p-2 text-center font-bold uppercase">অন্যান্য</td>
                    <td className="border-2 border-black p-2 text-right pr-4 font-bold">{specialFunds.others.toFixed(2)}</td>
                  </tr>
                )}
                
                {previousArrears !== 0 && (
                  <tr className="opacity-70">
                    <td colSpan={3} className="border-2 border-black p-2 text-center font-bold italic text-sm md:text-base uppercase">পূর্বের বকেয়া/ব্যালেন্স</td>
                    <td className="border-2 border-black p-2 text-right pr-4 font-bold italic text-sm md:text-base">{previousArrears.toFixed(2)}</td>
                  </tr>
                )}

                {monthlyPayments > 0 && (
                  <tr className="text-emerald-700 italic">
                    <td colSpan={3} className="border-2 border-black p-2 text-center font-bold uppercase">পরিশোধ/জমা (চলতি মাস)</td>
                    <td className="border-2 border-black p-2 text-right pr-4 font-bold">- {monthlyPayments.toFixed(2)}</td>
                  </tr>
                )}
                
                <tr className="bg-slate-100 print:bg-transparent">
                  <td colSpan={3} className="border-2 border-black p-2 md:p-3 text-center font-black text-lg md:text-xl uppercase tracking-widest">সর্বমোট প্রদেয়</td>
                  <td className="border-2 border-black p-2 md:p-3 text-right pr-4 font-black text-lg md:text-xl">৳{grandTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-8 md:mt-12 flex justify-between px-4 md:px-10">
              <div className="text-center pt-8 md:pt-10 border-t border-black w-32 md:w-40 text-xs md:text-base uppercase">গ্রাহকের স্বাক্ষর</div>
              <div className="text-center pt-8 md:pt-10 border-t border-black w-32 md:w-40 font-bold text-xs md:text-base uppercase">ম্যানেজার</div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:gap-4 no-print">
          <button 
            type="button"
            onClick={handlePrint}
            className="flex-1 bg-slate-900 text-white py-4 sm:py-5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-3 shadow-xl hover:bg-black transition-all"
          >
            <Printer size={20} /> PRINT / SAVE PDF
          </button>
          <button 
            type="button"
            onClick={handleWhatsAppShare}
            className="flex-1 bg-emerald-600 text-white py-4 sm:py-5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
          >
            <Share2 size={20} /> WHATSAPP SHARE
          </button>
          <button onClick={onClose} className="sm:px-8 bg-white text-slate-400 py-4 sm:py-5 rounded-2xl font-black text-xs sm:text-sm border-2 border-slate-100 hover:bg-slate-50 transition-all">DISMISS</button>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body { visibility: hidden !important; background: white !important; }
          .no-print { display: none !important; }
          .printable-area { visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          .printable-area * { visibility: visible !important; }
        }
      `}</style>
    </div>
  );
};

export default StatementModal;
