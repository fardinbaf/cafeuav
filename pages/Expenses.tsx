
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../db';
import { Expense } from '../types';
import { Plus, Trash2, Search, Loader2, Save, Receipt, Calendar, Banknote, Tag, Info } from 'lucide-react';

const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Food Items',
    note: ''
  });

  const fetchExpenses = async () => {
    setLoading(true);
    const { data } = await supabase.from('expenses').select('*').order('timestamp', { ascending: false });
    if (data) setExpenses(data as Expense[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => 
      e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [expenses, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('expenses').insert([{
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category,
        note: formData.note,
        timestamp: Date.now()
      }]);
      if (error) throw error;
      setFormData({ description: '', amount: '', category: 'Food Items', note: '' });
      setIsAdding(false);
      await fetchExpenses();
    } catch (err: any) {
      alert("Error saving: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteExpense = async (id: number) => {
    if (confirm('Delete record?')) {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (!error) fetchExpenses();
    }
  };

  const totalSpent = useMemo(() => expenses.reduce((acc, e) => acc + Number(e.amount), 0), [expenses]);

  return (
    <div className="space-y-6 lg:space-y-8 pb-20 animate-premium">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 px-2 lg:px-0">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
            <Receipt className="text-indigo-600" size={28} /> Expenditures
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest opacity-60">Manager Operations Node</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 text-xs uppercase tracking-widest"
        >
          {isAdding ? 'Close Panel' : <><Plus size={18} /> Add Record</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 px-2 lg:px-0">
        <div className="bg-white p-6 lg:p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-center border-b-8 border-b-indigo-600">
          <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Total Spending</div>
          <div className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tighter">৳{totalSpent.toLocaleString()}</div>
        </div>
        <div className="lg:col-span-3">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Search expenses..."
              className="w-full pl-16 pr-6 py-4 lg:py-5 rounded-3xl lg:rounded-[32px] border border-slate-200 bg-white shadow-sm focus:ring-8 focus:ring-indigo-500/5 outline-none font-medium transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white p-6 lg:p-10 rounded-[32px] lg:rounded-[48px] border border-indigo-100 shadow-2xl space-y-6 lg:space-y-8 animate-premium mx-2 lg:mx-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Label</label>
              <input required placeholder="e.g. Weekly Raw Vegetables" className="w-full px-6 py-4 rounded-2xl bg-slate-900 text-white font-bold outline-none ring-indigo-500/20 focus:ring-4 transition-all" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount (৳)</label>
              <input required type="number" placeholder="Price Paid" className="w-full px-6 py-4 rounded-2xl bg-slate-900 text-white font-bold outline-none ring-indigo-500/20 focus:ring-4 transition-all" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
              <select className="w-full px-6 py-4 rounded-2xl bg-slate-900 text-white font-bold outline-none ring-indigo-500/20 focus:ring-4 transition-all appearance-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                <option value="Food Items">Food Items</option>
                <option value="Packaging">Packaging</option>
                <option value="Utilities">Utilities</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-2 lg:col-span-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Detailed Note (Optional)</label>
              <textarea placeholder="Write specifics here..." className="w-full px-6 py-4 rounded-2xl bg-slate-900 text-white font-bold outline-none ring-indigo-500/20 focus:ring-4 transition-all min-h-[80px]" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full bg-indigo-600 text-white py-5 lg:py-6 rounded-[24px] lg:rounded-[32px] font-black text-lg shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 transition-all uppercase"
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
            {isSaving ? 'Synchronizing...' : 'Log Expense'}
          </button>
        </form>
      )}

      <div className="bg-white lg:rounded-[40px] border shadow-xl overflow-hidden mx-2 lg:mx-0">
        <div className="block lg:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-12 text-center animate-pulse font-bold text-slate-300 uppercase tracking-widest text-xs">Scanning Ledger...</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-12 text-center italic text-slate-300 font-bold uppercase tracking-widest text-xs">No records identified</div>
          ) : filteredExpenses.map(e => (
            <div key={e.id} className="p-5 space-y-4 hover:bg-slate-50 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 mb-1">
                    <Calendar size={12} /> {new Date(e.timestamp).toLocaleDateString()}
                  </div>
                  <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm leading-tight">{e.description}</h4>
                </div>
                <button onClick={() => deleteExpense(e.id!)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex justify-between items-center">
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                  <Tag size={10} /> {e.category}
                </span>
                <div className="text-xl font-black text-slate-900 tracking-tighter">৳{e.amount.toLocaleString()}</div>
              </div>
              {e.note && (
                <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-500 font-medium flex items-start gap-2">
                  <Info size={14} className="shrink-0 text-slate-400" />
                  <p>{e.note}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-8 py-6">Date</th>
                <th className="px-8 py-6">Description</th>
                <th className="px-8 py-6">Category</th>
                <th className="px-8 py-6 text-right">Amount</th>
                <th className="px-8 py-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="p-20 text-center animate-pulse font-bold text-slate-300 uppercase tracking-widest text-xs">Scanning ledger...</td></tr>
              ) : filteredExpenses.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center italic text-slate-300 font-bold uppercase tracking-widest text-xs">No records identified</td></tr>
              ) : filteredExpenses.map(e => (
                <tr key={e.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-6 text-slate-500 font-bold text-xs uppercase">{new Date(e.timestamp).toLocaleDateString()}</td>
                  <td className="px-8 py-6">
                    <div className="font-black text-slate-800 uppercase tracking-tight">{e.description}</div>
                    {e.note && <div className="text-[10px] text-slate-400 mt-1 italic">{e.note}</div>}
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest">{e.category}</span>
                  </td>
                  <td className="px-8 py-6 text-right font-black text-slate-900 tracking-tighter text-lg">৳{e.amount.toLocaleString()}</td>
                  <td className="px-8 py-6 text-center">
                    <button onClick={() => deleteExpense(e.id!)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExpensesPage;
