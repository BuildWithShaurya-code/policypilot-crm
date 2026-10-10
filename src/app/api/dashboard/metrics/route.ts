import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';
import type { Policy, FollowUp } from '@/types/database.types';
import { getTodayDateString, checkIsOverdue } from '@/lib/date-utils';
import { readAllPages } from '@/lib/supabase/pagination';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  try {
    // 1. Fetch policies and follow-ups in parallel
    const [policies, followUps] = await Promise.all([
      readAllPages<Policy>((from, to) => auth.supabase.from('policies').select('*').eq('owner_id', auth.user.id).order('id').range(from, to)),
      readAllPages<FollowUp>((from, to) => auth.supabase.from('follow_ups').select('*').eq('owner_id', auth.user.id).order('id').range(from, to)),
    ]);

    const todayStr = getTodayDateString();
    const next7DaysStr = getTodayDateString(7);
    const next30DaysStr = getTodayDateString(30);

    let expiringToday = 0;
    let next7Days = 0;
    let next30Days = 0;
    let overdue = 0;
    let activeCount = 0;
    let renewedCount = 0;
    let expiredCount = 0;
    let totalAUM = 0;

    for (const p of policies) {
      const prem = Number(p.premium) || 0;
      totalAUM += prem;
      const isRenewed = p.status === 'renewed' || p.renewal_status === 'renewed';

      if (isRenewed) {
        renewedCount++;
      } else if (p.expiry_date < todayStr) {
        expiredCount++;
        overdue++;
      } else {
        activeCount++;
        if (p.expiry_date === todayStr) {
          expiringToday++;
        }
        if (p.expiry_date >= todayStr && p.expiry_date <= next7DaysStr) {
          next7Days++;
        }
        if (p.expiry_date >= todayStr && p.expiry_date <= next30DaysStr) {
          next30Days++;
        }
      }
    }

    let todayFollowUps = 0;
    let upcomingFollowUps = 0;
    let completedFollowUps = 0;
    let overdueFollowUps = 0;

    for (const fu of followUps) {
      const isCompleted = fu.status === 'completed';
      const isOverdue = checkIsOverdue(fu.scheduled_date, fu.scheduled_time, fu.status);

      if (isCompleted) {
        completedFollowUps++;
      } else if (isOverdue) {
        overdueFollowUps++;
      } else if (fu.scheduled_date === todayStr) {
        todayFollowUps++;
      } else {
        upcomingFollowUps++;
      }
    }

    const totalPortfolio = activeCount + renewedCount + expiredCount;
    const renewalRate =
      totalPortfolio > 0 ? Number(((renewedCount / totalPortfolio) * 100).toFixed(1)) : 0;

    const metrics = {
      expiringToday,
      next7Days,
      next30Days,
      overdue,
      activeCount,
      activePolicies: activeCount,
      renewedCount,
      expiredCount,
      todayFollowUps,
      upcomingFollowUps,
      completedFollowUps,
      overdueFollowUps,
      totalAUM,
      renewalRate,
    };

    return jsonResponse(metrics);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve dashboard metrics';
    return errorResponse(msg, 500);
  }
}
