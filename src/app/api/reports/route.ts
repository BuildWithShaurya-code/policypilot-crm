import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';
import { AnalyticsService, getDateRangeFromPreset, DateRangePreset } from '@/lib/services/analytics-service';
import { normalizeDate } from '@/lib/import/normalizer';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { searchParams } = new URL(request.url);
  const preset = (searchParams.get('preset') as DateRangePreset) || 'last_30_days';
  const customStart = searchParams.get('startDate') || undefined;
  const customEnd = searchParams.get('endDate') || undefined;

  if (!['last_7_days', 'last_30_days', 'last_90_days', 'this_year', 'custom'].includes(preset)) {
    return errorResponse('Choose a valid report period', 400);
  }
  if (preset === 'custom' && (!customStart || !customEnd || normalizeDate(customStart).date !== customStart || normalizeDate(customEnd).date !== customEnd || customStart > customEnd)) {
    return errorResponse('Provide valid start and end dates with the start on or before the end', 400);
  }

  const range = getDateRangeFromPreset(preset, customStart, customEnd);
  const result = await AnalyticsService.getReportsData(range, auth.supabase);

  if (result.error || !result.data) {
    return errorResponse(result.error || 'Failed to generate report', 400);
  }

  return jsonResponse(result.data);
}
