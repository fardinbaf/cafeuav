
import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../db';
import { PaymentType, Transaction, InventoryItem } from '../types.ts';
import { FileText, Calendar, ArrowDownLeft, ShoppingCart, Printer, FileSpreadsheet, ChevronDown, History, Info } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import MasterReportModal from '../components/MasterReportModal';

const Reports: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reprintTransaction, setReprintTransaction] = useState<Transaction | null>(null);
  const [showMasterReport, setShowMasterReport] = useState(false);
  const [loading, setLoading] = useState(true);

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = [2024, 2025, 2026];

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      const [{ data: trans }, { data: inv }] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('inventory').select('*')
      ]);
      if (trans) setTransactions(trans as Transaction[]);
      if (inv) setInventory(inv as InventoryItem[]);
      setLoading(false);
    };
    fetchReports();
  }, []);

  const reportData = useMemo(() => {
    if (!transactions.length) return null;

    const filtered = transactions.filter(t => {
      const d = new Date(t.timestamp);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    const summary = {
      sales: 0,
      collections: 0,
      bakiAdded: 0,
      cashReceived: 0,
      ucbReceived: 0,
      count: filtered.length
    };

    filtered.forEach(t => {
      let effectiveTotal = t.total_amount;
      if (t.type !== 'payment') {
        effectiveTotal = t.items.reduce((acc, item) => {
          const currentPrice = inventory.find(inv => inv.item_name === item.item_name)?.price ?? item.price;
          return acc + (currentPrice * item.quantity);
        }, 0);
      }

      if (t.type === 'payment') {
        summary.collections += t.total_amount;
        if (t.payment_type === PaymentType.CASH) summary.cashReceived += t.total_amount;
        if (t.payment_type === PaymentType.UCB) summary.ucbReceived += t.total_amount;
      } else {
        summary.sales += effectiveTotal;
        if (t.payment_type === PaymentType.BAKI) summary.bakiAdded += effectiveTotal;
        else if (t.payment_type === PaymentType.CASH) summary.cashReceived += effectiveTotal;
        else if (t.payment_type === PaymentType.UCB) summary.ucbReceived += effectiveTotal;
      }
    });

    return { filtered, summary };
  }, [transactions, inventory, selectedMonth, selectedYear]);

  if (loading) return <div className="p-10 text-center animate-pulse text-slate-400 font-black uppercase tracking-widest text-xs">Fetching Audit Data...</div>;

  return (
    <div className="space-y-6 pb-24 lg:pb-20 px-2 lg:px-0">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">Financial Audit</h2>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1">Central Ledger Node</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <button onClick={() => setShowMasterReport(true)} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all uppercase tracking-widest">MASTER REPORT</button>
          
          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
            <select className="px-4 py-4 rounded-2xl border bg-white font-bold text-xs outline-none focus:ring-2 ring-indigo-50" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
              {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select className="px-4 py-4 rounded-2xl border bg-white font-bold text-xs outline-none focus:ring-2 ring-indigo-50" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {reportData && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
            <div className="bg-white p-4 lg:p-6 rounded-[28px] border shadow-sm border-b-4 border-b-slate-200">
              <div className="text-slate-400 text-[8px] lg:text-[9px] font-black uppercase mb-1 tracking-widest">Sales Total</div>
              <div className="text-lg lg:text-2xl font-black text-slate-800">৳{reportData.summary.sales.toLocaleString()}</div>
            </div>
            <div className="bg-emerald-50 p-4 lg:p-6 rounded-[28px] border border-emerald-100 shadow-sm border-b-4 border-b-emerald-200">
              <div className="text-emerald-500 text-[8px] lg:text-[9px] font-black uppercase mb-1 tracking-widest">Collections</div>
              <div className="text-lg lg:text-2xl font-black text-emerald-700">৳{reportData.summary.collections.toLocaleString()}</div>
            </div>
            <div className="bg-rose-50 p-4 lg:p-6 rounded-[28px] border border-rose-100 shadow-sm border-b-4 border-b-rose-200">
              <div className="text-rose-400 text-[8px] lg:text-[9px] font-black uppercase mb-1 tracking-widest">New Baki</div>
              <div className="text-lg lg:text-2xl font-black text-rose-700">৳{reportData.summary.bakiAdded.toLocaleString()}</div>
            </div>
            <div className="bg-indigo-50 p-4 lg:p-6 rounded-[28px] border border-indigo-100 shadow-sm border-b-4 border-b-indigo-200">
              <div className="text-indigo-500 text-[8px] lg:text-[9px] font-black uppercase mb-1 tracking-widest">Net Cash</div>
              <div className="text-lg lg:text-2xl font-black text-indigo-700">৳{reportData.summary.cashReceived.toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-white rounded-[32px] lg:rounded-[40px] border shadow-xl overflow-hidden relative">
            <div className="px-6 lg:px-8 py-5 border-b flex justify-between bg-slate-50/50">
              <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 text-sm lg:text-base">
                <History size={18} className="text-indigo-600" /> Audit Trail
              </h3>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <Info size={14} className="lg:hidden animate-pulse" /> 
                <span>{reportData.filtered.length} Records</span>
              </div>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[700px]">
                <thead className="bg-slate-50 text-slate-400 text-[9px] lg:text-[10px] font-black uppercase tracking-widest border-b">
                  <tr>
                    <th className="px-6 py-5">Date</th>
                    <th className="px-6 py-5">Type</th>
                    <th className="px-6 py-5">Items / Narration</th>
                    <th className="px-6 py-5">Gateway</th>
                    <th className="px-6 py-5 text-right">Credit/Debit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...reportData.filtered].reverse().map(t => {
                     const liveVal = t.type === 'payment' 
                      ? t.total_amount 
                      : t.items.reduce((acc, i) => acc + ((inventory.find(inv => inv.item_name === i.item_name)?.price ?? i.price) * i.quantity), 0);
                      
                     return (
                      <tr key={t.id} className="text-xs hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-5 text-slate-400 font-mono">{new Date(t.timestamp).toLocaleDateString()}</td>
                        <td className="px-6 py-5">
                          <span className={`px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest ${t.type === 'payment' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                            {t.type === 'payment' ? 'COLLECTION' : 'CREDIT SALE'}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-slate-600 font-bold max-w-xs truncate group-hover:overflow-visible group-hover:whitespace-normal group-hover:max-w-none">
                          {t.type === 'payment' ? 'Manual Settlement' : t.items.map(i => i.item_name).join(', ')}
                        </td>
                        <td className="px-6 py-5"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.payment_type}</span></td>
                        <td className={`px-6 py-5 text-right font-black text-sm ${t.type === 'payment' ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {t.type === 'payment' ? '-' : ''}৳{liveVal.toLocaleString()}
                        </td>
                      </tr>
                     );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile Scroll Hint */}
            <div className="lg:hidden p-3 bg-slate-50 border-t text-center">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">← Swipe to view details →</p>
            </div>
          </div>
        </>
      )}

      {reprintTransaction && <ReceiptModal transaction={reprintTransaction} onClose={() => setReprintTransaction(null)} />}
      {showMasterReport && <MasterReportModal month={selectedMonth} year={selectedYear} onClose={() => setShowMasterReport(false)} />}
    </div>
  );
};

export default Reports;
