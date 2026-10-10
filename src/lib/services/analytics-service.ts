import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Policy, Activity } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { getTodayDateString, formatDateInIndia } from '@/lib/date-utils';
import { readAllPages } from '@/lib/supabase/pagination';

export type DateRangePreset = 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_year' | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface ReportSummaryMetrics {
  totalPolicies: number;
  policiesDue: number;
  renewedPolicies: number;
  renewalRate: number | null; // null represents N/A
  premiumRenewed: number;
  totalPremiumDue: number;
}

export interface MonthlyBreakdownRow {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g. "Oct 2026"
  policiesDue: number;
  contacted: number;
  quotesSent: number;
  renewed: number;
  pending: number;
  renewalRate: number | null;
}

export interface PolicyStatusBreakdown {
  active: number;
  pendingRenewal: number;
  expired: number;
  renewed: number;
  total: number;
}

export interface PolicyTypeBreakdown {
  policyType: string;
  count: number;
  totalPremium: number;
  percentage: number;
}

export interface FullReportData {
  dateRange: DateRange;
  summary: ReportSummaryMetrics;
  monthlyBreakdown: MonthlyBreakdownRow[];
  statusBreakdown: PolicyStatusBreakdown;
  typeBreakdown: PolicyTypeBreakdown[];
  totalActivitiesCount: number;
}

/**
 * Format local Date to YYYY-MM-DD
 */
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate DateRange from preset
 */
export function getDateRangeFromPreset(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
): DateRange {
  const now = new Date();
  const todayStr = getTodayDateString();

  if (preset === 'custom' && customStart && customEnd) {
    return { preset, startDate: customStart, endDate: customEnd };
  }

  const startDate = new Date();
  if (preset === 'last_7_days') {
    startDate.setDate(now.getDate() - 7);
  } else if (preset === 'last_30_days') {
    startDate.setDate(now.getDate() - 30);
  } else if (preset === 'last_90_days') {
    startDate.setDate(now.getDate() - 90);
  } else if (preset === 'this_year') {
    return {
      preset,
      startDate: `${todayStr.slice(0, 4)}-01-01`,
      endDate: todayStr,
    };
  } else {
    // Default to last 30 days
    startDate.setDate(now.getDate() - 30);
  }

  return {
    preset,
    startDate: getTodayDateString(preset === 'last_7_days' ? -7 : preset === 'last_90_days' ? -90 : -30),
    endDate: todayStr,
  };
}

