
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../db';
import { Customer, Transaction, InventoryItem } from '../types';
import { X, Printer, FileText, Banknote } from 'lucide-react';

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
  const [globalUnitFund, setGlobalUnitFund] = useState<number>(0);
  const [globalCarWash, setGlobalCarWash] = useState<number>(0);

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

  const bengaliMonths = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  const monthLabel = `${bengaliMonths[month]} ${year}`;

  const startOfMonth = useMemo(() => new Date(year, month, 1).getTime(), [month, year]);
  const endOfMonth = useMemo(() => new Date(year, month + 1, 0, 23, 59, 59, 999).getTime(), [month, year]);

  const uniqueItemNames = useMemo(() => {
    const names = new Set<string>();
    transactions.forEach(t => {
      if (t.timestamp >= startOfMonth && t.timestamp <= endOfMonth && t.type !== 'payment') {
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
    if (!customers.length || !transactions.length || !inventory.length) return [];

    return customers.map(customer => {
      const customerTrans = transactions.filter(t => 
        t.customer_id === customer.id && 
        t.timestamp >= startOfMonth && 
        t.timestamp <= endOfMonth
      );

      const salesTrans = customerTrans.filter(t => t.type !== 'payment');
      const paymentsTrans = customerTrans.filter(t => t.type === 'payment');
      const monthlyPayments = paymentsTrans.reduce((sum, t) => sum + Number(t.total_amount), 0);

      const itemConsumption: Record<string, number> = {};
      salesTrans.forEach(t => {
        t.items.forEach(item => {
          if (!['Unit Fund', 'Car Wash', 'Others'].includes(item.item_name)) {
            itemConsumption[item.item_name] = (itemConsumption[item.item_name] || 0) + item.quantity;
          }
        });
      });

      const currentMonthBill = Object.entries(itemConsumption).reduce((sum, [name, qty]) => {
        const invItem = inventory.find(i => i.item_name === name);
        const rate = invItem ? invItem.price : 0;
        return sum + (qty * rate);
      }, 0);

      const openingArrears = Number(customer.total_baki) + monthlyPayments - currentMonthBill;
      const total = Number(customer.total_baki) + globalUnitFund + globalCarWash;
      const adminDisplayName = customer.uid.length <= 5 ? `${customer.name} Sir` : customer.name;

      return {
        uid: customer.uid,
        name: adminDisplayName,
        itemConsumption,
        canteenBill: currentMonthBill,
        paid: monthlyPayments,
        arrears: openingArrears,
        total
      };
    }).filter(row => row.canteenBill > 0 || Math.abs(row.arrears) > 0.01 || row.paid > 0);
  }, [customers, transactions, inventory, startOfMonth, endOfMonth, globalUnitFund, globalCarWash]);

  const totals = useMemo(() => {
    return reportData.reduce((acc, row) => ({
      canteen: acc.canteen + row.canteenBill,
      paid: acc.paid + row.paid,
      arrears: acc.arrears + row.arrears,
      grand: acc.grand + row.total
    }), { canteen: 0, paid: 0, arrears: 0, grand: 0 });
  }, [reportData]);

  const handlePrint = () => window.print();

  if (loading) return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white p-10 rounded-[40px] shadow-2xl animate-pulse font-black text-slate-400">LOADING MATRIX...</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-md no-print">
      <div className="bg-white w-full max-w-[98vw] rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-[98vh] animate-in zoom-in duration-300">
        <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px] md:text-xs">Matrix Financial Report</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Cross-Device Reconciliation</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
             <div className="flex-1 sm:flex-none flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700">
               <span className="text-[8px] md:text-[10px] font-black text-slate-400 whitespace-nowrap uppercase">Unit Fund</span>
               <input type="number" className="w-12 md:w-16 text-xs md:text-sm font-bold outline-none bg-transparent text-white border-b border-white/20" value={globalUnitFund} onChange={e => setGlobalUnitFund(Number(e.target.value))} />
             </div>
             <div className="flex-1 sm:flex-none flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700">
               <span className="text-[8px] md:text-[10px] font-black text-slate-400 whitespace-nowrap uppercase">Car Wash</span>
               <input type="number" className="w-12 md:w-16 text-xs md:text-sm font-bold outline-none bg-transparent text-white border-b border-white/20" value={globalCarWash} onChange={e => setGlobalCarWash(Number(e.target.value))} />
             </div>
             <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={handlePrint} className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 md:px-6 py-2.5 rounded-xl font-black text-[10px] md:text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg"><Printer size={14} /> PRINT</button>
                <button onClick={onClose} className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all shadow-sm"><X size={18} className="text-slate-400" /></button>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2 md:p-12 bg-slate-100 custom-scrollbar">
          <div className="bg-white p-4 sm:p-[10mm] shadow-sm mx-auto w-fit min-w-full printable-area">
            <div className="font-serif text-black bg-white">
              <div className="text-center mb-6">
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter mb-1">{settings?.canteenName || 'CAFE UAV'}</h2>
                <h3 className="text-base md:text-xl font-bold border-b-2 border-black inline-block px-4 md:px-8 pb-1 mb-2">মাসিক মাস্টার বিল ও পণ্যভিত্তিক বিস্তারিত বিবরণী - {monthLabel}</h3>
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
                      <th className="border border-black p-1 text-right font-bold bg-emerald-50 text-emerald-800">জমা (Paid)</th>
                      <th className="border border-black p-1 text-right font-bold bg-slate-100">বকেয়া (Prev)</th>
                      <th className="border border-black p-1 text-right font-bold bg-slate-100">ফান্ড</th>
                      <th className="border border-black p-1 text-right font-bold text-xs bg-slate-200">সর্বমোট</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="border border-black p-1 text-center">{idx + 1}</td>
                        <td className="border border-black p-1 text-center font-mono font-bold">{row.uid}</td>
                        <td className="border border-black p-1 font-bold truncate max-w-[120px]">{row.name}</td>
                        {uniqueItemNames.map((itemName, iIdx) => {
                          const qty = row.itemConsumption[itemName];
                          return <td key={iIdx} className={`border border-black p-1 text-center font-mono ${qty ? 'bg-indigo-50/30 font-bold' : 'opacity-20'}`}>{qty || '-'}</td>;
                        })}
                        <td className="border border-black p-1 text-right font-mono">{row.canteenBill.toFixed(2)}</td>
                        <td className="border border-black p-1 text-right font-mono text-emerald-700">{row.paid > 0 ? `-${row.paid.toFixed(2)}` : '0.00'}</td>
                        <td className="border border-black p-1 text-right font-mono">{row.arrears.toFixed(2)}</td>
                        <td className="border border-black p-1 text-right font-mono">{(globalUnitFund + globalCarWash) || '0'}</td>
                        <td className="border border-black p-1 text-right font-black font-mono text-[11px] bg-slate-50">{row.total.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-200 print:bg-slate-100 font-black">
                      <td colSpan={3 + uniqueItemNames.length} className="border border-black p-1.5 md:p-2 text-right">মোট (Totals)</td>
                      <td className="border border-black p-1.5 md:p-2 text-right font-mono">{totals.canteen.toFixed(2)}</td>
                      <td className="border border-black p-1.5 md:p-2 text-right font-mono text-emerald-800">-{totals.paid.toFixed(2)}</td>
                      <td className="border border-black p-1.5 md:p-2 text-right font-mono">{totals.arrears.toFixed(2)}</td>
                      <td className="border border-black p-1.5 md:p-2 text-right font-mono">{((globalUnitFund + globalCarWash) * reportData.length).toFixed(2)}</td>
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
          @page { size: A4 landscape; margin: 5mm; }
          body { visibility: hidden !important; background: white !important; }
          .no-print { display: none !important; }
          .printable-area { visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          .printable-area * { visibility: visible !important; }
        }
      `}</style>
    </div>
  );
};

export default MasterReportModal;
