import React, { useEffect, useState } from 'react';
import { Download, Printer, Loader2 } from 'lucide-react';
import type { DateRangePreset, FullReportData } from '@/lib/services/analytics-service';
import { readApiResponse } from '@/lib/api-client';
import { getTodayDateString } from '@/lib/date-utils';

export function LiveReportsScreen() {
  const [preset, setPreset] = useState<DateRangePreset>('last_30_days');
  const [startDate, setStartDate] = useState(() => getTodayDateString(-30));
  const [endDate, setEndDate] = useState(getTodayDateString);
  const [report, setReport] = useState<FullReportData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ preset, startDate, endDate });
    fetch(`/api/reports?${params}`, { signal: controller.signal })
      .then(response => readApiResponse<FullReportData>(response))
      .then(data => { setReport(data); setError(''); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Failed to load report'); });
    return () => controller.abort();
  }, [preset, startDate, endDate]);

  const isCurrent = report?.dateRange.preset === preset && (preset !== 'custom' || (report.dateRange.startDate === startDate && report.dateRange.endDate === endDate));
  function exportCsv() {
    if (!report || !isCurrent) return;
    const rows = [['Month', 'Policies Due', 'Contacted', 'Quotes Sent', 'Renewed', 'Pending', 'Renewal Rate'],
      ...report.monthlyBreakdown.map(row => [row.monthLabel, row.policiesDue, row.contacted, row.quotesSent, row.renewed, row.pending, row.renewalRate ?? 'N/A'])];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'PolicyPilot_Report.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold text-slate-900">Reports</h1><p className="text-sm text-slate-500">Policy and renewal activity for your selected period.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Report period" value={preset} onChange={event => setPreset(event.target.value as DateRangePreset)} className="rounded-xl border border-slate-200 bg-white p-2 text-sm">
          <option value="last_7_days">Last 7 days</option><option value="last_30_days">Last 30 days</option><option value="last_90_days">Last 90 days</option><option value="this_year">This year</option><option value="custom">Custom dates</option>
        </select>
        {preset === 'custom' && <><input aria-label="Start date" type="date" value={startDate} max={endDate} onChange={event => setStartDate(event.target.value)} /><input aria-label="End date" type="date" value={endDate} min={startDate} onChange={event => setEndDate(event.target.value)} /></>}
        <button disabled={!isCurrent} onClick={exportCsv} className="flex items-center gap-2 rounded-xl bg-blue-600 p-2 text-sm text-white disabled:opacity-50"><Download size={16} />Export CSV</button>
        <button aria-label="Print report" onClick={() => window.print()} className="rounded-xl border border-slate-200 p-2"><Printer size={18} /></button>
      </div>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {!isCurrent && !error && <p role="status" className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={18} />Loading report...</p>}
    {report && isCurrent && <>
      <p className="text-sm text-slate-500">{report.dateRange.startDate} to {report.dateRange.endDate}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Policies due', report.summary.policiesDue], ['Renewed policies', report.summary.renewedPolicies],
          ['Renewal rate', report.summary.renewalRate === null ? 'N/A' : `${report.summary.renewalRate}%`],
          ['Premium renewed', `₹${report.summary.premiumRenewed.toLocaleString('en-IN')}`],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Month', 'Due', 'Contacted', 'Quotes', 'Renewed', 'Pending', 'Rate'].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead>
          <tbody>{report.monthlyBreakdown.map(row => <tr key={row.monthKey} className="border-t border-slate-100">{[row.monthLabel, row.policiesDue, row.contacted, row.quotesSent, row.renewed, row.pending, row.renewalRate === null ? 'N/A' : `${row.renewalRate}%`].map((value, index) => <td key={index} className="p-4">{value}</td>)}</tr>)}</tbody>
        </table>
        {report.monthlyBreakdown.length === 0 && <p className="p-6 text-slate-500">No activity in this period.</p>}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 font-bold">Whole portfolio by insurance type</h2>
        {report.typeBreakdown.map(type => <div key={type.policyType} className="mb-3"><div className="flex justify-between text-sm"><span>{type.policyType}</span><span>{type.count} ({type.percentage.toFixed(1)}%)</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${type.percentage}%` }} /></div></div>)}
        {report.typeBreakdown.length === 0 && <p className="text-sm text-slate-500">No policies in this period.</p>}
      </div>
    </>}
  </div>;
}
