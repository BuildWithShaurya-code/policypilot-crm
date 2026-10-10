import React, { useState } from 'react';
import { X, FilePlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PolicyStatus } from '../../types';
import { addCalendarYear, getTodayDateString } from '@/lib/date-utils';

export const AddPolicyModal: React.FC = () => {
  const { 
    isAddPolicyModalOpen, 
    closeAddPolicyModal, 
    customers, 
    addPolicy,
    selectedCustomer
  } = useApp();

  const [customerId, setCustomerId] = useState(selectedCustomer?.id || (customers[0]?.id || ''));
  const [policyNumber, setPolicyNumber] = useState('');
  const [premium, setPremium] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [insurer, setInsurer] = useState('ICICI Lombard');
  const [policyType, setPolicyType] = useState('Motor Insurance');
  const [startDate, setStartDate] = useState(getTodayDateString);
  const [expiryDate, setExpiryDate] = useState(() => addCalendarYear(getTodayDateString()));
  const [status, setStatus] = useState<PolicyStatus>('Active');
  const [notes, setNotes] = useState('');

  if (!isAddPolicyModalOpen) return null;

  const insurersList = [
    'ICICI Lombard',
    'HDFC ERGO',
    'Bajaj Allianz',
    'Star Health',
    'LIC',
    'Tata AIG',
    'Max Life',
    'Care Health',
    'SBI General',
    'New India Assurance'
  ];

  const policyTypesList = [
    'Motor Insurance',
    'Health Insurance',
    'Life Insurance',
    'Home Insurance',
    'Travel Insurance',
    'Commercial Insurance',
    'Personal Accident'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find(c => c.id === customerId);
    if (!cust || !policyNumber.trim() || isSaving) return;

    setIsSaving(true);
    try {
    await addPolicy({
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      customerEmail: cust.email,
      policyNumber: policyNumber.trim().toUpperCase(),
      insurer,
      policyType,
      premium: Number(premium),
      startDate,
      expiryDate,
      status,
      renewalStage: 'New',
      lastContactDate: 'Never',
      notes: notes.trim(),
    });

    closeAddPolicyModal();
    } catch {
      // The shared action displays the error; keep the form open for correction.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={closeAddPolicyModal}
      />

      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">Add Policy Record</h3>
              <p className="text-xs text-slate-500">Attach an insurance policy to a client profile.</p>
            </div>
          </div>
          <button
            onClick={closeAddPolicyModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Select Client <span className="text-red-500">*</span>
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Policy Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. POL-992140"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Insurance Provider <span className="text-red-500">*</span>
              </label>
              <select
                value={insurer}
                onChange={(e) => setInsurer(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600"
              >
                {insurersList.map((ins) => (
                  <option key={ins} value={ins}>{ins}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Policy Type <span className="text-red-500">*</span>
              </label>
              <select
                value={policyType}
                onChange={(e) => setPolicyType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600"
              >
                {policyTypesList.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Annual Premium (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                placeholder="18500"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Start Date
              </label>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="15 Oct 2025"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Expiry Date <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                placeholder="15 Oct 2026"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600 font-semibold text-red-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Initial Policy Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PolicyStatus)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="Active">Active</option>
              <option value="Due Today">Due Today</option>
              <option value="Expiring Soon">Expiring Soon</option>
              <option value="Expired">Expired</option>
              <option value="Renewed">Renewed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Coverage / Endorsement Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. IDV: ₹6.5 Lakhs, 20% NCB, Zero Dep cover included."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={closeAddPolicyModal}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              Create Policy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
