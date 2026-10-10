import React, { useState } from 'react';
import { UserPlus, Upload, Search, Phone, MessageSquare, ArrowRight, CheckCircle, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';


export const CustomersScreen: React.FC = () => {
  const { 
    customers, 
    policies, 
    openCustomerDrawer, 
    openAddCustomerModal, 
    navigateTo, 
    globalSearch,
    triggerCall,
    triggerWhatsApp
  } = useApp();

  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'renewal' | 'expired'>('all');

  const activeSearch = globalSearch || localSearch;

  // Enrich customer data with policy counts and next renewal date
  const enrichedCustomers = customers.map(cust => {
    const custPolicies = policies.filter(p => p.customerId === cust.id);
    const totalPremium = custPolicies.reduce((sum, p) => sum + p.premium, 0);
    
    // Determine next renewal date and overall status
    let nextRenewal = 'None';
    let status: 'Active' | 'Renewal Due' | 'Expired' = 'Active';

    if (custPolicies.some(p => p.status === 'Due Today')) {
      status = 'Renewal Due';
      const duePol = custPolicies.find(p => p.status === 'Due Today');
      nextRenewal = duePol?.expiryDate || 'Today';
    } else if (custPolicies.some(p => p.status === 'Expired')) {
      status = 'Expired';
      const expiredPol = custPolicies.find(p => p.status === 'Expired');
      nextRenewal = expiredPol?.expiryDate || 'Expired';
    } else if (custPolicies.length > 0) {
      status = 'Active';
      nextRenewal = custPolicies[0].expiryDate;
    }

    return {
      ...cust,
      policyCount: custPolicies.length,
      totalPremium,
      nextRenewal,
      status,
      policiesList: custPolicies,
    };
  });

  // Filter
  const filteredCustomers = enrichedCustomers.filter(c => {
    // Search
    const term = activeSearch.toLowerCase().trim();
    const matchesSearch = !term || 
      c.name.toLowerCase().includes(term) ||
      c.phone.toLowerCase().includes(term) ||
      c.policiesList.some(p => p.policyNumber.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    // Filter status
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return c.status === 'Active';
    if (statusFilter === 'renewal') return c.status === 'Renewal Due';
    if (statusFilter === 'expired') return c.status === 'Expired';
    return true;
  });

  const exportCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Address', 'Policies', 'Status', 'Total Premium'];
    const rows = filteredCustomers.map(c => [
      c.name,
      c.phone,
      c.email,
      `"${c.address}"`,
      c.policyCount,
      c.status,
      c.totalPremium
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'PolicyPilot_Customers.csv');
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
              IRDAI Portfolio Node
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Customers
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage customer records, renewal health, and active policy schedules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={openAddCustomerModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Client</span>
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

      {/* Mini metric ribbon */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Total Clients</span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-0.5 block">
            {customers.length}
          </span>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Renewal Due</span>
          <span className="text-xl sm:text-2xl font-bold text-amber-600 tabular-nums mt-0.5 block">
            {enrichedCustomers.filter(c => c.status === 'Renewal Due').length}
          </span>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Total Portfolio AUM</span>
          <span className="text-xl sm:text-2xl font-bold text-blue-600 tabular-nums mt-0.5 block">
            ₹{policies.reduce((total, p) => total + p.premium, 0).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by customer name, phone or policy number..."
            className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All ({enrichedCustomers.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'active'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Active ({enrichedCustomers.filter(c => c.status === 'Active').length})
          </button>
          <button
            onClick={() => setStatusFilter('renewal')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'renewal'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Renewal Due ({enrichedCustomers.filter(c => c.status === 'Renewal Due').length})
          </button>
          <button
            onClick={() => setStatusFilter('expired')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'expired'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Expired ({enrichedCustomers.filter(c => c.status === 'Expired').length})
          </button>
        </div>
      </div>

      {/* Responsive View: Desktop Table + Mobile Cards (matching Image 1) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Phone</th>
              <th className="py-3 px-4 text-center">Policies</th>
              <th className="py-3 px-4">Next Renewal</th>
              <th className="py-3 px-4 text-right">Premium</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  No customers found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((cust) => {
                const initials = cust.name.substring(0, 2).toUpperCase();
                return (
                  <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div 
                        onClick={() => openCustomerDrawer(cust)}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {cust.name}
                            </span>
                            {cust.verified && (
                              <CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 truncate max-w-[160px] block">
                            {cust.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {cust.phone}
                    </td>

                    {/* Policies count */}
                    <td className="py-3.5 px-4 text-center font-bold text-slate-800 tabular-nums">
                      {cust.policyCount}
                    </td>

                    {/* Next Renewal */}
                    <td className="py-3.5 px-4">
                      <span className={`font-medium ${
                        cust.status === 'Renewal Due' ? 'text-red-600 font-bold' : 'text-slate-700'
                      }`}>
                        {cust.nextRenewal}
                      </span>
                    </td>

                    {/* Premium */}
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                      ₹{cust.totalPremium.toLocaleString('en-IN')}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        cust.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : cust.status === 'Renewal Due'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {cust.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => triggerCall(cust.phone, cust.name)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="Call Client"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => triggerWhatsApp(
                            cust.phone, 
                            `Hello ${cust.name}, this is Shaurya from PolicyPilot regarding your insurance policies.`,
                            cust.name
                          )}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                          title="WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openCustomerDrawer(cust)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] transition-colors flex items-center gap-1"
                        >
                          <span>View Profile</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout (matches Image 1 perfectly) */}
      <div className="md:hidden space-y-3">
        {filteredCustomers.map((cust) => {
          const initials = cust.name.substring(0, 2).toUpperCase();
          return (
            <div
              key={cust.id}
              className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-sm">{cust.name}</span>
                      {cust.verified && (
                        <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </div>
                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                      <Phone className="w-3 h-3" /> {cust.phone}
                    </span>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  cust.status === 'Active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : cust.status === 'Renewal Due'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {cust.status}
                </span>
              </div>

              {/* Grid block */}
              <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block">Policies</span>
                  <span className="font-bold text-slate-900 tabular-nums">{cust.policyCount}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Next Due</span>
                  <span className={`font-semibold ${cust.status === 'Renewal Due' ? 'text-red-600' : 'text-slate-800'}`}>
                    {cust.nextRenewal}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">Premium</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    ₹{cust.totalPremium.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => triggerCall(cust.phone, cust.name)}
                    className="p-2 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => triggerWhatsApp(
                      cust.phone, 
                      `Hello ${cust.name}, contacting you from PolicyPilot regarding your insurance policies.`,
                      cust.name
                    )}
                    className="p-2 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openCustomerDrawer(cust)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs flex items-center gap-1 shadow-2xs"
                  >
                    <span>View Profile</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
