
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../db';
import { Customer, Transaction, PaymentType, InventoryItem } from '../types';
import { X, Printer, Share2, Calculator, Loader2 } from 'lucide-react';

interface StatementModalProps {
  customer: Customer;
  onClose: () => void;
}

const StatementModal: React.FC<StatementModalProps> = ({ customer: initialCustomer, onClose }) => {
  const [settings, setSettings] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatementData = async () => {
      setLoading(true);
      try {
        const [
          { data: configData },
          { data: transData },
          { data: freshCust },
          { data: invData }
        ] = await Promise.all([
          supabase.from('settings').select('value').eq('key', 'config').single(),
          supabase.from('transactions').select('*').eq('customer_id', initialCustomer.id),
          supabase.from('customers').select('*').eq('id', initialCustomer.id).single(),
          supabase.from('inventory').select('*')
        ]);

        if (configData) setSettings(configData.value);
        if (transData) setTransactions(transData as Transaction[]);
        if (freshCust) setCustomer(freshCust as Customer);
        if (invData) setInventory(invData as InventoryItem[]);
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

  const { processedItems, canteenFoodTotal, specialFunds, monthlyPayments, currentMonthBillTotal, totalOutstandingBalance } = useMemo(() => {
    if (!transactions.length) return { processedItems: [], canteenFoodTotal: 0, specialFunds: { unitFund: 0, carWash: 0, others: 0 }, monthlyPayments: 0, currentMonthBillTotal: 0, totalOutstandingBalance: 0 };
    
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // DYNAMIC BALANCE CALCULATION: Re-calculate all historical Baki based on *current* inventory prices
    const lifeBalance = transactions.reduce((acc, t) => {
      if (t.type === 'payment') return acc - Number(t.total_amount);
      if (t.type === 'sale' && t.payment_type === PaymentType.BAKI) {
        const currentPriceSum = t.items.reduce((iSum, item) => {
          const livePrice = inventory.find(inv => inv.item_name === item.item_name)?.price ?? item.price;
          return iSum + (livePrice * item.quantity);
        }, 0);
        return acc + currentPriceSum;
      }
      return acc;
    }, 0);

    const thisMonthTrans = transactions.filter(t => t.timestamp >= startOfMonth.getTime());
    
    const monthlyAllSales = thisMonthTrans.filter(t => t.type === 'sale');
    const monthlyExplicitPayments = thisMonthTrans.filter(t => t.type === 'payment');
    const monthlyUpfrontPayments = monthlyAllSales
      .filter(t => t.payment_type !== PaymentType.BAKI)
      .reduce((acc, t) => {
        const currentPriceSum = t.items.reduce((iSum, item) => {
          const livePrice = inventory.find(inv => inv.item_name === item.item_name)?.price ?? item.price;
          return iSum + (livePrice * item.quantity);
        }, 0);
        return acc + currentPriceSum;
      }, 0);
    
    const monthlyPaymentsSum = monthlyExplicitPayments.reduce((acc, t) => acc + Number(t.total_amount), 0) + monthlyUpfrontPayments;
    
    const itemMap = new Map<string, { name: string, qty: number, rate: number }>();
    const funds = { unitFund: 0, carWash: 0, others: 0 };

    monthlyAllSales.forEach(t => {
      t.items.forEach(item => {
        if (item.item_name === 'Unit Fund') {
          funds.unitFund += (item.price * item.quantity);
        } else if (item.item_name === 'Car Wash') {
          funds.carWash += (item.price * item.quantity);
        } else if (item.item_name === 'Others') {
          funds.others += (item.price * item.quantity);
        } else {
          // Dynamic lookup for item rate
          const livePrice = inventory.find(inv => inv.item_name === item.item_name)?.price ?? item.price;
          const key = `${item.item_name}_${livePrice}`;
          const existing = itemMap.get(key);
          if (existing) {
            existing.qty += item.quantity;
          } else {
            itemMap.set(key, { name: item.item_name, qty: item.quantity, rate: livePrice });
          }
        }
      });
    });

    const items = Array.from(itemMap.values()).map(data => ({
      ...data,
      total: data.qty * data.rate
    }));

    const foodTotal = items.reduce((acc, i) => acc + i.total, 0);
    const billTotal = foodTotal + funds.unitFund + funds.carWash + funds.others;

    return {
      processedItems: items,
      canteenFoodTotal: foodTotal,
      specialFunds: funds,
      monthlyPayments: monthlyPaymentsSum,
      currentMonthBillTotal: billTotal,
      totalOutstandingBalance: lifeBalance
    };
  }, [transactions, inventory]);

  const handlePrint = () => window.print();

  const handleWhatsAppShare = () => {
    const cleanPhone = customer.phone.replace(/\D/g, '');
    let message = `*মাসিক বিল বিবরণী - ${monthLabel}*\n\n` +
      `*নাম:* ${displayName}\n` +
      `*আইডি:* ${customer.uid}\n\n` +
      `১. ক্যান্টিন বিল: ৳${canteenFoodTotal.toFixed(2)}\n`;
    
    let index = 2;
    if (specialFunds.unitFund > 0) message += `${index++}. ইউনিট ফান্ড: ৳${specialFunds.unitFund.toFixed(2)}\n`;
    if (specialFunds.carWash > 0) message += `${index++}. গাড়ি ওয়াশ: ৳${specialFunds.carWash.toFixed(2)}\n`;
    if (specialFunds.others > 0) message += `${index++}. অন্যান্য: ৳${specialFunds.others.toFixed(2)}\n`;
    
    message += `--------------------------\n` +
      `চলতি মাসের মোট: ৳${currentMonthBillTotal.toFixed(2)}\n`;

    if (monthlyPayments > 0) message += `পরিশোধ (এই মাস): -৳${monthlyPayments.toFixed(2)}\n`;

    message += `--------------------------\n` +
      `*সর্বমোট প্রদেয়: ৳${totalOutstandingBalance.toFixed(2)}*\n\n` +
      `অনুরোধক্রমে বিলটি পরিশোধ করার জন্য বলা হলো।\n` +
      `_${settings?.canteenName || 'CAFE UAV'}_`;
    
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  if (loading) return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white p-10 rounded-[40px] shadow-2xl animate-pulse font-black text-slate-400 uppercase tracking-widest">Building Memo Node...</div>
    </div>
  );

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex justify-center items-start p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md no-print-overlay overflow-y-auto pt-8 sm:pt-20">
      <div className="bg-white w-full max-w-2xl rounded-[32px] md:rounded-[48px] shadow-2xl overflow-hidden flex flex-col h-auto mb-10 animate-in slide-in-from-top-4 duration-300 print-modal-container">
        <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 no-print flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600 shadow-sm">
              <Calculator size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px] md:text-xs">Statement Builder</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Precise Monthly Audit</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all shadow-sm">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        
        <div className="flex-1 p-4 sm:p-10 md:p-14 bg-white print-scroll-container">
          <div className="max-w-2xl mx-auto font-serif text-black bg-white printable-area">
            <div className="text-center mb-8">
               <h1 className="text-3xl font-black uppercase mb-1">{settings?.canteenName || 'CAFE UAV'}</h1>
               <p className="text-[10px] font-bold uppercase tracking-widest border-b-2 border-black inline-block pb-1">মাসিক বিল বিবরণী</p>
            </div>

            <table className="w-full border-2 border-black border-collapse text-sm md:text-base mb-0">
              <tbody>
                <tr>
                  <td className="border-2 border-black p-2 md:p-3 font-bold w-1/3">মাসের নাম</td>
                  <td className="border-2 border-black p-2 md:p-3 text-center font-bold">{monthLabel}</td>
                </tr>
                <tr>
                  <td className="border-2 border-black p-2 md:p-3 font-bold">পদবী ও নাম</td>
                  <td className="border-2 border-black p-2 md:p-3 text-center font-bold uppercase">{displayName} ({customer.uid})</td>
                </tr>
              </tbody>
            </table>

            <table className="w-full border-2 border-black border-collapse mt-0 text-sm md:text-base">
              <thead>
                <tr className="bg-slate-50 print:bg-transparent">
                  <th className="border-2 border-black p-2 text-center font-bold w-[40%]">দ্রব্যের নাম</th>
                  <th className="border-2 border-black p-2 text-center font-bold w-[20%]">পরিমাণ</th>
                  <th className="border-2 border-black p-2 text-center font-bold w-[20%]">দর</th>
                  <th className="border-2 border-black p-2 text-center font-bold w-[20%]">টাকা</th>
                </tr>
              </thead>
              <tbody>
                {processedItems.length > 0 ? processedItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border-2 border-black p-2 font-medium uppercase tracking-tighter">{item.name}</td>
                    <td className="border-2 border-black p-2 text-center font-bold">{item.qty}</td>
                    <td className="border-2 border-black p-2 text-center">{item.rate.toFixed(2)}</td>
                    <td className="border-2 border-black p-2 text-right pr-4 font-bold">{item.total.toFixed(2)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="border-2 border-black p-2 text-center italic opacity-30 text-xs">এই মাসে কোনো ক্যান্টিন খরচ নেই</td>
                  </tr>
                )}
                
                <tr className="bg-slate-50/30">
                  <td colSpan={3} className="border-2 border-black p-2 text-center font-bold">মোট ক্যান্টিন বিল (খাবার)</td>
                  <td className="border-2 border-black p-2 text-right pr-4 font-black">{canteenFoodTotal.toFixed(2)}</td>
                </tr>
                
                {specialFunds.unitFund > 0 && (
                  <tr>
                    <td colSpan={3} className="border-2 border-black p-2 text-center font-bold">ইউনিট ফান্ড</td>
                    <td className="border-2 border-black p-2 text-right pr-4 font-bold">{specialFunds.unitFund.toFixed(2)}</td>
                  </tr>
                )}

                {specialFunds.carWash > 0 && (
                  <tr>
                    <td colSpan={3} className="border-2 border-black p-2 text-center font-bold">গাড়ি ওয়াশ</td>
                    <td className="border-2 border-black p-2 text-right pr-4 font-bold">{specialFunds.carWash.toFixed(2)}</td>
                  </tr>
                )}

                {specialFunds.others > 0 && (
                  <tr>
                    <td colSpan={3} className="border-2 border-black p-2 text-center font-bold">অন্যান্য</td>
                    <td className="border-2 border-black p-2 text-right pr-4 font-bold">{specialFunds.others.toFixed(2)}</td>
                  </tr>
                )}

                <tr className="bg-slate-100/50">
                  <td colSpan={3} className="border-2 border-black p-2 text-center font-bold uppercase italic">চলতি মাসের মোট (Subtotal)</td>
                  <td className="border-2 border-black p-2 text-right pr-4 font-black">{currentMonthBillTotal.toFixed(2)}</td>
                </tr>
                
                {monthlyPayments > 0 && (
                  <tr className="text-emerald-700 italic">
                    <td colSpan={3} className="border-2 border-black p-2 text-center font-bold">পরিশোধ/জমা (চলতি মাস)</td>
                    <td className="border-2 border-black p-2 text-right pr-4 font-bold">- {monthlyPayments.toFixed(2)}</td>
                  </tr>
                )}
                
                <tr className="bg-slate-200 print:bg-transparent">
                  <td colSpan={3} className="border-2 border-black p-2 md:p-3 text-center font-black text-lg md:text-xl uppercase">সর্বমোট প্রদেয়</td>
                  <td className="border-2 border-black p-2 md:p-3 text-right pr-4 font-black text-lg md:text-xl">৳{totalOutstandingBalance.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-16 md:mt-24 flex justify-between px-2 md:px-10">
              <div className="text-center pt-8 md:pt-10 border-t border-black w-32 md:w-48 text-xs md:text-base">গ্রাহকের স্বাক্ষর</div>
              <div className="text-center pt-8 md:pt-10 border-t border-black w-32 md:w-48 font-bold text-xs md:text-base">ম্যানেজার</div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:gap-4 no-print shadow-xl">
          <button 
            type="button"
            onClick={handlePrint}
            className="flex-1 bg-slate-900 text-white py-4 sm:py-5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-3 shadow-2xl hover:bg-black transition-all active:scale-[0.98]"
          >
            <Printer size={20} /> PRINT / SAVE PDF
          </button>
          <button 
            type="button"
            onClick={handleWhatsAppShare}
            className="flex-1 bg-emerald-600 text-white py-4 sm:py-5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-3 shadow-2xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-[0.98]"
          >
            <Share2 size={20} /> WHATSAPP SHARE
          </button>
          <button onClick={onClose} className="sm:px-8 bg-white text-slate-400 py-4 sm:py-5 rounded-2xl font-black text-xs sm:text-sm border-2 border-slate-100 hover:bg-slate-50 transition-all">DISMISS</button>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body { height: auto !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
          #root { display: none !important; }
          .no-print { display: none !important; }
          .no-print-overlay { 
            display: block !important; 
            position: absolute !important; 
            top: 0 !important; 
            left: 0 !important; 
            width: 100% !important; 
            height: auto !important;
            background: white !important;
            z-index: 1000 !important;
          }
          .print-modal-container { 
            position: relative !important; 
            width: 100% !important; 
            height: auto !important; 
            max-width: none !important; 
            box-shadow: none !important; 
            border: none !important; 
            background: white !important;
            margin: 0 !important;
          }
          .print-scroll-container { 
            display: block !important; 
            overflow: visible !important; 
            padding: 0 !important; 
            background: white !important;
          }
          .printable-area { 
            display: block !important; 
            width: 100% !important; 
            box-shadow: none !important; 
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default StatementModal;
