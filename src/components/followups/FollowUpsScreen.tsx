import React, { useState } from 'react';
import { CalendarClock, Calendar, CheckCircle2, AlertTriangle, Phone, MessageSquare, Search, Clock, Plus, Edit3, Check, CalendarDays } from 'lucide-react';
import { useApp } from '../../context/AppContext';

import { getTodayDateString } from '@/lib/date-utils';

export const FollowUpsScreen: React.FC = () => {
  const { 
    followUps, 
    customers, 
    metrics, 
    completeFollowUp, 
    openAddFollowUpModal,
    triggerCall,
    triggerWhatsApp
  } = useApp();

  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'completed' | 'overdue'>('today');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>(() => {
    return followUps[0]?.id || '';
  });

  // Filter based on tab
  const getTabFollowUps = () => {
    switch (activeTab) {
      case 'today':
        return followUps.filter(f => f.date === getTodayDateString() && f.status === 'Pending');
      case 'upcoming':
        return followUps.filter(f => f.date > getTodayDateString() && f.status !== 'Completed');
      case 'completed':
        return followUps.filter(f => f.status === 'Completed');
      case 'overdue':
        return followUps.filter(f => f.status === 'Overdue');
      default:
        return followUps;
    }
  };

  const filteredFollowUps = getTabFollowUps().filter(f => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      f.customerName.toLowerCase().includes(term) ||
      f.policyNumber.toLowerCase().includes(term) ||
      f.policyType.toLowerCase().includes(term) ||
      f.reason.toLowerCase().includes(term) ||
      f.notes.toLowerCase().includes(term)
    );
  });

  const selectedFollowUp = filteredFollowUps.find(f => f.id === selectedId) || filteredFollowUps[0];
  const selectedCustomer = selectedFollowUp ? customers.find(c => c.id === selectedFollowUp.customerId) : null;
  const phone = selectedCustomer?.phone || selectedFollowUp?.customerPhone || '';
  const email = selectedCustomer?.email || selectedFollowUp?.customerEmail || '';

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Follow-ups
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {metrics.todayFollowUps} Scheduled Today
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Keep track of every customer conversation, renewal touchpoint, and promised callback.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{getTodayDateString()}</span>
          </div>
          <button
            onClick={() => openAddFollowUpModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Follow-up</span>
          </button>
        </div>
      </div>

      {followUps.some(f => f.status === 'Overdue') && <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{followUps.filter(f => f.status === 'Overdue').length} overdue follow-ups need attention.</p>
        <button onClick={() => setActiveTab('overdue')} className="text-sm font-semibold text-red-700">View overdue tasks</button>
      </div>}

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today */}
        <div 
          onClick={() => setActiveTab('today')}
          className={`bg-white rounded-2xl p-4 border shadow-2xs cursor-pointer transition-all relative overflow-hidden flex items-center justify-between ${
            activeTab === 'today' ? 'border-blue-600 ring-2 ring-blue-500/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600" />
          <div className="pl-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Today&apos;s Follow-ups</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{metrics.todayFollowUps}</span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded-full">Active Now</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Scheduled for today</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <CalendarClock className="w-5 h-5" />
          </div>
        </div>

        {/* Upcoming */}
        <div 
          onClick={() => setActiveTab('upcoming')}
          className={`bg-white rounded-2xl p-4 border shadow-2xs cursor-pointer transition-all relative overflow-hidden flex items-center justify-between ${
            activeTab === 'upcoming' ? 'border-slate-800 ring-2 ring-slate-800/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-700" />
          <div className="pl-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Upcoming</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{metrics.upcomingFollowUps}</span>
              <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded-full">Scheduled</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Scheduled after today</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        {/* Completed */}
        <div 
          onClick={() => setActiveTab('completed')}
          className={`bg-white rounded-2xl p-4 border shadow-2xs cursor-pointer transition-all relative overflow-hidden flex items-center justify-between ${
            activeTab === 'completed' ? 'border-emerald-600 ring-2 ring-emerald-500/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-600" />
          <div className="pl-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Completed</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-emerald-700 tabular-nums">{metrics.completedFollowUps}</span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-full">Resolved</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Successfully resolved</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Overdue */}
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
              <span className="text-2xl font-bold text-red-600 tabular-nums">{metrics.overdueFollowUps}</span>
              <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded-full">Needs Action</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Needs urgent callback</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Operational Split Panel Workspace (Matches Image 7) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Area: Work Queue Table (8 Columns) */}
        <div className="xl:col-span-8 space-y-4">
          {/* Tabs and Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100/70 p-1.5 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              <button
                onClick={() => setActiveTab('today')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'today'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Today ({metrics.todayFollowUps})
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'upcoming'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Upcoming ({metrics.upcomingFollowUps})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'completed'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Completed ({metrics.completedFollowUps})
              </button>
              <button
                onClick={() => setActiveTab('overdue')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'overdue'
                    ? 'bg-white text-red-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overdue ({metrics.overdueFollowUps})
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer, policy..."
                className="w-full sm:w-52 pl-8 pr-3 py-1.5 bg-white rounded-xl text-xs border border-slate-200 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Policy</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFollowUps.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No follow-ups recorded in this filter view.
                      </td>
                    </tr>
                  ) : (
                    filteredFollowUps.map((fu) => {
                      const isSelected = fu.id === selectedFollowUp?.id;
                      const initials = fu.customerName.substring(0, 2).toUpperCase();
                      const cust = customers.find(c => c.id === fu.customerId);
                      const custPhone = cust?.phone || fu.customerPhone || '';

                      return (
                        <tr
                          key={fu.id}
                          onClick={() => setSelectedId(fu.id)}
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
                                <span className="font-semibold text-slate-900 block truncate">{fu.customerName}</span>
                                <span className="text-[11px] text-slate-400 font-mono truncate">{custPhone}</span>
                              </div>
                            </div>
                          </td>

                          {/* Policy */}
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-800 block">{fu.policyType}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{fu.policyNumber}</span>
                          </td>

                          {/* Reason */}
                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {fu.reason}
                            </span>
                          </td>

                          {/* Date & Time */}
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{fu.date === getTodayDateString() ? 'Today' : fu.date}, {fu.time}</span>
                            </div>
                          </td>

                          {/* Notes */}
                          <td className="py-3 px-4 max-w-xs">
                            <p className="text-slate-600 italic truncate">&quot;{fu.notes}&quot;</p>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              fu.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : fu.status === 'Overdue'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                fu.status === 'Completed' ? 'bg-emerald-600' : fu.status === 'Overdue' ? 'bg-red-600' : 'bg-blue-600'
                              }`} />
                              {fu.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => triggerCall(custPhone, fu.customerName)}
                                className="p-1 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-white transition-colors"
                                title="Call"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => triggerWhatsApp(
                                  custPhone, 
                                  `Hello ${fu.customerName}, following up regarding your ${fu.policyType} policy ${fu.policyNumber}.`,
                                  fu.customerName
                                )}
                                className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                              {fu.status !== 'Completed' && (
                                <button
                                  onClick={() => completeFollowUp(fu.id)}
                                  className="p-1 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                                  title="Mark as Completed"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
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
              <span>Showing <strong>{filteredFollowUps.length}</strong> follow-up tasks</span>
              <span className="text-[11px]">Select any row to view client call notes and schedule</span>
            </div>
          </div>
        </div>

        {/* Right Area: Follow-up Details Panel (4 Columns - Matches Image 7) */}
        {selectedFollowUp && (
          <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-md p-5 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Follow-up Details</span>
                  <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                    selectedFollowUp.status === 'Completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedFollowUp.status === 'Overdue'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {selectedFollowUp.status}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">{selectedFollowUp.customerName}</h2>
                <span className="text-xs text-slate-500">{selectedFollowUp.policyType} • {selectedFollowUp.policyNumber}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <CalendarClock className="w-5 h-5" />
              </div>
            </div>

            {/* Scheduled Date & Time box */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-400 block text-[11px]">Scheduled Date & Time</span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  {selectedFollowUp.date === getTodayDateString() ? 'Today' : selectedFollowUp.date} at {selectedFollowUp.time}
                </span>
              </div>
            </div>

            {/* Contact Box */}
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200/50">
                <span className="text-[11px] font-bold uppercase text-slate-400">Contact Information</span>
                <span className="text-[11px] text-emerald-700 font-semibold">Verified KYC</span>
              </div>
              <div className="flex items-center gap-2 text-slate-800">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono">{phone}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-800">
                <span className="text-slate-400">@</span>
                <span className="truncate">{email}</span>
              </div>
            </div>

            {/* Reason & Discussion Notes */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">Follow-up Reason</span>
                <span className="font-bold text-blue-600">{selectedFollowUp.reason}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] text-slate-400 block mb-1">Notes / Summary</span>
                <p className="text-slate-800 italic leading-relaxed">
                  &quot;{selectedFollowUp.notes}&quot;
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => triggerCall(phone, selectedFollowUp.customerName)}
                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Now</span>
                </button>
                <button
                  onClick={() => triggerWhatsApp(
                    phone, 
                    `Hello ${selectedFollowUp.customerName}, following up from PolicyPilot regarding ${selectedFollowUp.policyType}.`,
                    selectedFollowUp.customerName
                  )}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => openAddFollowUpModal({
                    customerId: selectedFollowUp.customerId,
                    policyId: selectedFollowUp.policyId,
                    reason: selectedFollowUp.reason,
                  })}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>
                {selectedFollowUp.status !== 'Completed' ? (
                  <button
                    onClick={() => completeFollowUp(selectedFollowUp.id)}
                    className="py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Complete</span>
                  </button>
                ) : (
                  <div className="py-2 px-3 rounded-xl bg-emerald-50 text-emerald-800 text-center font-semibold text-xs flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Resolved</span>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Audit */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Activity Audit</span>
              <div className="space-y-1 text-slate-500 text-[11px]">
                <p>• <strong className="text-slate-700">Scheduled:</strong> {selectedFollowUp.date}, {selectedFollowUp.time}</p>
                <p>• <strong className="text-slate-700">Created:</strong> {selectedFollowUp.createdAt}</p>
                {selectedFollowUp.completedAt && (
                  <p className="text-emerald-700 font-medium">• <strong>Completed:</strong> {selectedFollowUp.completedAt}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
