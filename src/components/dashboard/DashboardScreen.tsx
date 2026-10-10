import React from 'react';
import { AlarmClock, Calendar, CalendarDays, AlertTriangle, ArrowRight, Phone, MessageSquare, CalendarClock, PieChart, Upload, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';

import { useAuth } from '@/context/auth-context';
import { getTodayDateString } from '@/lib/date-utils';

export const DashboardScreen: React.FC = () => {
  const { user, profile } = useAuth();
  const brokerFirstName = profile?.full_name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Broker';

  const { 
    metrics, 
    policies, 
    followUps, 
    customers, 
    navigateTo, 
    openCustomerDrawer, 
    openPolicyDrawer, 
    openAddFollowUpModal,
    markPolicyRenewed,
    triggerCall,
    triggerWhatsApp
  } = useApp();

  const totalPortfolio = metrics.activeCount + metrics.renewedCount + metrics.expiredCount;
  const activeShare = totalPortfolio ? metrics.activeCount / totalPortfolio : 0;
  const renewedShare = totalPortfolio ? metrics.renewedCount / totalPortfolio : 0;
  const expiredShare = totalPortfolio ? metrics.expiredCount / totalPortfolio : 0;
  // Renewals due today or soon
  const todayStr = getTodayDateString();
  const todayRenewals = policies.filter(p => p.status !== 'Renewed' && p.expiryDate === todayStr);
  const displayRenewals = todayRenewals;

  // Today's follow-ups
  const todayFollowUpsList = followUps.filter(f => f.date === todayStr && f.status !== 'Completed').slice(0, 3);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              IRDAI Advisory Portfolio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Good morning, {brokerFirstName} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Here&apos;s what&apos;s happening with your insurance business today.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigateTo('import')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm active:scale-95 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Import Excel</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Expiring Today */}
        <div 
          onClick={() => navigateTo('renewals')}
          className="relative bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer overflow-hidden group"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />
          <div className="flex items-center justify-between pl-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Expiring Today</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlarmClock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pl-1">
            <div className="text-3xl font-extrabold text-red-600 tabular-nums leading-none">
              {metrics.expiringToday}
            </div>
            <p className="text-xs text-red-600/90 font-medium mt-1">Policies need attention</p>
          </div>
        </div>

        {/* Card 2: Next 7 Days */}
        <div 
          onClick={() => navigateTo('renewals')}
          className="relative bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer overflow-hidden group"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />
          <div className="flex items-center justify-between pl-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Next 7 Days</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pl-1">
            <div className="text-3xl font-extrabold text-amber-600 tabular-nums leading-none">
              {metrics.next7Days}
            </div>
            <p className="text-xs text-amber-700 font-medium mt-1">Upcoming renewals</p>
          </div>
        </div>

        {/* Card 3: Next 30 Days */}
        <div 
          onClick={() => navigateTo('renewals')}
          className="relative bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer overflow-hidden group"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600" />
          <div className="flex items-center justify-between pl-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Next 30 Days</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pl-1">
            <div className="text-3xl font-extrabold text-blue-600 tabular-nums leading-none">
              {metrics.next30Days}
            </div>
            <p className="text-xs text-blue-600 font-medium mt-1">Policies coming up</p>
          </div>
        </div>

        {/* Card 4: Overdue */}
        <div 
          onClick={() => navigateTo('renewals')}
          className="relative bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer overflow-hidden group"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600" />
          <div className="flex items-center justify-between pl-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Overdue</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pl-1">
            <div className="text-3xl font-extrabold text-red-600 tabular-nums leading-none">
              {metrics.overdue}
            </div>
            <p className="text-xs text-red-600 font-medium mt-1">Policies already expired</p>
          </div>
        </div>
      </div>

      {/* TODAY'S RENEWALS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Today&apos;s Renewals</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
              {todayRenewals.length} Due
            </span>
          </div>
          <button
            onClick={() => navigateTo('renewals')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
          >
            <span>View all renewals</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Policy</th>
                <th className="py-3 px-4">Insurer</th>
                <th className="py-3 px-4">Premium</th>
                <th className="py-3 px-4">Expiry</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {displayRenewals.map((pol) => {
                const cust = customers.find(c => c.id === pol.customerId);
                const phone = cust?.phone || pol.customerPhone || '+91 9800000000';
                const initials = pol.customerName.substring(0, 2).toUpperCase();

                return (
                  <tr key={pol.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div 
                        onClick={() => cust && openCustomerDrawer(cust)}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {pol.customerName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono truncate">{pol.policyNumber}</p>
                        </div>
                      </div>
                    </td>

                    {/* Policy */}
                    <td className="py-3.5 px-4">
                      <span 
                        onClick={() => openPolicyDrawer(pol)}
                        className="font-medium text-slate-800 hover:text-blue-600 cursor-pointer"
                      >
                        {pol.policyType}
                      </span>
                    </td>

                    {/* Insurer */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                        {pol.insurer}
                      </span>
                    </td>

                    {/* Premium */}
                    <td className="py-3.5 px-4 font-bold text-slate-900 tabular-nums">
                      ₹{pol.premium.toLocaleString('en-IN')}
                    </td>

                    {/* Expiry */}
                    <td className="py-3.5 px-4 text-slate-600">
                      {pol.expiryDate}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        pol.status === 'Renewed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : pol.status === 'Due Today'
                          ? 'bg-red-100 text-red-800'
                          : pol.status === 'Expiring Soon'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {pol.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => triggerCall(phone, pol.customerName)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="Call Client"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => triggerWhatsApp(
                            phone, 
                            `Hello ${pol.customerName}, this is a reminder from PolicyPilot that your ${pol.policyType} policy ${pol.policyNumber} is due for renewal on ${pol.expiryDate}. Please let us know if you would like to proceed with the renewal.`,
                            pol.customerName
                          )}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                          title="Send WhatsApp reminder"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openAddFollowUpModal({
                            customerId: pol.customerId,
                            policyId: pol.id,
                            reason: 'Renewal',
                          })}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="Add Follow-up"
                        >
                          <CalendarClock className="w-3.5 h-3.5" />
                        </button>
                        {pol.status !== 'Renewed' && (
                          <button
                            onClick={() => markPolicyRenewed(pol.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-colors"
                            title="Mark as Renewed"
                          >
                            ✓ Renew
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOTTOM SECTION: UPCOMING RENEWALS & FOLLOW-UPS DUE TODAY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-bold">Upcoming Renewals</h2>
          {policies.filter(p => p.status !== 'Renewed' && p.expiryDate > todayStr).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)).slice(0, 4).map(policy =>
            <button key={policy.id} onClick={() => openPolicyDrawer(policy)} className="mb-2 flex w-full items-center justify-between rounded-xl bg-slate-50 p-3 text-left">
              <span><span className="block text-sm font-semibold">{policy.customerName}</span><span className="text-xs text-slate-500">{policy.policyNumber} · {policy.expiryDate}</span></span>
              <span className="text-sm font-semibold">₹{policy.premium.toLocaleString('en-IN')}</span>
            </button>)}
          {!policies.some(p => p.status !== 'Renewed' && p.expiryDate > todayStr) && <p className="text-sm text-slate-500">No upcoming renewals.</p>}
        </div>

        {/* Card 2: Follow-ups Due Today */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Follow-ups Due Today</h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
                  {todayFollowUpsList.length} Scheduled
                </span>
              </div>
              <button 
                onClick={() => navigateTo('follow-ups')}
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 pt-4">
              {todayFollowUpsList.map((fu) => {
                const initials = fu.customerName.substring(0, 2).toUpperCase();
                return (
                  <div 
                    key={fu.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-900 truncate">{fu.customerName}</span>
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.2 rounded-full bg-slate-200/70 text-slate-700 text-[10px] font-medium shrink-0">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {fu.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {fu.policyType}: {fu.notes}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        onClick={() => triggerCall(fu.customerPhone, fu.customerName)}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-2xs"
                        title="Call"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => triggerWhatsApp(
                          fu.customerPhone, 
                          `Hello ${fu.customerName}, following up regarding your ${fu.policyType} with PolicyPilot.`,
                          fu.customerName
                        )}
                        className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 transition-colors shadow-2xs"
                        title="WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* POLICY OVERVIEW DONUT CHART SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Policy Overview</h2>
            <p className="text-xs text-slate-500 mt-0.5">Aggregated portfolio breakdown across active and renewed accounts</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
              <PieChart className="w-3.5 h-3.5 text-blue-600" />
              <span>Current portfolio</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-around gap-8 pt-6">
          {/* SVG Donut Chart */}
          <div className="relative w-48 h-48 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F1F5F9" strokeWidth="12" />
              {/* Active: 55.6% -> stroke-dasharray="140 251.3" */}
              <circle 
                cx="50" cy="50" r="40" 
                fill="transparent" 
                stroke="#2563EB" 
                strokeWidth="12" 
                strokeDasharray={`${activeShare * 251.3} 251.3`} 
                strokeDashoffset="0" 
              />
              {/* Renewed: 39.8% -> stroke-dasharray="100 251.3" */}
              <circle 
                cx="50" cy="50" r="40" 
                fill="transparent" 
                stroke="#16A34A" 
                strokeWidth="12" 
                strokeDasharray={`${renewedShare * 251.3} 251.3`} 
                strokeDashoffset={-activeShare * 251.3} 
              />
              {/* Expired: 4.6% -> stroke-dasharray="12 251.3" */}
              <circle 
                cx="50" cy="50" r="40" 
                fill="transparent" 
                stroke="#DC2626" 
                strokeWidth="12" 
                strokeDasharray={`${expiredShare * 251.3} 251.3`} 
                strokeDashoffset={-(activeShare + renewedShare) * 251.3} 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">
                {metrics.activeCount + metrics.renewedCount + metrics.expiredCount}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                Total Policies
              </span>
            </div>
          </div>

          {/* Legend Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl">
            {/* Active */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <span className="w-3 h-3 rounded-full bg-blue-600 mt-1 shrink-0" />
              <div>
                <span className="text-xs text-slate-500 font-medium">Active</span>
                <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight mt-0.5">
                  {metrics.activeCount}
                </p>
                <span className="text-[11px] text-blue-700 font-semibold mt-0.5 block">{(activeShare * 100).toFixed(1)}% portfolio</span>
              </div>
            </div>

            {/* Renewed */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-600 mt-1 shrink-0" />
              <div>
                <span className="text-xs text-slate-500 font-medium">Renewed</span>
                <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight mt-0.5">
                  {metrics.renewedCount}
                </p>
                <span className="text-[11px] text-emerald-700 font-semibold mt-0.5 block">{(renewedShare * 100).toFixed(1)}% portfolio</span>
              </div>
            </div>

            {/* Expired */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <span className="w-3 h-3 rounded-full bg-red-600 mt-1 shrink-0" />
              <div>
                <span className="text-xs text-slate-500 font-medium">Expired</span>
                <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight mt-0.5">
                  {metrics.expiredCount}
                </p>
                <span className="text-[11px] text-red-600 font-semibold mt-0.5 block">{(expiredShare * 100).toFixed(1)}% portfolio</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
