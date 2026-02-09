
import React from 'react';
import { HelpCircle, ShoppingCart, Users, Receipt, KeyRound, Smartphone, Printer, ShieldCheck, Zap } from 'lucide-react';

const TutorialsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-premium">
      <div className="text-center pt-10">
        <div className="w-20 h-20 bg-indigo-600 text-white rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-2xl">
          <HelpCircle size={40} />
        </div>
        <h2 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">Operational Guide</h2>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] mt-3">Training & Onboarding Node</p>
      </div>

      <section className="space-y-8">
        <div className="flex items-center gap-4 px-2">
          <ShieldCheck className="text-indigo-600" size={32} />
          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">For the Running Manager</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GuideCard 
            icon={<ShoppingCart />} 
            title="Processing Sales" 
            text="Go to 'POS Sales' to charge food. Search a member by SID, tap their items, and choose 'Baki' to auto-add to their debt or 'Cash' if they pay now."
          />
          <GuideCard 
            icon={<Users />} 
            title="Member Registry" 
            text="In 'Member DB', you can register new members or import an Excel list. Use 'Pay Bill' here whenever a member pays back their monthly debt."
          />
          <GuideCard 
            icon={<Receipt />} 
            title="Daily Expenses" 
            text="Use the 'Expenditures' page to log money spent buying raw goods, groceries, or maintenance. This keeps the kitchen budget balanced."
          />
          <GuideCard 
            icon={<Printer />} 
            title="Generating Memos" 
            text="Open any member in 'Member DB' and click 'Statement'. You can print a professional receipt or send a detailed bill to their WhatsApp."
          />
        </div>
      </section>

      <section className="space-y-8 border-t border-slate-200 pt-12">
        <div className="flex items-center gap-4 px-2">
          <Smartphone className="text-emerald-600" size={32} />
          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">For Individual Members</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GuideCard 
            icon={<KeyRound />} 
            title="Login Protocol" 
            text="Members log in using only their SID. You don't need a password to view your own balance or place pre-orders."
          />
          <GuideCard 
            icon={<Zap />} 
            title="Active Pre-Ordering" 
            text="Members can view 'Active Service' and place orders from 20:00 PM to 12:00 PM. The kitchen will see these requests in real-time."
          />
        </div>
      </section>

      <div className="bg-slate-900 p-10 rounded-[48px] text-white shadow-2xl relative overflow-hidden text-center">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[60px]" />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400 mb-2">Technical Support</p>
        <p className="text-lg font-bold">Contact the <a href="https://wa.me/+8801753290209" target="_blank" className="text-indigo-400 underline decoration-2 underline-offset-4"> Elite Support Node </a> for database recovery or system errors.</p>
      </div>
    </div>
  );
};

const GuideCard = ({ icon, title, text }: { icon: React.ReactNode, title: string, text: string }) => (
  <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl hover:shadow-2xl transition-all group border-b-8 border-b-slate-100 hover:border-b-indigo-600">
    <div className="w-12 h-12 bg-slate-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
      {icon}
    </div>
    <h4 className="text-xl font-black text-slate-800 mb-3 uppercase tracking-tight">{title}</h4>
    <p className="text-slate-500 text-sm leading-relaxed font-medium">{text}</p>
  </div>
);

export default TutorialsPage;
