
import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../db';
import { PaymentType, Transaction } from '../types';
import { FileText, Calendar, ArrowDownLeft, ShoppingCart, Printer, FileSpreadsheet, ChevronDown, History } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import MasterReportModal from '../components/MasterReportModal';

const Reports: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
      const { data } = await supabase.from('transactions').select('*');
      if (data) setTransactions(data as Transaction[]);
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
      if (t.type === 'payment') {
        summary.collections += t.total_amount;
        if (t.payment_type === PaymentType.CASH) summary.cashReceived += t.total_amount;
        if (t.payment_type === PaymentType.UCB) summary.ucbReceived += t.total_amount;
      } else {
        summary.sales += t.total_amount;
        if (t.payment_type === PaymentType.BAKI) summary.bakiAdded += t.total_amount;
        else if (t.payment_type === PaymentType.CASH) summary.cashReceived += t.total_amount;
        else if (t.payment_type === PaymentType.UCB) summary.ucbReceived += t.total_amount;
      }
    });

    return { filtered, summary };
  }, [transactions, selectedMonth, selectedYear]);

  if (loading) return <div className="p-10 text-center animate-pulse text-slate-400">Fetching reports...</div>;

  return (
    <div className="space-y-6 pb-24 md:pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pr-14 lg:pr-0">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Financial Reports</h2>
          <p className="text-slate-500 font-medium text-sm">Central Audit Logs</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <button onClick={() => setShowMasterReport(true)} className="bg-indigo-600 text-white px-5 py-4 rounded-2xl font-black text-xs shadow-xl">MASTER REPORT</button>
          
          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
            <select className="px-4 py-4 rounded-2xl border bg-white font-bold" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
              {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select className="px-4 py-4 rounded-2xl border bg-white font-bold" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {reportData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
              <div className="text-slate-400 text-[10px] font-black uppercase mb-1">Monthly Sales</div>
              <div className="text-2xl font-black text-slate-800">৳{reportData.summary.sales.toLocaleString()}</div>
            </div>
            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 shadow-sm">
              <div className="text-emerald-500 text-[10px] font-black uppercase mb-1">Collections</div>
              <div className="text-2xl font-black text-emerald-700">৳{reportData.summary.collections.toLocaleString()}</div>
            </div>
            <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 shadow-sm">
              <div className="text-rose-400 text-[10px] font-black uppercase mb-1">New Baki</div>
              <div className="text-2xl font-black text-rose-700">৳{reportData.summary.bakiAdded.toLocaleString()}</div>
            </div>
            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 shadow-sm">
              <div className="text-indigo-500 text-[10px] font-black uppercase mb-1">Net Liquid</div>
              <div className="text-2xl font-black text-indigo-700">৳{reportData.summary.cashReceived.toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-white rounded-[40px] border shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b flex justify-between bg-slate-50/50">
              <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <History size={18} className="text-indigo-600" /> Audit Trail
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Details</th>
                    <th className="px-6 py-4">Payment</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...reportData.filtered].reverse().map(t => (
                    <tr key={t.id} className="text-sm hover:bg-slate-50">
                      <td className="px-6 py-5 text-slate-500">{new Date(t.timestamp).toLocaleDateString()}</td>
                      <td className="px-6 py-5">{t.type === 'payment' ? 'COLLECTION' : 'SALE'}</td>
                      <td className="px-6 py-5 font-bold">{t.type === 'payment' ? 'Manual Settlement' : t.items.map(i => i.item_name).join(', ')}</td>
                      <td className="px-6 py-5 uppercase font-black text-[10px]">{t.payment_type}</td>
                      <td className="px-6 py-5 text-right font-black">৳{t.total_amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
