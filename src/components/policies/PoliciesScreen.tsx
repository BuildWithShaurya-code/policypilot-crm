import React, { useState } from 'react';
import { FilePlus, Upload, Search, Phone, MessageSquare, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';


export const PoliciesScreen: React.FC = () => {
  const { 
    policies, 
    customers, 
    openPolicyDrawer, 
    openAddPolicyModal, 
    navigateTo, 
    globalSearch,
    markPolicyRenewed,
    triggerCall,
    triggerWhatsApp
  } = useApp();

  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Due Today' | 'Expiring Soon' | 'Expired' | 'Renewed'>('all');

  const activeSearch = globalSearch || localSearch;

  const filteredPolicies = policies.filter(p => {
    const term = activeSearch.toLowerCase().trim();
    const matchesSearch = !term ||
      p.policyNumber.toLowerCase().includes(term) ||
      p.customerName.toLowerCase().includes(term) ||
      p.insurer.toLowerCase().includes(term) ||
      p.policyType.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    return p.status === statusFilter;
  });

  const exportCSV = () => {
    const headers = ['Policy Number', 'Customer', 'Insurer', 'Policy Type', 'Premium', 'Start Date', 'Expiry Date', 'Status'];
    const rows = filteredPolicies.map(p => [
      p.policyNumber,
      `"${p.customerName}"`,
      `"${p.insurer}"`,
      `"${p.policyType}"`,
      p.premium,
      p.startDate,
      p.expiryDate,
      p.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PolicyPilot_Policies_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Policy Registry
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Policies
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            View and manage all insurance policies, coverage schedules, and renewals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => openAddPolicyModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm active:scale-95 transition-all"
          >
            <FilePlus className="w-4 h-4" />
            <span>+ Add Policy</span>
          </button>
          <button
            onClick={() => navigateTo('import')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Import Excel</span>
          </button>
          <button
            onClick={exportCSV}
            title="Export CSV"
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search policy number, customer or insurer..."
            className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {(['all', 'Active', 'Due Today', 'Expiring Soon', 'Expired', 'Renewed'] as const).map((st) => {
            const count = st === 'all' 
              ? policies.length 
              : policies.filter(p => p.status === st).length;

            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {st === 'all' ? 'All' : st} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Policy Number</th>
                <th className="py-3 px-4">Insurance Company</th>
                <th className="py-3 px-4">Policy Type</th>
                <th className="py-3 px-4 text-right">Premium</th>
                <th className="py-3 px-4">Start Date</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPolicies.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No insurance policies found matching this filter.
                  </td>
                </tr>
              ) : (
                filteredPolicies.map((pol) => {
                  const cust = customers.find(c => c.id === pol.customerId);
                  const phone = cust?.phone || pol.customerPhone || '+91 9800000000';
                  const initials = pol.customerName.substring(0, 2).toUpperCase();

                  return (
                    <tr 
                      key={pol.id} 
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => openPolicyDrawer(pol)}
                    >
                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            {initials}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors block">
                              {pol.customerName}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {phone}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Policy Number */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-blue-700">
                        {pol.policyNumber}
                      </td>

                      {/* Insurer */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                          {pol.insurer}
                        </span>
                      </td>

                      {/* Policy Type */}
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {pol.policyType}
                      </td>

                      {/* Premium */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                        ₹{pol.premium.toLocaleString('en-IN')}
                      </td>

                      {/* Start Date */}
                      <td className="py-3.5 px-4 text-slate-500">
                        {pol.startDate}
                      </td>

                      {/* Expiry Date */}
                      <td className="py-3.5 px-4">
                        <span className={`font-semibold ${
                          pol.status === 'Due Today' || pol.status === 'Expired' 
                            ? 'text-red-600' 
                            : pol.status === 'Expiring Soon'
                            ? 'text-amber-600'
                            : 'text-slate-800'
                        }`}>
                          {pol.expiryDate}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
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
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => triggerCall(phone, pol.customerName)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            title="Call"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => triggerWhatsApp(
                              phone, 
                              `Hello ${pol.customerName}, this is a reminder from PolicyPilot that your ${pol.policyType} policy ${pol.policyNumber} is due for renewal on ${pol.expiryDate}.`,
                              pol.customerName
                            )}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                            title="WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          {pol.status !== 'Renewed' ? (
                            <button
                              onClick={() => markPolicyRenewed(pol.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-colors"
                              title="Mark Renewed"
                            >
                              ✓ Renew
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-700 font-semibold px-2 py-1 bg-emerald-50 rounded-lg">
                              Renewed
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
      </div>
    </div>
  );
};
