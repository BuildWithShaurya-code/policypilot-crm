import React, { useState } from 'react';
import { X, CalendarClock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FollowUpReason } from '../../types';
import { getTodayDateString } from '@/lib/date-utils';

export const AddFollowUpModal: React.FC = () => {
  const { 
    isAddFollowUpModalOpen, 
    closeAddFollowUpModal, 
    customers, 
    policies, 
    addFollowUp,
    prefilledFollowUpData 
  } = useApp();

  const [customerId, setCustomerId] = useState(prefilledFollowUpData?.customerId || customers[0]?.id || '');
  const [policyId, setPolicyId] = useState(prefilledFollowUpData?.policyId || '');
  const [reason, setReason] = useState<FollowUpReason>((prefilledFollowUpData?.reason as FollowUpReason) || 'Renewal');
  const [date, setDate] = useState(getTodayDateString);
  const [time, setTime] = useState('10:30');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);


  if (!isAddFollowUpModalOpen) return null;

  const relevantPolicies = customerId 
    ? policies.filter(p => p.customerId === customerId)
    : policies;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find(c => c.id === customerId);
    const pol = policies.find(p => p.id === policyId && p.customerId === customerId);

    if (!cust || isSaving) return;

    setIsSaving(true);
    try {
    await addFollowUp({
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      customerEmail: cust.email,
      policyId: pol?.id || '',
      policyNumber: pol?.policyNumber || 'N/A',
      policyType: pol?.policyType || 'Insurance Policy',
      reason,
      date,
      time,
      notes: notes.trim() || 'Scheduled proactive outreach touchpoint.',
      status: 'Pending',
    });

    setNotes('');
    closeAddFollowUpModal();
    } catch {
      // Keep entered details when the shared action reports a failed save.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={closeAddFollowUpModal}
      />

      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">Schedule Follow-up</h3>
              <p className="text-xs text-slate-500">Plan renewal discussions or client callbacks.</p>
            </div>
          </div>
          <button
            onClick={closeAddFollowUpModal}
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
              onChange={(e) => { setCustomerId(e.target.value); setPolicyId(''); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Associated Policy (optional)
            </label>
            <select
              value={policyId}
              onChange={(e) => setPolicyId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="">General follow-up (no policy)</option>
              {relevantPolicies.length > 0 ? (
                relevantPolicies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.policyType} ({p.policyNumber}) - {p.insurer} [Exp: {p.expiryDate}]
                  </option>
                ))
              ) : (
                null
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Follow-up Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as FollowUpReason)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="Renewal">Renewal Discussion</option>
              <option value="Quote">Quote Comparison</option>
              <option value="Payment">Payment Verification</option>
              <option value="Document">Document Collection (KYC / RC)</option>
              <option value="Callback">General Callback</option>
              <option value="Other">Other Touchpoint</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="10:30 AM"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Discussion Notes / Customer Request
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Customer asked for quote comparison with zero depreciation."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={closeAddFollowUpModal}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              Save Follow-up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
