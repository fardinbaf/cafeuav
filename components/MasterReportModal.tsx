
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../db';
import { Customer, Transaction, InventoryItem, PaymentType } from '../types';
import { X, Printer, FileText } from 'lucide-react';

interface MasterReportModalProps {
  onClose: () => void;
  month: number;
  year: number;
}

const MasterReportModal: React.FC<MasterReportModalProps> = ({ onClose, month, year }) => {
  const [settings, setSettings] = useState<any>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [
          { data: configData },
          { data: custData },
          { data: transData },
          { data: invData }
        ] = await Promise.all([
          supabase.from('settings').select('value').eq('key', 'config').single(),
          supabase.from('customers').select('*').order('name', { ascending: true }),
          supabase.from('transactions').select('*'),
          supabase.from('inventory').select('*')
        ]);

        if (configData) setSettings(configData.value);
        if (custData) setCustomers(custData as Customer[]);
        if (transData) setTransactions(transData as Transaction[]);
        if (invData) setInventory(invData as InventoryItem[]);
      } catch (err) {
        console.error("Master report error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const bengaliMonths = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  const monthLabel = `${bengaliMonths[month]} ${year}`;

  const startOfMonth = useMemo(() => new Date(year, month, 1).getTime(), [month, year]);
  const endOfMonth = useMemo(() => new Date(year, month + 1, 0, 23, 59, 59, 999).getTime(), [month, year]);

  const uniqueItemNames = useMemo(() => {
    const names = new Set<string>();
    transactions.forEach(t => {
      if (t.timestamp >= startOfMonth && t.timestamp <= endOfMonth && t.type === 'sale') {
        t.items.forEach(item => {
          if (!['Unit Fund', 'Car Wash', 'Others'].includes(item.item_name)) {
            names.add(item.item_name);
          }
        });
      }
    });
    return Array.from(names).sort();
  }, [transactions, startOfMonth, endOfMonth]);

  const reportData = useMemo(() => {
    if (!customers.length || !transactions.length) return [];

    return customers.map(customer => {
      const customerTrans = transactions.filter(t => t.customer_id === customer.id);
      
      const thisMonthTrans = customerTrans.filter(t => 
        t.timestamp >= startOfMonth && t.timestamp <= endOfMonth
      );

      const salesTrans = thisMonthTrans.filter(t => t.type === 'sale');
      const paymentsTrans = thisMonthTrans.filter(t => t.type === 'payment');
      
      const explicitPayments = paymentsTrans.reduce((sum, t) => sum + Number(t.total_amount), 0);
      
      // Dynamic upfront calculation
      const upfrontPayments = salesTrans
        .filter(t => t.payment_type !== PaymentType.BAKI)
        .reduce((sum, t) => {
          const liveTotal = t.items.reduce((acc, i) => acc + ((inventory.find(inv => inv.item_name === i.item_name)?.price ?? i.price) * i.quantity), 0);
          return sum + liveTotal;
        }, 0);
      
      const totalPaymentsThisMonth = explicitPayments + upfrontPayments;

      const itemConsumption: Record<string, number> = {};
      let monthlyCanteenTotal = 0;
      let monthlyFundTotal = 0;

      salesTrans.forEach(t => {
        t.items.forEach(item => {
          if (['Unit Fund', 'Car Wash', 'Others'].includes(item.item_name)) {
            monthlyFundTotal += (item.price * item.quantity);
          } else {
            // Dynamic Lookup for monthly total
            const livePrice = inventory.find(inv => inv.item_name === item.item_name)?.price ?? item.price;
            itemConsumption[item.item_name] = (itemConsumption[item.item_name] || 0) + item.quantity;
            monthlyCanteenTotal += (livePrice * item.quantity);
          }
        });
      });

      const adminDisplayName = customer.uid.length <= 5 ? `${customer.name} Sir` : customer.name;

      // Dynamic Global Balance Calculation
      const totalSales = customerTrans.filter(t => t.type === 'sale' && t.payment_type === PaymentType.BAKI)
        .reduce((sum, t) => {
          const liveVal = t.items.reduce((acc, i) => acc + ((inventory.find(inv => inv.item_name === i.item_name)?.price ?? i.price) * i.quantity), 0);
          return sum + liveVal;
        }, 0);
        
      const totalPayments = customerTrans.filter(t => t.type === 'payment')
        .reduce((sum, t) => sum + Number(t.total_amount), 0);
        
      const currentTotalBalance = totalSales - totalPayments;

      return {
        uid: customer.uid,
        name: adminDisplayName,
        itemConsumption,
        canteenBill: monthlyCanteenTotal,
        paid: totalPaymentsThisMonth,
        fund: monthlyFundTotal,
        total: currentTotalBalance
      };
    }).filter(row => row.canteenBill > 0 || Math.abs(row.total) > 0.01 || row.paid > 0 || row.fund > 0);
  }, [customers, transactions, inventory, startOfMonth, endOfMonth]);

  const totals = useMemo(() => {
    return reportData.reduce((acc, row) => ({
      canteen: acc.canteen + row.canteenBill,
      paid: acc.paid + row.paid,
      fund: acc.fund + row.fund,
      grand: acc.grand + row.total
    }), { canteen: 0, paid: 0, fund: 0, grand: 0 });
  }, [reportData]);

  const handlePrint = () => window.print();

  if (loading) return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white p-10 rounded-[40px] shadow-2xl animate-pulse font-black text-slate-400">LOADING MATRIX...</div>
    </div>
  );

  const modalContent = (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-md no-print-overlay">
      <div className="bg-white w-full max-w-[98vw] rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-[98vh] animate-in zoom-in duration-300 print-modal-container">
        <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-4 sm:items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px] md:text-xs">Matrix Financial Report</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Consolidated Monthly Ledger</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
             <button onClick={handlePrint} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg"><Printer size={14} /> PRINT REPORT</button>
             <button onClick={onClose} className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all shadow-sm"><X size={18} className="text-slate-400" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2 md:p-12 bg-slate-100 custom-scrollbar print-scroll-container">
          <div className="bg-white p-4 sm:p-[10mm] shadow-sm mx-auto w-fit min-w-full printable-area">
            <div className="font-serif text-black bg-white">
              <div className="text-center mb-6">
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter mb-1">{settings?.canteenName || 'CAFE UAV'}</h2>
                <h3 className="text-base md:text-xl font-bold border-b-2 border-black inline-block px-4 md:px-8 pb-1 mb-2">মাসিক মাস্টার বিল বিবরণী - {monthLabel}</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border-2 border-black text-[9px] md:text-[10px] leading-tight">
                  <thead>
                    <tr className="bg-slate-100 print:bg-slate-200">
                      <th className="border border-black p-1 text-center font-bold">ক্রঃ</th>
                      <th className="border border-black p-1 text-center font-bold">আইডি</th>
                      <th className="border border-black p-1 text-left font-bold">সদস্যের নাম</th>
                      {uniqueItemNames.map((itemName, idx) => (
                        <th key={idx} className="border border-black p-1 text-center font-bold bg-slate-50 min-w-[28px]">
                          <div className="writing-mode-vertical whitespace-nowrap overflow-hidden text-ellipsis max-h-24">{itemName}</div>
                        </th>
                      ))}
                      <th className="border border-black p-1 text-right font-bold bg-slate-100">ক্যান্টিন বিল</th>
                      <th className="border border-black p-1 text-right font-bold bg-slate-50">ফান্ড বিল</th>
                      <th className="border border-black p-1 text-right font-bold bg-emerald-50 text-emerald-800">জমা (Paid)</th>
                      <th className="border border-black p-1 text-right font-bold text-xs bg-slate-200">সর্বমোট প্রদেয়</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="border border-black p-1 text-center">{idx + 1}</td>
                        <td className="border border-black p-1 text-center font-mono font-bold">{row.uid}</td>
                        <td className="border border-black p-1 font-bold truncate max-w-[120px] uppercase">{row.name}</td>
                        {uniqueItemNames.map((itemName, iIdx) => {
                          const qty = row.itemConsumption[itemName];
                          return <td key={iIdx} className={`border border-black p-1 text-center font-mono ${qty ? 'bg-indigo-50/30 font-bold' : 'opacity-20'}`}>{qty || '-'}</td>;
                        })}
                        <td className="border border-black p-1 text-right font-mono">{row.canteenBill.toFixed(2)}</td>
                        <td className="border border-black p-1 text-right font-mono">{row.fund.toFixed(2)}</td>
                        <td className="border border-black p-1 text-right font-mono text-emerald-700">{row.paid > 0 ? `-${row.paid.toFixed(2)}` : '0.00'}</td>
                        <td className="border border-black p-1 text-right font-black font-mono text-[11px] bg-slate-50">৳{row.total.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-200 print:bg-slate-100 font-black">
                      <td colSpan={3 + uniqueItemNames.length} className="border border-black p-1.5 md:p-2 text-right">মোট (Totals)</td>
                      <td className="border border-black p-1.5 md:p-2 text-right font-mono">{totals.canteen.toFixed(2)}</td>
                      <td className="border border-black p-1.5 md:p-2 text-right font-mono">{totals.fund.toFixed(2)}</td>
                      <td className="border border-black p-1.5 md:p-2 text-right font-mono text-emerald-800">-{totals.paid.toFixed(2)}</td>
                      <td className="border border-black p-1.5 md:p-2 text-right font-black font-mono text-xs bg-slate-50">৳{totals.grand.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-8 md:mt-12 flex justify-between px-4 md:px-20 page-break-avoid">
                <div className="text-center pt-4 md:pt-6 border-t border-black w-24 md:w-48 text-[8px] md:text-[9px] uppercase font-bold">প্রস্তুতকারক</div>
                <div className="text-center pt-4 md:pt-6 border-t border-black w-24 md:w-48 text-[8px] md:text-[9px] uppercase font-bold">ম্যানেজার</div>
                <div className="text-center pt-4 md:pt-6 border-t border-black w-24 md:w-48 text-[8px] md:text-[9px] uppercase font-bold">অনুমোদনকারী</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .writing-mode-vertical { writing-mode: vertical-rl; transform: rotate(180deg); text-orientation: mixed; font-size: 7px; line-height: 1; }
        @media (min-width: 768px) { .writing-mode-vertical { font-size: 8px; } }
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
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

export default MasterReportModal;
