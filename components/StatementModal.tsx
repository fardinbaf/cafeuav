
import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../db';
import { Customer, Transaction, InventoryItem, PaymentType } from '../types';
import { X, Printer, Share2, Calculator, Loader2 } from 'lucide-react';

interface StatementModalProps {
  customer: Customer;
  onClose: () => void;
}

const StatementModal: React.FC<StatementModalProps> = ({ customer: initialCustomer, onClose }) => {
  const [settings, setSettings] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatementData = async () => {
      setLoading(true);
      try {
        const [
          { data: configData },
          { data: transData },
          { data: freshCust }
        ] = await Promise.all([
          supabase.from('settings').select('value').eq('key', 'config').single(),
          supabase.from('transactions').select('*').eq('customer_id', initialCustomer.id),
          supabase.from('customers').select('*').eq('id', initialCustomer.id).single()
        ]);

        if (configData) setSettings(configData.value);
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
    const monthlyBakiSales = thisMonthTrans.filter(t => t.type === 'sale' && t.payment_type === PaymentType.BAKI);
    const monthlyPaymentsSum = thisMonthTrans.filter(t => t.type === 'payment').reduce((acc, t) => acc + Number(t.total_amount), 0);
    
    const itemMap = new Map<string, { name: string, qty: number, rate: number }>();
    const funds = { unitFund: 0, carWash: 0, others: 0 };

    monthlyBakiSales.forEach(t => {
      t.items.forEach(item => {
        if (item.item_name === 'Unit Fund') {
          funds.unitFund += (item.price * item.quantity);
        } else if (item.item_name === 'Car Wash') {
          funds.carWash += (item.price * item.quantity);
        } else if (item.item_name === 'Others') {
          funds.others += (item.price * item.quantity);
        } else {
          const key = `${item.item_name}_${item.price}`;
          const existing = itemMap.get(key);
          if (existing) {
            existing.qty += item.quantity;
          } else {
            itemMap.set(key, { name: item.item_name, qty: item.quantity, rate: item.price });
          }
        }
      });
    });

    const items = Array.from(itemMap.values()).map(data => ({
      ...data,
      total: data.qty * data.rate
    }));

    return {
      processedItems: items,
      canteenFoodTotal: items.reduce((acc, i) => acc + i.total, 0),
      specialFunds: funds,
      monthlyPayments: monthlyPaymentsSum
    };
  }, [transactions]);

  const totalBakiThisMonth = canteenFoodTotal + specialFunds.unitFund + specialFunds.carWash + specialFunds.others;
  const previousArrears = useMemo(() => {
    return Number(customer.total_baki) - (totalBakiThisMonth - monthlyPayments);
  }, [customer.total_baki, totalBakiThisMonth, monthlyPayments]);

  const grandTotal = Number(customer.total_baki);

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
    if (previousArrears !== 0) message += `${index++}. পূর্বের বকেয়া: ৳${previousArrears.toFixed(2)}\n`;
    if (monthlyPayments > 0) message += `${index++}. পরিশোধ (এই মাস): -৳${monthlyPayments.toFixed(2)}\n`;

    message += `--------------------------\n` +
      `*সর্বমোট প্রদেয়: ৳${grandTotal.toFixed(2)}*\n\n` +
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

  return (
    <div className="fixed inset-0 z-[200] flex justify-center items-start p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md no-print overflow-y-auto pt-8 sm:pt-20">
      <div className="bg-white w-full max-w-2xl rounded-[32px] md:rounded-[48px] shadow-2xl overflow-hidden flex flex-col h-auto mb-10 animate-in slide-in-from-top-4 duration-300">
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
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-10 md:p-14 bg-white printable-area">
          <div className="max-w-2xl mx-auto font-serif text-black bg-white">
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
                    <td colSpan={4} className="border-2 border-black p-2 text-center italic opacity-30 text-xs">No food items recorded this month</td>
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
                
                {previousArrears !== 0 && (
                  <tr className="opacity-70 italic">
                    <td colSpan={3} className="border-2 border-black p-2 text-center font-bold text-sm md:text-base">পূর্বের বকেয়া/ব্যালেন্স</td>
                    <td className="border-2 border-black p-2 text-right pr-4 font-bold text-sm md:text-base">{previousArrears.toFixed(2)}</td>
                  </tr>
                )}

                {monthlyPayments > 0 && (
                  <tr className="text-emerald-700 italic">
                    <td colSpan={3} className="border-2 border-black p-2 text-center font-bold">পরিশোধ/জমা (চলতি মাস)</td>
                    <td className="border-2 border-black p-2 text-right pr-4 font-bold">- {monthlyPayments.toFixed(2)}</td>
                  </tr>
                )}
                
                <tr className="bg-slate-100 print:bg-transparent">
                  <td colSpan={3} className="border-2 border-black p-2 md:p-3 text-center font-black text-lg md:text-xl uppercase">সর্বমোট প্রদেয়</td>
                  <td className="border-2 border-black p-2 md:p-3 text-right pr-4 font-black text-lg md:text-xl">৳{grandTotal.toFixed(2)}</td>
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
          body > #root { display: none !important; }
          body { visibility: hidden !important; background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .printable-area { 
            visibility: visible !important; 
            display: block !important;
            position: absolute !important; 
            left: 50% !important; 
            top: 0 !important; 
            transform: translateX(-50%) !important;
            width: 100% !important; 
            max-width: 170mm !important;
            margin: 0 !important; 
            padding: 0 !important; 
            overflow: visible !important; 
          }
          .printable-area * { visibility: visible !important; }
        }
      `}</style>
    </div>
  );
};

export default StatementModal;
