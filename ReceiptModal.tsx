import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, supabase } from './db';
import { Transaction, Customer } from './types';
import { X, Printer, Loader2 } from 'lucide-react';

interface ReceiptModalProps {
  transaction: Transaction;
  onClose: () => void;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  const config = useLiveQuery(() => db.settings.get('config'));
  const settings = config?.value;
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getCustomer = async () => {
      if (!transaction.customer_id) {
        setLoading(false);
        return;
      }

      // Try local first
      const localCust = await db.customers.where('id').equals(transaction.customer_id).first();
      if (localCust) {
        setCustomer(localCust);
        setLoading(false);
        return;
      }

      // Fallback to Supabase
      const { data } = await supabase.from('customers').select('*').eq('id', transaction.customer_id).single();
      if (data) setCustomer(data as Customer);
      setLoading(false);
    };
    getCustomer();
  }, [transaction.customer_id]);

  const handlePrint = () => {
    window.print();
  };

  const getDisplayName = () => {
    if (!customer) return 'GUEST (Walk-in)';
    const isSir = customer.uid.length <= 5;
    return isSir ? `${customer.name} Sir` : customer.name;
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-2xl animate-fade-in no-print">
      <div className="bg-white w-full max-w-sm rounded-[64px] shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-black text-slate-800 uppercase tracking-[0.2em] text-[10px]">Digital Hishab Memo</h3>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-full transition-all text-slate-400"><X size={24} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-12 bg-white printable-area">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Authenticating Member...</p>
            </div>
          ) : (
            <div className="max-w-[280px] mx-auto text-center font-mono text-slate-900">
              <div className="mb-10">
                {settings?.logoUrl && <img src={settings.logoUrl} className="w-20 h-20 rounded-[28px] mx-auto mb-6 grayscale" />}
                <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">{settings?.canteenName || 'CAFE UAV'}</h2>
                <p className="text-[10px] font-black opacity-40 mt-2 uppercase tracking-[0.3em]">Official Receipt</p>
              </div>

              <div className="border-y-2 border-dashed border-slate-200 py-6 my-6 text-[11px] text-left space-y-2">
                <div className="flex justify-between"><span>MEMO NO:</span> <span>#{transaction.id?.toString().padStart(4, '0')}</span></div>
                <div className="flex justify-between"><span>DATE:</span> <span>{new Date(transaction.timestamp).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span>ID:</span> <span className="font-black">{customer?.uid || 'GUEST'}</span></div>
                <div className="flex justify-between"><span>MEMBER:</span> <span className="font-black truncate ml-4 text-right uppercase">{getDisplayName()}</span></div>
              </div>

              <div className="text-left mb-10">
                <div className="flex justify-between font-black text-[11px] mb-4 border-b border-slate-100 pb-2 uppercase tracking-tight">
                  <span>ITEM DESCRIPTION</span>
                  <span>TOTAL</span>
                </div>
                <div className="space-y-4">
                  {transaction.items?.map((item, i) => (
                    <div key={i} className="flex justify-between items-start text-[11px]">
                      <div className="pr-4">
                        <div className="font-black uppercase leading-tight">{item.item_name}</div>
                        <div className="text-[9px] opacity-40 mt-1">{item.quantity} x ৳{item.price}</div>
                      </div>
                      <span className="font-black">৳{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t-2 border-dashed border-slate-200 pt-8 space-y-3">
                <div className="flex justify-between font-black text-2xl tracking-tighter">
                  <span>GRAND TOTAL:</span>
                  <span>৳{transaction.total_amount}</span>
                </div>
                <div className="flex justify-between text-[11px] font-black">
                  <span className="opacity-40 uppercase tracking-widest">PAYMENT:</span>
                  <span className="uppercase bg-slate-100 px-3 py-1 rounded-lg">{transaction.payment_type}</span>
                </div>
              </div>

              <div className="mt-16 text-[9px] font-bold opacity-40 italic leading-relaxed">
                "Assalamu Alaikum. Thank you for choosing {settings?.canteenName}. Please settle monthly Baki by the 5th."
              </div>
              
              <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center gap-2">
                 <div className="h-px w-32 bg-slate-300" />
                 <p className="font-black text-[9px] uppercase tracking-[0.3em]">{settings?.managerName || 'LAC Zubayer'}</p>
                 <p className="text-[8px] opacity-30">COMMANDING SIGNATORY</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-4 no-print">
          <button onClick={handlePrint} disabled={loading} className="flex-1 bg-indigo-600 text-white py-6 rounded-[28px] font-black text-sm flex items-center justify-center gap-3 shadow-2xl hover:bg-indigo-700 transition-all disabled:opacity-50"><Printer size={20} /> PRINT INVOICE</button>
          <button onClick={onClose} className="px-10 bg-white text-slate-400 py-6 rounded-[28px] font-black text-sm border-2 border-slate-100 transition-all">CLOSE</button>
        </div>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: fixed; left: 0; top: 0; width: 100%; margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default ReceiptModal;