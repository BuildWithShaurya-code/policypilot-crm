import React, { useState } from 'react';
import { X, Phone, MessageSquare, Mail, Edit2, CheckCircle, ShieldCheck, Plus, ArrowRight, History } from 'lucide-react';
import { useApp } from '../../context/AppContext';


export const CustomerDrawer: React.FC = () => {
  const { 
    selectedCustomer, 
    isCustomerDrawerOpen, 
    closeCustomerDrawer,
    policies,
    activities,
    openPolicyDrawer,
    openAddPolicyModal,
    triggerCall,
    triggerWhatsApp,
    triggerEmail,
    updateCustomer
  } = useApp();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  if (!isCustomerDrawerOpen || !selectedCustomer) return null;

  const customerPolicies = policies.filter(p => p.customerId === selectedCustomer.id);
  const customerActivities = activities.filter(a => a.customerId === selectedCustomer.id);

  const initials = selectedCustomer.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const totalPremium = customerPolicies.reduce((acc, p) => acc + p.premium, 0);

  // Status calculation for customer
  const hasDueToday = customerPolicies.some(p => p.status === 'Due Today');
  const hasExpired = customerPolicies.some(p => p.status === 'Expired');
  const customerStatus = hasDueToday ? 'Renewal Due' : hasExpired ? 'Expired' : 'Active';

  const startEdit = () => {
    setName(selectedCustomer.name);
    setPhone(selectedCustomer.phone);
    setEmail(selectedCustomer.email);
    setAddress(selectedCustomer.address);
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateCustomer(selectedCustomer.id, { name, phone, email, address });
      setIsEditing(false);
    } catch {
      // Keep edits available when the shared action reports a failed save.
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#0B1424]/50 backdrop-blur-xs transition-opacity duration-300"
        onClick={closeCustomerDrawer}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md sm:max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-900 text-base">Client Profile</span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                customerStatus === 'Active' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : customerStatus === 'Renewal Due'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {customerStatus}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                onClick={closeCustomerDrawer}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Profile Overview Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-blue-500/20 shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 truncate">{selectedCustomer.name}</h2>
                    {selectedCustomer.verified && (
                      <span title="KYC Verified">
                        <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>IRDAI Verified Client Portfolio</span>
                  </p>
                  <p className="text-xs text-slate-600 font-semibold mt-1">
                    Total AUM Premium: <span className="text-blue-600 tabular-nums">₹{totalPremium.toLocaleString('en-IN')}</span>
                  </p>
                </div>
              </div>

              {/* Action Ribbon */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => triggerCall(selectedCustomer.phone, selectedCustomer.name)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium text-xs transition-colors active:scale-95"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call</span>
                </button>
                <button
                  onClick={() => triggerWhatsApp(
                    selectedCustomer.phone, 
                    `Hello ${selectedCustomer.name}, this is Shaurya from PolicyPilot regarding your insurance policies portfolio. Please let us know if you need assistance with your renewals.`, 
                    selectedCustomer.name
                  )}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-medium text-xs transition-colors shadow-2xs active:scale-95"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <button
                  onClick={() => triggerEmail(
                    selectedCustomer.email, 
                    `PolicyPilot Insurance Portfolio Update - ${selectedCustomer.name}`, 
                    `Hello ${selectedCustomer.name},\n\nWe are pleased to manage your insurance portfolio.`
                  )}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium text-xs transition-colors active:scale-95"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </button>
              </div>
            </div>

            {/* Edit Form or Information Card */}
            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Edit Client Information</h3>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Phone</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Client Information</span>
                  <span className="text-[11px] text-slate-400 font-medium">Profile ID: #{selectedCustomer.id.slice(-6)}</span>
                </div>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50">
                    <span className="text-slate-500 font-medium">Mobile Phone</span>
                    <span className="font-semibold text-slate-900 font-mono">{selectedCustomer.phone}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50">
                    <span className="text-slate-500 font-medium">Email Address</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[200px]">{selectedCustomer.email}</span>
                  </div>
                  <div className="flex items-start justify-between py-1 px-2.5 rounded-lg bg-slate-50">
                    <span className="text-slate-500 font-medium">Address</span>
                    <span className="font-semibold text-slate-900 text-right max-w-[220px]">{selectedCustomer.address}</span>
                  </div>
                  {selectedCustomer.notes && (
                    <div className="pt-1">
                      <span className="text-slate-500 font-medium block mb-1">Notes:</span>
                      <p className="text-slate-700 italic bg-amber-50/60 border border-amber-200/60 p-2.5 rounded-lg text-xs">
                        &quot;{selectedCustomer.notes}&quot;
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Active Policies Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Policies</span>
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {customerPolicies.length}
                  </span>
                </div>
                <button
                  onClick={() => openAddPolicyModal(selectedCustomer.id)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Policy</span>
                </button>
              </div>

              {customerPolicies.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                  No policies found for this customer.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {customerPolicies.map((pol) => (
                    <div
                      key={pol.id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">{pol.policyType}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                              pol.status === 'Renewed' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : pol.status === 'Due Today'
                                ? 'bg-red-100 text-red-800'
                                : pol.status === 'Expiring Soon'
                                ? 'bg-amber-100 text-amber-800'
                                : pol.status === 'Expired'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {pol.status}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-mono">
                            {pol.policyNumber} • {pol.insurer}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Premium</span>
                          <span className="font-bold text-slate-900 tabular-nums">₹{pol.premium.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[11px]">Expiry Date</span>
                          <span className={`font-semibold ${pol.status === 'Due Today' || pol.status === 'Expired' ? 'text-red-600' : 'text-slate-800'}`}>
                            {pol.expiryDate}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => openPolicyDrawer(pol)}
                        className="w-full mt-1 py-1.5 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-blue-600 font-medium text-xs flex items-center justify-center gap-1 transition-colors"
                      >
                        <span>View Policy Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audit & Activity Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Audit & Activity</span>
                <History className="w-4 h-4 text-slate-400" />
              </div>

              <div className="relative pl-5 space-y-3 pt-1">
                <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-slate-200" />
                {customerActivities.length > 0 ? (
                  customerActivities.map((act) => (
                    <div key={act.id} className="relative flex flex-col gap-0.5">
                      <div className="absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                      <span className="text-xs font-semibold text-slate-900">{act.description}</span>
                      <span className="text-[11px] text-slate-400">{act.timestamp}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 py-2">
                    No recent activities recorded for this customer.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
            <button
              onClick={closeCustomerDrawer}
              className="w-full py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors"
            >
              Close Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