export class AnalyticsService {
  /**
   * Generates comprehensive report data for the authenticated broker.
   * Single aggregated batch query fetches all relevant data respecting RLS.
   */
  static async getReportsData(
    range: DateRange,
    clientInstance?: SupabaseClient
  ): Promise<{ data: FullReportData | null; error: string | null }> {
    const supabase = clientInstance || getSupabaseBrowserClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      // Batch query 1: All policies with joined customer (RLS filters by owner_id)
      const policiesPromise = (from: number, to: number) => supabase
        .from('policies')
        .select('*, customer:customers(name, phone, email)')
        .eq('owner_id', user.id)
        .order('expiry_date', { ascending: true }).order('id').range(from, to);

      // Batch query 2: Activities within or around reporting range
      const activitiesPromise = (from: number, to: number) => supabase
        .from('activities')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }).order('id').range(from, to);

      const [policies, activities] = await Promise.all([
        readAllPages<Policy>(policiesPromise),
        readAllPages<Activity>(activitiesPromise),
      ]);

      const todayStr = getTodayDateString();
      const inRange = (date: string) => date >= range.startDate && date <= range.endDate;

      // -------------------------------------------------------------
      // 1. Policy Status Breakdown (Whole Portfolio)
      // -------------------------------------------------------------
      let activeCount = 0;
      let pendingRenewalCount = 0;
      let expiredCount = 0;
      let renewedCount = 0;

      for (const p of policies) {
        const isRenewed = p.status === 'renewed' || p.renewal_status === 'renewed';
        if (isRenewed) {
          renewedCount++;
        } else if (p.expiry_date < todayStr) {
          expiredCount++;
        } else {
          // Check if pending renewal (due within 30 days)
          const daysToExpiry = Math.round(
            (new Date(p.expiry_date).getTime() - new Date(todayStr).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          if (daysToExpiry <= 30) {
            pendingRenewalCount++;
          } else {
            activeCount++;
          }
        }
      }

      const statusBreakdown: PolicyStatusBreakdown = {
        active: activeCount,
        pendingRenewal: pendingRenewalCount,
        expired: expiredCount,
        renewed: renewedCount,
        total: policies.length,
      };

      // -------------------------------------------------------------
      // 2. Filter Policies Due within Selected Date Range
      // -------------------------------------------------------------
      const policiesDueInRange = policies.filter(
        (p) => p.expiry_date >= range.startDate && p.expiry_date <= range.endDate
      );

      // Find renewed policies in this range:
      // Either expiry_date in range and marked renewed, or has a policy_renewed activity within range
      const renewedPolicyIdsInRange = new Set<string>();

      // From activities
      activities.forEach((act) => {
        if (act.type === 'policy_renewed' && act.policy_id) {
          const actDate = formatDateInIndia(act.created_at);
          if (actDate >= range.startDate && actDate <= range.endDate) {
            renewedPolicyIdsInRange.add(act.policy_id);
          }
        }
      });

      // From policies whose expiry is in range and status is renewed
      policiesDueInRange.forEach((p) => {
        if (p.status === 'renewed' || p.renewal_status === 'renewed') {
          renewedPolicyIdsInRange.add(p.id);
        }
      });

      const renewedPoliciesList = policies.filter((p) =>
        renewedPolicyIdsInRange.has(p.id)
      );

      const policiesDueCount = policiesDueInRange.length;
      const renewedCountInRange = renewedPoliciesList.length;

      // Handle Policies Due = 0 gracefully
      const renewalRate =
        policiesDueCount > 0
          ? Math.min(100, Math.round((renewedCountInRange / policiesDueCount) * 1000) / 10)
          : null;

      const premiumRenewed = renewedPoliciesList.reduce(
        (sum, p) => sum + (Number(p.premium) || 0),
        0
      );

      const totalPremiumDue = policiesDueInRange.reduce(
        (sum, p) => sum + (Number(p.premium) || 0),
        0
      );

      const summary: ReportSummaryMetrics = {
        totalPolicies: policies.length,
        policiesDue: policiesDueCount,
        renewedPolicies: renewedCountInRange,
        renewalRate,
        premiumRenewed,
        totalPremiumDue,
      };

      // -------------------------------------------------------------
      // 3. Policies by Insurance Type
      // -------------------------------------------------------------
      const typeMap = new Map<string, { count: number; premium: number }>();
      policies.forEach((p) => {
        const type = (p.policy_type || 'Other Insurance').trim();
        const cur = typeMap.get(type) || { count: 0, premium: 0 };
        cur.count++;
        cur.premium += Number(p.premium) || 0;
        typeMap.set(type, cur);
      });

      const typeBreakdown: PolicyTypeBreakdown[] = Array.from(typeMap.entries())
        .map(([type, stats]) => ({
          policyType: type,
          count: stats.count,
          totalPremium: stats.premium,
          percentage:
            policies.length > 0 ? Math.round((stats.count / policies.length) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // -------------------------------------------------------------
      // 4. Monthly Renewal Performance Table & Chart
      // -------------------------------------------------------------
      // Show only months covered by the selected reporting period.
      const monthKeys: string[] = [];
      const tempCursor = new Date(`${range.startDate.slice(0, 7)}-01T00:00:00Z`);
      const endLimit = new Date(`${range.endDate.slice(0, 7)}-01T00:00:00Z`);
      while (tempCursor <= endLimit) {
        const y = tempCursor.getUTCFullYear();
        const m = String(tempCursor.getUTCMonth() + 1).padStart(2, '0');
        const key = `${y}-${m}`;
        if (!monthKeys.includes(key)) {
          monthKeys.push(key);
        }
        tempCursor.setUTCMonth(tempCursor.getUTCMonth() + 1);
      }

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const monthlyBreakdown: MonthlyBreakdownRow[] = monthKeys.map((mKey) => {
        const [yearStr, monthNumStr] = mKey.split('-');
        const monthIndex = parseInt(monthNumStr, 10) - 1;
        const monthLabel = `${monthNames[monthIndex]} ${yearStr}`;

        // Policies due in this month
        const dueInMonth = policiesDueInRange.filter((p) => p.expiry_date.startsWith(mKey));

        // Policies renewed in this month
        const renewedIdsInMonth = new Set(dueInMonth.filter(p => p.status === 'renewed' || p.renewal_status === 'renewed').map(p => p.id));
        activities.forEach(act => {
          const date = formatDateInIndia(act.created_at);
          if (act.type === 'policy_renewed' && act.policy_id && date.startsWith(mKey) && inRange(date) && policies.some(p => p.id === act.policy_id)) renewedIdsInMonth.add(act.policy_id);
        });

        // Contact activities in this month
        const contactedInMonth = activities.filter((act) => {
          const actDate = formatDateInIndia(act.created_at);
          return (
            inRange(actDate) && actDate.startsWith(mKey) &&
            (act.type === 'customer_contacted' ||
              act.type === 'renewal_status_updated' ||
              act.type === 'follow_up_created')
          );
        }).length;

        // Quotes sent in this month
        const quotesInMonth = activities.filter((act) => {
          const actDate = formatDateInIndia(act.created_at);
          return (
            inRange(actDate) && actDate.startsWith(mKey) &&
            (act.type === 'quote_sent' ||
              (act.metadata && (act.metadata as Record<string, unknown>).new_status === 'quote_sent'))
          );
        }).length;

        const dueCount = dueInMonth.length;
        const renCount = renewedIdsInMonth.size;
        const pendingCount = Math.max(0, dueCount - renCount);
        const rate =
          dueCount > 0 ? Math.min(100, Math.round((renCount / dueCount) * 1000) / 10) : null;

        return {
          monthKey: mKey,
          monthLabel,
          policiesDue: dueCount,
          contacted: contactedInMonth,
          quotesSent: quotesInMonth,
          renewed: renCount,
          pending: pendingCount,
          renewalRate: rate,
        };
      });

      return {
        data: {
          dateRange: range,
          summary,
          monthlyBreakdown,
          statusBreakdown,
          typeBreakdown,
          totalActivitiesCount: activities.filter(act => inRange(formatDateInIndia(act.created_at))).length,
        },
        error: null,
      };
    } catch (err: unknown) {
      console.error('AnalyticsService error:', err);
      return { data: null, error: err instanceof Error ? err.message : 'Failed to generate report' };
    }
  }

  /**
   * Export report data to CSV or Excel (.xlsx)
   */
  static exportReport(report: FullReportData, format: 'csv' | 'xlsx'): void {
    // 1. Sheet 1: Executive Summary
    const summaryData = [
      { Metric: 'Reporting Period', Value: `${report.dateRange.startDate} to ${report.dateRange.endDate}` },
      { Metric: 'Total Portfolio Policies', Value: report.summary.totalPolicies },
      { Metric: 'Policies Due for Renewal', Value: report.summary.policiesDue },
      { Metric: 'Renewed Policies', Value: report.summary.renewedPolicies },
      {
        Metric: 'Renewal Rate',
        Value: report.summary.renewalRate !== null ? `${report.summary.renewalRate}%` : 'N/A',
      },
      { Metric: 'Premium Renewed (INR)', Value: report.summary.premiumRenewed },
      { Metric: 'Total Premium Due (INR)', Value: report.summary.totalPremiumDue },
    ];

    // 2. Sheet 2: Monthly Renewal Breakdown
    const monthlyData = report.monthlyBreakdown.map((row) => ({
      Month: row.monthLabel,
      'Policies Due': row.policiesDue,
      Contacted: row.contacted,
      'Quotes Sent': row.quotesSent,
      Renewed: row.renewed,
      Pending: row.pending,
      'Renewal Rate': row.renewalRate !== null ? `${row.renewalRate}%` : 'N/A',
    }));

    // 3. Sheet 3: Insurance Type Breakdown
    const typeData = report.typeBreakdown.map((t) => ({
      'Insurance Type': t.policyType,
      'Policy Count': t.count,
      'Total Premium (INR)': t.totalPremium,
      'Share of Portfolio (%)': `${t.percentage}%`,
    }));

    // 4. Sheet 4: Status Breakdown
    const statusData = [
      { Status: 'Active', Count: report.statusBreakdown.active },
      { Status: 'Pending Renewal (<= 30 Days)', Count: report.statusBreakdown.pendingRenewal },
      { Status: 'Expired / Overdue', Count: report.statusBreakdown.expired },
      { Status: 'Renewed', Count: report.statusBreakdown.renewed },
      { Status: 'Total Policies', Count: report.statusBreakdown.total },
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsMonthly = XLSX.utils.json_to_sheet(monthlyData);
    const wsType = XLSX.utils.json_to_sheet(typeData);
    const wsStatus = XLSX.utils.json_to_sheet(statusData);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');
    XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly Performance');
    XLSX.utils.book_append_sheet(wb, wsType, 'Insurance Types');
    XLSX.utils.book_append_sheet(wb, wsStatus, 'Policy Statuses');

    const fileName = `PolicyPilot_Report_${report.dateRange.startDate}_to_${report.dateRange.endDate}.${format === 'csv' ? 'csv' : 'xlsx'}`;

    if (format === 'csv') {
      // Export primary monthly performance sheet as CSV
      XLSX.writeFile(wb, fileName, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
    }
  }
}
