import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';

interface UserSettingsPrefs {
  daily_summary_email?: boolean;
  renewal_reminders?: boolean;
  follow_up_reminders?: boolean;
  notification_email?: string | null;
  dailyReminderTime?: string;
  reminderDays?: {
    thirtyDays?: boolean;
    fifteenDays?: boolean;
    sevenDays?: boolean;
    oneDay?: boolean;
    onExpiry?: boolean;
  };
  notifications?: {
    emailRenewals?: boolean;
    emailDailySummary?: boolean;
    emailFollowUps?: boolean;
    emailImports?: boolean;
    whatsappRenewals?: boolean;
    whatsappFollowUps?: boolean;
  };
  importPreferences?: {
    duplicateHandling?: string;
    dateFormat?: string;
    defaultPolicyStatus?: string;
  };
}

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { data: profile, error } = await auth.supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .single();

  if (error || !profile) {
    return errorResponse(error?.message || 'Profile not found', 404);
  }

  const prefs = (profile.notification_preferences as unknown as UserSettingsPrefs | null) || {};

  const settings = {
    businessName: profile.business_name || 'PolicyPilot Advisory',
    ownerName: profile.full_name || 'Broker',
    mobile: profile.phone || '',
    email: prefs.notification_email || profile.email || auth.user.email || '',
    address: profile.business_address || '',
    dailyReminderTime: prefs.dailyReminderTime || '09:00',
    reminderDays: prefs.reminderDays || {
      thirtyDays: true,
      fifteenDays: true,
      sevenDays: true,
      oneDay: true,
      onExpiry: true,
    },
    notifications: prefs.notifications || {
      emailRenewals: prefs.renewal_reminders ?? true,
      emailDailySummary: prefs.daily_summary_email ?? true,
      emailFollowUps: prefs.follow_up_reminders ?? true,
      emailImports: true,
      whatsappRenewals: false,
      whatsappFollowUps: false,
    },
    importPreferences: prefs.importPreferences || {
      duplicateHandling: 'skip',
      dateFormat: 'YYYY-MM-DD',
      defaultPolicyStatus: 'Active',
    },
  };

  return jsonResponse(settings);
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  try {
    const body = await request.json();

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.businessName !== undefined) updatePayload.business_name = body.businessName;
    if (body.ownerName !== undefined) updatePayload.full_name = body.ownerName;
    if (body.mobile !== undefined) updatePayload.phone = body.mobile;
    if (body.address !== undefined) updatePayload.business_address = body.address;

    // Fetch existing preferences to merge
    const { data: existingProfile } = await auth.supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', auth.user.id)
      .single();

    const existingPrefs = (existingProfile?.notification_preferences as unknown as UserSettingsPrefs | null) || {};

    const mergedPrefs = {
      ...existingPrefs,
      daily_summary_email: body.notifications?.emailDailySummary ?? existingPrefs.daily_summary_email ?? true,
      renewal_reminders: body.notifications?.emailRenewals ?? existingPrefs.renewal_reminders ?? true,
      follow_up_reminders: body.notifications?.emailFollowUps ?? existingPrefs.follow_up_reminders ?? true,
      notification_email: body.email || existingPrefs.notification_email,
      dailyReminderTime: body.dailyReminderTime || existingPrefs.dailyReminderTime,
      reminderDays: body.reminderDays || existingPrefs.reminderDays,
      notifications: body.notifications || existingPrefs.notifications,
      importPreferences: body.importPreferences || existingPrefs.importPreferences,
    };

    updatePayload.notification_preferences = mergedPrefs;

    const { data: updatedProfile, error } = await auth.supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', auth.user.id)
      .select('*')
      .single();

    if (error) {
      return errorResponse(error.message, 400);
    }

    const updatedSettings = {
      businessName: updatedProfile.business_name || '',
      ownerName: updatedProfile.full_name || '',
      mobile: updatedProfile.phone || '',
      email: mergedPrefs.notification_email || updatedProfile.email || '',
      address: updatedProfile.business_address || '',
      dailyReminderTime: mergedPrefs.dailyReminderTime || '09:00',
      reminderDays: mergedPrefs.reminderDays,
      notifications: mergedPrefs.notifications,
      importPreferences: mergedPrefs.importPreferences,
    };

    return jsonResponse(updatedSettings);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid request payload';
    return errorResponse(msg, 400);
  }
}
