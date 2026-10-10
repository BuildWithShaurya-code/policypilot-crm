import React, { useState } from 'react';
import { Menu, Search, Bell, Upload, Calendar, PhoneCall, AlertTriangle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '@/context/auth-context';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { user, profile } = useAuth();
  const { 
    globalSearch, 
    setGlobalSearch, 
    navigateTo, 
    metrics, 
    policies,
    followUps,
    openPolicyDrawer
  } = useApp();

  const displayName = profile?.full_name || profile?.business_name || user?.email?.split('@')[0] || 'Broker';
  const initials = displayName.slice(0, 2).toUpperCase();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Recent high priority notifications
  const criticalPolicies = policies.filter(p => p.status === 'Due Today' || p.status === 'Expiring Soon').slice(0, 4);
  const todayFollowUpsList = followUps.filter(f => f.status === 'Pending').slice(0, 3);

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-xs">
      {/* Left: Mobile trigger & Search */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-xl">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search customer, phone, policy number..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 transition-all"
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right: Actions, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Date pill */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100/80 text-slate-600 text-xs font-medium border border-slate-200/60">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>

        {/* Import Excel Button */}
        <button
          onClick={() => navigateTo('import')}
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all"
        >
          <Upload className="w-4 h-4" />
          <span>Import Excel</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {metrics.expiringToday > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>

          {isNotificationsOpen && (
            <>
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setIsNotificationsOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">
                      {metrics.expiringToday} Urgent
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      navigateTo('renewals');
                      setIsNotificationsOpen(false);
                    }}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    View Renewals
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {criticalPolicies.map((p) => (
                    <div 
                      key={p.id}
                      onClick={() => {
                        openPolicyDrawer(p);
                        setIsNotificationsOpen(false);
                      }}
                      className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-900 truncate">{p.customerName}</p>
                          <span className="text-[10px] text-red-600 font-bold">{p.status}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{p.policyType} ({p.policyNumber})</p>
                        <p className="text-[11px] text-slate-600 font-medium mt-0.5">₹{p.premium.toLocaleString('en-IN')} • Expiry: {p.expiryDate}</p>
                      </div>
                    </div>
                  ))}

                  {todayFollowUpsList.map((f) => (
                    <div 
                      key={f.id}
                      onClick={() => {
                        navigateTo('follow-ups');
                        setIsNotificationsOpen(false);
                      }}
                      className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        <PhoneCall className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-900 truncate">{f.customerName}</p>
                          <span className="text-[10px] text-slate-500 font-medium">{f.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{f.reason}: {f.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
                  <button 
                    onClick={() => {
                      navigateTo('renewals');
                      setIsNotificationsOpen(false);
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                  >
                    All Reminders & Renewals
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Avatar */}
        <button
          onClick={() => navigateTo('settings')}
          className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-slate-100 transition-colors text-left"
          title="Account Settings"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-slate-100 shadow-xs">
            {initials}
          </div>
          <span className="hidden xl:inline text-xs font-semibold text-slate-800">
            {displayName}
          </span>
        </button>
      </div>
    </header>
  );
};
