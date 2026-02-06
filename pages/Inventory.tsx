import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../db';
import { InventoryItem } from '../types';
import { Plus, Edit2, Trash2, X, Search, Image as ImageIcon, Loader2, Save } from 'lucide-react';

interface InventoryProps {
  isAdmin: boolean;
}

const Inventory: React.FC<InventoryProps> = ({ isAdmin }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [formData, setFormData] = useState({
    item_name: '',
    price: 0,
    stock_quantity: 0,
    category: 'Snacks',
    image_url: ''
  });

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory').select('*').order('item_name');
    if (data) setInventory(data as InventoryItem[]);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => 
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventory, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingItem) {
        // Fix for identity column update: Omit 'id'
        const { id, ...updatePayload } = formData as any;
        const { error } = await supabase.from('inventory').update(updatePayload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory').insert([formData]);
        if (error) throw error;
      }
      
      setFormData({ item_name: '', price: 0, stock_quantity: 0, category: 'Snacks', image_url: '' });
      setIsAdding(false);
      setEditingItem(null);
      await fetchInventory();
    } catch (err: any) {
      alert("Error saving to cloud: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (id?: number) => {
    if (id && confirm('Delete this menu item? This will sync to cloud immediately.')) {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) alert("Delete failed: " + error.message);
      else fetchInventory();
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-premium">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Canteen Menu</h2>
          <p className="text-slate-500 text-sm font-medium">Cloud Integrated Database</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => {
              setIsAdding(!isAdding);
              setEditingItem(null);
              setFormData({ item_name: '', price: 0, stock_quantity: 0, category: 'Snacks', image_url: '' });
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95"
          >
            {isAdding ? 'Close Panel' : <><Plus size={18} /> Add New Food</>}
          </button>
        )}
      </div>

      <div className="relative group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
        <input 
          type="text" 
          placeholder="Filter menu by name or category..."
          className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-sm font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isAdmin && isAdding && (
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[40px] border border-indigo-100 shadow-xl space-y-6 animate-premium">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Food Item Name</label>
              <input required placeholder="e.g. Chicken Burger" className="w-full px-5 py-4 rounded-2xl bg-slate-900 text-white font-bold outline-none ring-indigo-500/20 focus:ring-4" value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Price (৳)</label>
              <input required type="number" placeholder="Price" className="w-full px-5 py-4 rounded-2xl bg-slate-900 text-white font-bold outline-none ring-indigo-500/20 focus:ring-4" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Level</label>
              <input required type="number" placeholder="Stock" className="w-full px-5 py-4 rounded-2xl bg-slate-900 text-white font-bold outline-none ring-indigo-500/20 focus:ring-4" value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: parseInt(e.target.value)})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
              <select className="w-full px-5 py-4 rounded-2xl bg-slate-900 text-white font-bold outline-none ring-indigo-500/20 focus:ring-4" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                <option value="Snacks">Snacks</option>
                <option value="Main Course">Main Course</option>
                <option value="Beverages">Beverages</option>
                <option value="Desserts">Desserts</option>
              </select>
            </div>
            <div className="space-y-1 lg:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Image URL (Optional)</label>
              <input placeholder="https://..." className="w-full px-5 py-4 rounded-2xl bg-slate-900 text-white font-bold outline-none ring-indigo-500/20 focus:ring-4" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full bg-indigo-600 text-white py-5 rounded-[24px] font-black text-lg shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {isSaving ? <><Loader2 className="animate-spin" /> SYNCING WITH CLOUD...</> : <><Save size={20} /> {editingItem ? 'UPDATE MENU ITEM' : 'SAVE TO MENU'}</>}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredInventory.map(item => (
          <div key={item.id} className="bg-white p-6 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all border-b-8 hover:border-indigo-600">
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 overflow-hidden flex items-center justify-center text-indigo-600 border border-slate-100 shadow-inner group-hover:bg-indigo-50 transition-colors">
                {item.image_url ? <img src={item.image_url} alt={item.item_name} className="w-full h-full object-cover" /> : <ImageIcon size={28} strokeWidth={1.5} />}
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <button onClick={() => { setEditingItem(item); setFormData({ item_name: item.item_name, price: item.price, stock_quantity: item.stock_quantity, category: item.category, image_url: item.image_url || '' }); setIsAdding(true); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"><Edit2 size={18} /></button>
                  <button onClick={() => deleteItem(item.id)} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 size={18} /></button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{item.category}</div>
              <h4 className="font-black text-slate-800 text-lg leading-tight truncate">{item.item_name}</h4>
            </div>
            <div className="flex items-end justify-between mt-6">
              <div className="text-3xl font-black text-slate-900 tracking-tighter">৳{item.price}</div>
              <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black border ${item.stock_quantity > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                {item.stock_quantity > 0 ? `${item.stock_quantity} IN STOCK` : 'OUT OF STOCK'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Inventory;