import React from 'react';
import { X, Phone, MessageSquare, Mail, CheckCircle2, Clock, AlertTriangle, ArrowRight, PlusCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const PolicyDrawer: React.FC = () => {
  const { 
    selectedPolicy, 
    isPolicyDrawerOpen, 
    closePolicyDrawer,
    openCustomerDrawer,
    customers,
    markPolicyRenewed,
    openAddFollowUpModal,
    triggerCall,
    triggerWhatsApp,
    triggerEmail
  } = useApp();

  if (!isPolicyDrawerOpen || !selectedPolicy) return null;

  const customer = customers.find(c => c.id === selectedPolicy.customerId);
  const custName = customer?.name || selectedPolicy.customerName;
  const custPhone = customer?.phone || selectedPolicy.customerPhone || '';
  const custEmail = customer?.email || selectedPolicy.customerEmail || '';

  const handleRenew = () => {
    markPolicyRenewed(selectedPolicy.id);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div 
        className="absolute inset-0 bg-[#0B1424]/50 backdrop-blur-xs transition-opacity duration-300"
        onClick={closePolicyDrawer}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md sm:max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-slate-900 text-base">Policy Details</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                selectedPolicy.status === 'Renewed' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : selectedPolicy.status === 'Due Today'
                  ? 'bg-red-100 text-red-800'
                  : selectedPolicy.status === 'Expiring Soon'
                  ? 'bg-amber-100 text-amber-800'
                  : selectedPolicy.status === 'Expired'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {selectedPolicy.status}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => triggerCall(custPhone, custName)}
                className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                title="Call"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => triggerWhatsApp(
                  custPhone, 
                  `Hello ${custName}, this is a reminder from PolicyPilot that your ${selectedPolicy.policyType} policy ${selectedPolicy.policyNumber} is due for renewal on ${selectedPolicy.expiryDate}. Please let us know if you would like to proceed with the renewal.`, 
                  custName
                )}
                className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                title="WhatsApp"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={closePolicyDrawer}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Policy Main Details Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold text-blue-600 block">#{selectedPolicy.policyNumber}</span>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">{selectedPolicy.policyType}</h2>
                  <p className="text-xs text-slate-500 font-medium">{selectedPolicy.insurer}</p>
                </div>
                {selectedPolicy.ncbPercent !== undefined && selectedPolicy.ncbPercent > 0 && (
                  <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                    NCB {selectedPolicy.ncbPercent}% Applied
                  </span>
                )}
              </div>

              {/* Grid information */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Customer</span>
                  <span className="font-semibold text-slate-900 truncate block mt-0.5">{custName}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Policy Number</span>
                  <span className="font-semibold text-slate-900 font-mono block mt-0.5">{selectedPolicy.policyNumber}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Insurance Co.</span>
                  <span className="font-semibold text-slate-900 truncate block mt-0.5">{selectedPolicy.insurer}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Policy Type</span>
                  <span className="font-semibold text-slate-900 truncate block mt-0.5">{selectedPolicy.policyType}</span>
                </div>
              </div>

              {/* Premium Highlight Card */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-blue-700 font-medium block">Annual Premium</span>
                  <span className="text-xl font-bold text-slate-900 tabular-nums">
                    ₹{selectedPolicy.premium.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 font-medium block">Expiry Date</span>
                  <span className={`text-sm font-bold ${
                    selectedPolicy.status === 'Due Today' || selectedPolicy.status === 'Expired' 
                      ? 'text-red-600' 
                      : 'text-slate-800'
                  }`}>
                    {selectedPolicy.expiryDate}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Start Date: <strong className="text-slate-800 font-medium">{selectedPolicy.startDate}</strong></span>
                <span>Last Contact: <strong className="text-slate-800 font-medium">{selectedPolicy.lastContactDate || 'Never'}</strong></span>
              </div>
            </div>

            {/* Customer Information Block */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Customer Information</span>
                {customer && (
                  <button
                    onClick={() => {
                      closePolicyDrawer();
                      openCustomerDrawer(customer);
                    }}
                    className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
                  >
                    <span>View Customer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">
                  {custName.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <p className="font-bold text-slate-900 truncate">{custName}</p>
                  <p className="text-slate-500 font-mono">{custPhone} • {custEmail}</p>
                </div>
              </div>
            </div>

            {/* Renewal Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Renewal Timeline</span>
                <span className="text-[11px] text-slate-500 font-medium">Auto Tracking</span>
              </div>

              <div className="space-y-3 text-xs">
                {/* 30 days */}
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">30 days before: Reminder</span>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded">Completed</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">Automated policy summary WhatsApp sent.</p>
                  </div>
                </div>

                {/* 15 days */}
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">15 days before: Follow-up</span>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded">Completed</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">Advisor tele-call completed, requested quote comparison.</p>
                  </div>
                </div>

                {/* 7 days */}
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedPolicy.status === 'Due Today' || selectedPolicy.status === 'Expiring Soon'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">7 days before: Urgent reminder</span>
                      <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded">Upcoming</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">Payment gateway link scheduled for dispatch.</p>
                  </div>
                </div>

                {/* 1 day */}
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">1 day before: Final reminder</span>
                      <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.2 rounded">Pending</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">SMS & WhatsApp urgent renewal warning.</p>
                  </div>
                </div>

                {/* Expiry */}
                <div className="flex items-start gap-3 pt-1 border-t border-slate-100">
                  <div className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-red-700">Expiry Date: {selectedPolicy.expiryDate}</span>
                      <span className="text-[10px] text-red-700 font-bold">Policy Deadline</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">Grace period kicks in if unpaid.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Buttons */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">Policy Actions</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => triggerCall(custPhone, custName)}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  <span>Call Customer</span>
                </button>
                <button
                  onClick={() => triggerWhatsApp(
                    custPhone, 
                    `Hello ${custName}, this is a reminder from PolicyPilot that your ${selectedPolicy.policyType} policy ${selectedPolicy.policyNumber} is due for renewal on ${selectedPolicy.expiryDate}. Please let us know if you would like to proceed with the renewal.`, 
                    custName
                  )}
                  className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => triggerEmail(
                    custEmail, 
                    `Renewal Notice: Policy ${selectedPolicy.policyNumber} - ${selectedPolicy.insurer}`, 
                    `Dear ${custName},\n\nYour policy ${selectedPolicy.policyNumber} is due for renewal.\nPremium: ₹${selectedPolicy.premium}\nExpiry: ${selectedPolicy.expiryDate}`
                  )}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-600" />
                  <span>Send Email</span>
                </button>
                <button
                  onClick={() => {
                    closePolicyDrawer();
                    openAddFollowUpModal({
                      customerId: selectedPolicy.customerId,
                      policyId: selectedPolicy.id,
                      reason: 'Renewal',
                    });
                  }}
                  className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                  <span>Add Follow-up</span>
                </button>
              </div>

              {/* Primary Mark Renewed Button */}
              {selectedPolicy.status !== 'Renewed' ? (
                <button
                  onClick={handleRenew}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Mark Renewed</span>
                </button>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-semibold text-emerald-800 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>This policy has been marked as Renewed</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
