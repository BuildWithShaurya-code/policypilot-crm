import React, { useState } from 'react';
import { AlarmClock, Calendar, CalendarDays, AlertTriangle, Phone, MessageSquare, Mail, Search, CheckCircle2, Download, CalendarPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RenewalStage } from '../../types';
import { getTodayDateString } from '@/lib/date-utils';
import { calculateDaysRemaining } from '@/lib/services/renewal-service';

export const RenewalsScreen: React.FC = () => {
  const { 
    policies, 
    customers, 
    metrics, 
    markPolicyRenewed, 
    updateRenewalStage,
    addFollowUp,
    triggerCall,
    triggerWhatsApp,
    triggerEmail
  } = useApp();

  const [activeTab, setActiveTab] = useState<'today' | '7days' | '30days' | 'overdue' | 'renewed'>('today');
  const [search, setSearch] = useState('');
  const [selectedRenewalId, setSelectedRenewalId] = useState<string>(() => {
    // Select first policy due today or first policy
    const due = policies.find(p => p.status === 'Due Today');
    return due ? due.id : (policies[0]?.id || '');
  });

  // Follow-up form inside drawer
  const [fuDateTime, setFuDateTime] = useState(() => getTodayDateString() + 'T10:30');
  const [fuNotes, setFuNotes] = useState('Customer asked to call back regarding policy renewal premium.');

  // Filter policies based on tab
  const getTabPolicies = () => {
    switch (activeTab) {
      case 'today':
        return policies.filter(p => p.status === 'Due Today');
      case '7days':
        return policies.filter(p => p.status !== 'Renewed' && calculateDaysRemaining(p.expiryDate) >= 0 && calculateDaysRemaining(p.expiryDate) <= 7);
      case '30days':
        return policies.filter(p => p.status !== 'Renewed' && calculateDaysRemaining(p.expiryDate) >= 0 && calculateDaysRemaining(p.expiryDate) <= 30);
      case 'overdue':
        return policies.filter(p => p.status === 'Expired');
      case 'renewed':
        return policies.filter(p => p.status === 'Renewed');
      default:
        return policies;
    }
  };

  const currentTabPolicies = getTabPolicies().filter(p => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      p.customerName.toLowerCase().includes(term) ||
      p.policyNumber.toLowerCase().includes(term) ||
      p.insurer.toLowerCase().includes(term) ||
      p.policyType.toLowerCase().includes(term)
    );
  });

  // Selected policy for the right detail panel
  const selectedPolicy = currentTabPolicies.find(p => p.id === selectedRenewalId) || currentTabPolicies[0];
  const selectedCustomer = selectedPolicy ? customers.find(c => c.id === selectedPolicy.customerId) : null;
  const phone = selectedCustomer?.phone || selectedPolicy?.customerPhone || '';
  const email = selectedCustomer?.email || selectedPolicy?.customerEmail || '';

  const stagesList: RenewalStage[] = [
    'New',
    'Contacted',
    'Interested',
    'Quote Sent',
    'Payment Pending',
    'Renewed'
  ];

  const currentStageIndex = selectedPolicy ? stagesList.indexOf(selectedPolicy.renewalStage) : 0;

  const handleSaveFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy || !selectedCustomer) return;
    addFollowUp({
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone,
      customerEmail: selectedCustomer.email,
      policyId: selectedPolicy.id,
      policyNumber: selectedPolicy.policyNumber,
      policyType: selectedPolicy.policyType,
      reason: 'Renewal',
      date: fuDateTime.split('T')[0],
      time: fuDateTime.split('T')[1],
      notes: fuNotes,
      status: 'Pending',
    });
  };

  const exportCSV = () => {
    const headers = ['Customer', 'Policy', 'Provider', 'Expiry', 'Premium', 'Status', 'Stage'];
    const rows = currentTabPolicies.map(p => [
      `"${p.customerName}"`,
      p.policyNumber,
      `"${p.insurer}"`,
      p.expiryDate,
      p.premium,
      p.status,
      p.renewalStage
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PolicyPilot_Renewals_${activeTab}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Renewals
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Never miss a policy renewal. Keep client portfolios protected and active.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search renewal by customer or policy..."
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today */}
        <div 
          onClick={() => setActiveTab('today')}
          className={`bg-white rounded-2xl p-4 border shadow-2xs cursor-pointer transition-all relative overflow-hidden flex items-center justify-between ${
            activeTab === 'today' ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600" />
          <div className="pl-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Today</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{metrics.expiringToday}</span>
              <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded-full">Critical</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Policies expire today</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlarmClock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Next 7 Days */}
        <div 
          onClick={() => setActiveTab('7days')}
          className={`bg-white rounded-2xl p-4 border shadow-2xs cursor-pointer transition-all relative overflow-hidden flex items-center justify-between ${
            activeTab === '7days' ? 'border-amber-500 ring-2 ring-amber-500/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />
          <div className="pl-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Next 7 Days</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{metrics.next7Days}</span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-full">Urgent</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Upcoming renewals</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Next 30 Days */}
        <div 
          onClick={() => setActiveTab('30days')}
          className={`bg-white rounded-2xl p-4 border shadow-2xs cursor-pointer transition-all relative overflow-hidden flex items-center justify-between ${
            activeTab === '30days' ? 'border-blue-600 ring-2 ring-blue-500/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600" />
          <div className="pl-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Next 30 Days</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{metrics.next30Days}</span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded-full">Pipeline</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Policies coming up</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Overdue */}
        <div 
          onClick={() => setActiveTab('overdue')}
          className={`bg-white rounded-2xl p-4 border shadow-2xs cursor-pointer transition-all relative overflow-hidden flex items-center justify-between ${
            activeTab === 'overdue' ? 'border-red-600 ring-2 ring-red-500/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600" />
          <div className="pl-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Overdue</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{metrics.overdue}</span>
              <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded-full">Grace Expired</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Policies already expired</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs bar & export controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
          <button
            onClick={() => setActiveTab('today')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'today'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Today ({metrics.expiringToday})
          </button>
          <button
            onClick={() => setActiveTab('7days')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === '7days'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Next 7 Days ({metrics.next7Days})
          </button>
          <button
            onClick={() => setActiveTab('30days')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === '30days'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Next 30 Days ({metrics.next30Days})
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'overdue'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Overdue ({metrics.overdue})
          </button>
          <button
            onClick={() => setActiveTab('renewed')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'renewed'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Renewed
          </button>
        </div>

        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export {activeTab}</span>
        </button>
      </div>

      {/* Main Dual-Column Split Workspace (Matches Image 9) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Table Section (8 Columns) */}
        <div className="xl:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Policy</th>
                  <th className="py-3 px-4">Expiry</th>
                  <th className="py-3 px-4 text-right">Premium</th>
                  <th className="py-3 px-4 text-center">Remaining</th>
                  <th className="py-3 px-4">Last Contact</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {currentTabPolicies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No policies in the {activeTab} bucket.
                    </td>
                  </tr>
                ) : (
                  currentTabPolicies.map((pol) => {
                    const isSelected = pol.id === selectedPolicy?.id;
                    const initials = pol.customerName.substring(0, 2).toUpperCase();
                    const cust = customers.find(c => c.id === pol.customerId);
                    const custPhone = cust?.phone || pol.customerPhone || '';

                    const days = calculateDaysRemaining(pol.expiryDate);
                    const remainingLabel = pol.status === 'Renewed' ? 'Renewed' : days < 0 ? Math.abs(days) + ' days overdue' : days === 0 ? 'Today' : days + ' days';
                    const remainingColor = pol.status === 'Renewed' ? 'bg-emerald-100 text-emerald-800' : days <= 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';

                    return (
                      <tr
                        key={pol.id}
                        onClick={() => setSelectedRenewalId(pol.id)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 border-l-4 border-l-blue-600'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Customer */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{pol.customerName}</p>
                              <p className="text-[11px] text-slate-400 font-mono truncate">{custPhone}</p>
                            </div>
                          </div>
                        </td>

                        {/* Policy */}
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{pol.policyType}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{pol.policyNumber} • {pol.insurer}</p>
                        </td>

                        {/* Expiry */}
                        <td className="py-3 px-4">
                          <span className={`font-semibold ${
                            pol.status === 'Due Today' || pol.status === 'Expired' 
                              ? 'text-red-600' 
                              : 'text-slate-800'
                          }`}>
                            {pol.expiryDate}
                          </span>
                        </td>

                        {/* Premium */}
                        <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                          ₹{pol.premium.toLocaleString('en-IN')}
                        </td>

                        {/* Remaining */}
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${remainingColor}`}>
                            {remainingLabel}
                          </span>
                        </td>

                        {/* Last Contact */}
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {pol.lastContactDate || 'Never'}
                        </td>

                        {/* Status / Stage */}
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {pol.renewalStage}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => triggerCall(custPhone, pol.customerName)}
                              className="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white transition-colors"
                              title="Call"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => triggerWhatsApp(
                                custPhone, 
                                `Hello ${pol.customerName}, your ${pol.policyType} policy ${pol.policyNumber} is due for renewal on ${pol.expiryDate}. Please let us know if you'd like to proceed.`,
                                pol.customerName
                              )}
                              className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            {pol.status !== 'Renewed' ? (
                              <button
                                onClick={() => markPolicyRenewed(pol.id)}
                                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors ml-1"
                              >
                                ✓ Renew
                              </button>
                            ) : (
                              <span className="text-[11px] text-emerald-700 font-bold ml-1">
                                Done
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Showing <strong className="text-slate-800">{currentTabPolicies.length}</strong> renewal policies</span>
            <span className="text-[11px]">Click any row to open the renewal action desk</span>
          </div>
        </div>

        {/* Right Section: Renewal Detail Action Panel (4 Columns - Matches Image 9) */}
        {selectedPolicy && (
          <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-md p-5 space-y-4">
            {/* Top Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="font-bold text-slate-900 text-sm">
                  Renewal #{selectedPolicy.policyNumber}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                selectedPolicy.status === 'Renewed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-700'
              }`}>
                {selectedPolicy.status}
              </span>
            </div>

            {/* Customer & Policy Header Block */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedPolicy.customerName}</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{phone} • {email}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                  Expires {selectedPolicy.expiryDate.split(' ')[0]} {selectedPolicy.expiryDate.split(' ')[1]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Policy & Provider</span>
                  <span className="font-semibold text-slate-900">{selectedPolicy.policyType} • {selectedPolicy.insurer}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Policy Number</span>
                  <span className="font-semibold text-slate-900 font-mono">{selectedPolicy.policyNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Expiry Date</span>
                  <span className="font-bold text-red-600">{selectedPolicy.expiryDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Last Contact</span>
                  <span className="font-semibold text-slate-800">{selectedPolicy.lastContactDate || 'Never'}</span>
                </div>
              </div>

              {/* Renewal Premium Highlight */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between mt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Renewal Premium</span>
                  <span className="text-lg font-extrabold text-slate-900 tabular-nums">
                    ₹{selectedPolicy.premium.toLocaleString('en-IN')}
                  </span>
                </div>
                {selectedPolicy.ncbPercent !== undefined && selectedPolicy.ncbPercent > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    NCB {selectedPolicy.ncbPercent}% Applied
                  </span>
                )}
              </div>
            </div>

            {/* Pipeline Stepper (Stage 1 of 6) */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Renewal Progression</span>
                <span className="text-[11px] text-blue-600 font-semibold">
                  Stage {currentStageIndex + 1} of 6
                </span>
              </div>

              {/* Progress bars */}
              <div className="grid grid-cols-6 gap-1">
                {stagesList.map((st, idx) => (
                  <div
                    key={st}
                    className={`h-2 rounded-full transition-colors ${
                      idx <= currentStageIndex ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                    title={st}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-blue-700">{selectedPolicy.renewalStage}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 text-[11px]">Advance to:</span>
                  <select
                    value={selectedPolicy.renewalStage}
                    onChange={(e) => updateRenewalStage(selectedPolicy.id, e.target.value as RenewalStage)}
                    className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    {stagesList.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Quick Outreach Buttons */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">Quick Outreach</span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  onClick={() => triggerCall(phone, selectedPolicy.customerName)}
                  className="py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  <span>Call</span>
                </button>
                <button
                  onClick={() => triggerWhatsApp(
                    phone, 
                    `Hello ${selectedPolicy.customerName}, this is your insurance advisor. Your ${selectedPolicy.policyType} policy ${selectedPolicy.policyNumber} is due for renewal on ${selectedPolicy.expiryDate}. Premium: ₹${selectedPolicy.premium}.`,
                    selectedPolicy.customerName
                  )}
                  className="py-2 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </button>
                <button
                  onClick={() => triggerEmail(
                    email, 
                    `Urgent Renewal Notice: ${selectedPolicy.policyType} ${selectedPolicy.policyNumber}`,
                    `Dear ${selectedPolicy.customerName},\n\nYour policy expires on ${selectedPolicy.expiryDate}. Please renew promptly.`
                  )}
                  className="py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-600" />
                  <span>Email</span>
                </button>
              </div>
            </div>

            {/* Schedule Follow-up Subcard */}
            <form onSubmit={handleSaveFollowUp} className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CalendarPlus className="w-4 h-4 text-blue-600" />
                  <span>Schedule Follow-up</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">IST</span>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Follow-up Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={fuDateTime}
                  onChange={(e) => setFuDateTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Notes</label>
                <textarea
                  rows={2}
                  value={fuNotes}
                  onChange={(e) => setFuNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <span>Save Follow-up</span>
              </button>
            </form>

            {/* Primary Mark as Renewed Button */}
            {selectedPolicy.status !== 'Renewed' ? (
              <button
                onClick={() => markPolicyRenewed(selectedPolicy.id)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Mark as Renewed</span>
              </button>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Policy is Renewed</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
