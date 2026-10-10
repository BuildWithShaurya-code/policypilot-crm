import React, { useState } from 'react';
import { Building2, User, Bell, Clock, FileSpreadsheet, ShieldCheck, RotateCcw, Save, Download, FolderArchive } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '@/context/auth-context';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export const SettingsScreen: React.FC = () => {
  const { settings, updateSettings, resetToDefaults, showToast } = useApp();
  const { user, profile, signOut } = useAuth();

  const accountName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Broker';
  const accountEmail = user?.email || profile?.email || 'Email unavailable';
  const accountRole = 'Agency Owner';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.email || !currentPassword || newPassword.length < 8) {
      showToast('Enter your current password and a new password of at least 8 characters', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const verified = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (verified.error) throw new Error('Current password is incorrect');
      const updated = await supabase.auth.updateUser({ password: newPassword });
      if (updated.error) throw updated.error;
      setCurrentPassword('');
      setNewPassword('');
      showToast('Password updated', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to change password', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const [activeTab, setActiveTab] = useState<
    'business' | 'account' | 'notifications' | 'reminders' | 'import' | 'security'
  >('business');

  // Business profile local state
  const [businessName, setBusinessName] = useState(settings.businessName);
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [mobile, setMobile] = useState(settings.mobile);
  const [email, setEmail] = useState(settings.email);
  const [address, setAddress] = useState(settings.address);

  // Reminders state
  const [reminderTime, setReminderTime] = useState(settings.dailyReminderTime);
  const [reminderDays, setReminderDays] = useState(settings.reminderDays);

  // Notification state
  const [notifications, setNotifications] = useState(settings.notifications);

  // Import preferences state
  const [duplicateHandling, setDuplicateHandling] = useState(settings.importPreferences.duplicateHandling);
  const [dateFormat, setDateFormat] = useState(settings.importPreferences.dateFormat);
  const [defaultPolicyStatus, setDefaultPolicyStatus] = useState(settings.importPreferences.defaultPolicyStatus);

  const saveSettings = (updates: Parameters<typeof updateSettings>[0]) => {
    // The shared action shows the server error; consume its rejected promise.
    void updateSettings(updates).catch(() => {});
  };

  const handleSaveBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({
      businessName,
      ownerName,
      mobile,
      email,
      address,
    });
  };

  const handleSaveReminders = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({
      dailyReminderTime: reminderTime,
      reminderDays,
    });
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({
      notifications,
    });
  };

  const handleSaveImportPrefs = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({
      importPreferences: {
        duplicateHandling,
        dateFormat,
        defaultPolicyStatus,
      },
    });
  };

  const tabs = [
    { id: 'business', label: 'Business Profile', icon: <Building2 className="w-4 h-4" /> },
    { id: 'account', label: 'Account', icon: <User className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'reminders', label: 'Renewal Reminders', icon: <Clock className="w-4 h-4" /> },
    { id: 'import', label: 'Import Preferences', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <ShieldCheck className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Header */}
      <div className="pt-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your business preferences, agency profile, automated triggers, and account security.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Settings Navigation Sidebar (3 Cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-2 shadow-2xs space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}

          <div className="pt-2 border-t border-slate-100 space-y-1">
            {process.env.NODE_ENV !== 'production' && <a
              href="/policypilot-frontend.zip"
              download="policypilot-frontend.zip"
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-blue-600" />
                <span>Download ZIP</span>
              </div>
              <Download className="w-3.5 h-3.5" />
            </a>}

            <button
              onClick={() => {
                if (window.confirm('Reload the latest records from the database?')) {
                  resetToDefaults();
                }
              }}
              className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Refresh Records</span>
            </button>
          </div>
        </div>

        {/* Settings Content Area (9 Cols) */}
        <div className="lg:col-span-9 bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
          {/* TAB 1: BUSINESS PROFILE */}
          {activeTab === 'business' && (
            <form onSubmit={handleSaveBusiness} className="space-y-5">
              <div className="pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Business Profile</h2>
                <p className="text-xs text-slate-500 mt-0.5">Agency credentials shown on quotes and client communications.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Business Name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Mobile Contact</label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Official Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">Business Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: ACCOUNT */}
          {activeTab === 'account' && (
            <div className="space-y-5">
              <div className="pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">User Account</h2>
                <p className="text-xs text-slate-500 mt-0.5">Advisor login credentials and session control.</p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-4 bg-slate-50 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-900 block">{accountName}</span>
                    <span className="text-slate-500 font-mono">{accountEmail}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px]">
                    {accountRole}
                  </span>
                </div>

                <form onSubmit={handleChangePassword} className="p-4 rounded-xl border border-slate-200 space-y-3">
                  <h3 className="font-bold text-slate-900">Change Password</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="password"
                      placeholder="Current Password"
                      aria-label="Current Password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    />
                    <input
                      type="password"
                      placeholder="New Password"
                      aria-label="New Password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      required
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    {changingPassword ? 'Updating…' : 'Update Password'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <form onSubmit={handleSaveNotifications} className="space-y-5">
              <div className="pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Notification Alerts</h2>
                <p className="text-xs text-slate-500 mt-0.5">Email automation is simulated. These preferences do not deliver real email or WhatsApp messages.</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider mb-2">Email Notifications</h3>
                  <div className="space-y-2">
                    {[
                      { key: 'emailRenewals', label: 'Renewal reminder alerts for expiring policies' },
                      { key: 'emailDailySummary', label: 'Daily morning briefing (due today & overdue list)' },
                      { key: 'emailFollowUps', label: 'Follow-up task reminders 15 minutes prior' },
                      { key: 'emailImports', label: 'Spreadsheet import completion summary reports' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications[item.key as keyof typeof notifications]}
                          onChange={(e) =>
                            setNotifications((prev) => ({ ...prev, [item.key]: e.target.checked }))
                          }
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <span className="font-medium text-slate-800">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider mb-2">WhatsApp Direct Triggers</h3>
                  <div className="space-y-2">
                    {[
                      { key: 'whatsappRenewals', label: 'Auto-draft WhatsApp renewal template on 7-day trigger' },
                      { key: 'whatsappFollowUps', label: 'Follow-up appointment ping on advisor phone' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications[item.key as keyof typeof notifications]}
                          onChange={(e) =>
                            setNotifications((prev) => ({ ...prev, [item.key]: e.target.checked }))
                          }
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <span className="font-medium text-slate-800">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Notification Preferences</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: RENEWAL REMINDERS */}
          {activeTab === 'reminders' && (
            <form onSubmit={handleSaveReminders} className="space-y-5">
              <div className="pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Renewal Reminders Cadence</h2>
                <p className="text-xs text-slate-500 mt-0.5">Specify when PolicyPilot highlights impending expirations.</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Daily Morning Notification Dispatch Time
                  </label>
                  <input
                    type="text"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <span className="font-bold text-slate-900 block mb-1">Trigger Intervals:</span>
                  {[
                    { key: 'thirtyDays', label: '30 days before policy expiry' },
                    { key: 'fifteenDays', label: '15 days before policy expiry' },
                    { key: 'sevenDays', label: '7 days before policy expiry (Urgent Warning)' },
                    { key: 'oneDay', label: '1 day before policy expiry (Grace Alert)' },
                    { key: 'onExpiry', label: 'On exact expiry date' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reminderDays[item.key as keyof typeof reminderDays]}
                        onChange={(e) =>
                          setReminderDays((prev) => ({ ...prev, [item.key]: e.target.checked }))
                        }
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      />
                      <span className="font-medium text-slate-800">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Reminder Schedule</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 5: IMPORT PREFERENCES */}
          {activeTab === 'import' && (
            <form onSubmit={handleSaveImportPrefs} className="space-y-5">
              <div className="pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Import Preferences</h2>
                <p className="text-xs text-slate-500 mt-0.5">Control Excel data normalization and duplicate reconciliation.</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Duplicate Policy Handling Policy
                  </label>
                  <select
                    value={duplicateHandling}
                    onChange={(e) => setDuplicateHandling(e.target.value as typeof duplicateHandling)}
                    className="w-full max-w-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600"
                  >
                    <option value="ask">Ask Before Updating (Prompt on review)</option>
                    <option value="skip">Skip Duplicates (Do not overwrite existing)</option>
                    <option value="update">Update Existing (Merge latest premium/dates)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Standard Date Format
                  </label>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="w-full max-w-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (Indian Standard)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Default Ingested Policy Status
                  </label>
                  <select
                    value={defaultPolicyStatus}
                    onChange={(e) => setDefaultPolicyStatus(e.target.value as typeof defaultPolicyStatus)}
                    className="w-full max-w-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600"
                  >
                    <option value="Active">Active</option>
                    <option value="Expiring Soon">Expiring Soon</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Import Preferences</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 6: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-5 text-xs">
              <div className="pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Security & Authentication</h2>
                <p className="text-xs text-slate-500 mt-0.5">Device sessions and data access controls.</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">Current signed-in account</p>
                <p className="text-slate-500 mt-2">{accountEmail}</p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => { void signOut(); }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
