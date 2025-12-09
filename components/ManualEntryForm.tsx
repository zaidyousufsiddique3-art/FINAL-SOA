import React, { useState } from 'react';
import { Transaction } from '../types';
import { PlusCircle, CheckCircle, List, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

interface ManualEntryFormProps {
  onAddTransaction: (trx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  customers: string[];
  selectedCustomer: string;
  onSelectCustomer: (customer: string) => void;
  manualTransactions: Transaction[];
}

export const ManualEntryForm: React.FC<ManualEntryFormProps> = ({ 
  onAddTransaction,
  onDeleteTransaction,
  customers, 
  selectedCustomer, 
  onSelectCustomer,
  manualTransactions
}) => {
  const [formData, setFormData] = useState<Partial<Transaction>>({
    trxDate: new Date().toISOString().split('T')[0],
    number: '',
    region: 'Center',
    siteLocation: '',
    originalAmount: '' as any, // Allow empty string for input
  });
  
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert("Please select a customer first.");
      return;
    }

    const amount = Number(formData.originalAmount);
    const finalAmount = -Math.abs(amount);

    const newTrx: Transaction = {
      id: `manual-${Date.now()}`,
      trxDate: formData.trxDate || new Date().toISOString().split('T')[0],
      number: formData.number || '',
      region: formData.region || '',
      siteLocation: formData.siteLocation || '',
      trxType: 'PAYMENT',
      originalAmount: finalAmount,
      customerName: selectedCustomer,
    };

    onAddTransaction(newTrx);
    
    // Show success
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);

    // Clear form fields (except customer and region which might be repetitive)
    setFormData(prev => ({
      ...prev,
      trxDate: new Date().toISOString().split('T')[0],
      number: '',
      siteLocation: '',
      originalAmount: '' as any,
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const inputClass = "w-full bg-[#0B0C10] border border-[#2A2D33] text-white rounded p-2 text-sm outline-none focus:border-[#5B6CFF] focus:ring-1 focus:ring-[#5B6CFF] transition-all placeholder-gray-600";
  const labelClass = "text-[10px] font-bold text-[#A1A5B0] mb-1 uppercase tracking-wider";

  const customerTransactions = manualTransactions.filter(t => t.customerName === selectedCustomer);

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="font-bold text-[#A1A5B0] flex items-center gap-2 text-sm border-b border-[#2A2D33] pb-2">
          <PlusCircle size={16} className="text-[#5B6CFF]" />
          ADD PAYMENT TRANSACTION
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Customer Dropdown */}
          <div className="flex flex-col">
            <label className={labelClass}>Customer Name</label>
            <select 
              value={selectedCustomer} 
              onChange={(e) => onSelectCustomer(e.target.value)} 
              className={inputClass}
              required
            >
              <option value="" disabled>Select Customer...</option>
              {customers.map(c => <option key={c} value={c} className="bg-[#16181D]">{c}</option>)}
            </select>
          </div>

          <div className="flex flex-col">
            <label className={labelClass}>Transaction Date</label>
            <input type="date" name="trxDate" value={formData.trxDate} onChange={handleChange} className={inputClass} required />
          </div>

          <div className="flex flex-col">
             <label className={labelClass}>Invoice / Ref Number</label>
             <input type="text" name="number" value={formData.number} onChange={handleChange} className={inputClass} placeholder="e.g. 1001" required />
          </div>

          <div className="flex flex-col">
             <label className={labelClass}>Region</label>
             <input type="text" name="region" value={formData.region} onChange={handleChange} className={inputClass} required />
          </div>

          <div className="flex flex-col">
             <label className={labelClass}>Site Location</label>
             <input type="text" name="siteLocation" value={formData.siteLocation} onChange={handleChange} className={inputClass} required />
          </div>

          <div className="flex flex-col">
             <label className={labelClass}>Transaction Type</label>
             <input type="text" value="PAYMENT" disabled className="w-full bg-[#16181D] border border-[#2A2D33] text-gray-400 rounded p-2 text-sm cursor-not-allowed" />
          </div>

          <div className="flex flex-col">
             <label className={labelClass}>Amount</label>
             <input 
               type="number" 
               step="0.01" 
               name="originalAmount" 
               value={formData.originalAmount} 
               onChange={handleChange} 
               className={inputClass} 
               required 
               placeholder="0.00"
             />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button type="submit" className="bg-[#2A2D33] text-[#5B6CFF] border border-[#5B6CFF] px-6 py-2 rounded-lg text-sm font-bold hover:bg-[#5B6CFF] hover:text-white transition-all shadow-lg flex items-center gap-2">
            <PlusCircle size={16} />
            Add Payment to List
          </button>
          
          {showSuccess && (
            <div className="flex items-center gap-2 text-green-400 animate-in fade-in slide-in-from-left-2 duration-300">
              <CheckCircle size={16} />
              <span className="text-xs font-bold">Payment Added Successfully!</span>
            </div>
          )}
        </div>
      </form>

      {/* Manual Transactions Table */}
      {customerTransactions.length > 0 && (
        <div className="mt-6 border border-[#2A2D33] rounded-lg overflow-hidden bg-[#0B0C10]">
          <div className="bg-[#16181D] px-4 py-2 border-b border-[#2A2D33] flex items-center gap-2">
             <List size={14} className="text-[#14F1E1]" />
             <span className="text-xs font-bold text-gray-400 uppercase">Added Payments ({customerTransactions.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-400">
              <thead className="bg-[#16181D] text-gray-200">
                <tr>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Number</th>
                  <th className="p-3 font-medium">Region</th>
                  <th className="p-3 font-medium">Location</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium text-right">Amount</th>
                  <th className="p-3 font-medium text-right">Preview</th>
                  <th className="p-3 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D33]">
                {customerTransactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-[#1C1F24]">
                    <td className="p-3">{formatDate(trx.trxDate)}</td>
                    <td className="p-3">{trx.number}</td>
                    <td className="p-3">{trx.region}</td>
                    <td className="p-3">{trx.siteLocation}</td>
                    <td className="p-3 text-[#5B6CFF]">{trx.trxType}</td>
                    <td className="p-3 text-right">{formatCurrency(Math.abs(trx.originalAmount))}</td>
                    <td className="p-3 text-right text-red-400">({formatCurrency(Math.abs(trx.originalAmount))})</td>
                    <td className="p-3 text-center">
                      <button 
                        onClick={() => onDeleteTransaction(trx.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1"
                        title="Delete Transaction"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};