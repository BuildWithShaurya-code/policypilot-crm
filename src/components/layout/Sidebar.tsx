import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  RefreshCw, 
  Upload, 
  PhoneCall, 
  BarChart3, 
  Settings, 
  ShieldCheck, 
  X,
  LogOut
} from 'lucide-react';
import { useApp, ScreenType } from '../../context/AppContext';
import { useAuth } from '@/context/auth-context';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const { currentScreen, navigateTo, metrics } = useApp();
  const { user, profile, signOut } = useAuth();

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Broker';
  const initial = displayName.charAt(0).toUpperCase() || 'B';
  const agencyName = profile?.business_name || 'Insurance Broker';

  const navItems: Array<{
    id: ScreenType;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    badgeColor?: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5 shrink-0" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-5 h-5 shrink-0" /> },
    { id: 'policies', label: 'Policies', icon: <FileText className="w-5 h-5 shrink-0" /> },
    { 
      id: 'renewals', 
      label: 'Renewals', 
      icon: <RefreshCw className="w-5 h-5 shrink-0" />,
      badge: metrics.expiringToday,
      badgeColor: 'bg-red-500 text-white'
    },
    { id: 'import', label: 'Import Excel', icon: <Upload className="w-5 h-5 shrink-0" /> },
    { 
      id: 'follow-ups', 
      label: 'Follow-ups', 
      icon: <PhoneCall className="w-5 h-5 shrink-0" />,
      badge: metrics.todayFollowUps,
      badgeColor: 'bg-blue-600 text-white'
    },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5 shrink-0" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5 shrink-0" /> },
  ];

  const handleNavClick = (screen: ScreenType) => {
    navigateTo(screen);
    onCloseMobile();
  };

  const content = (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-300 w-64 select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div 
          onClick={() => handleNavClick('dashboard')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-500 transition-colors">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-white text-base tracking-tight leading-tight flex items-center gap-1.5">
              PolicyPilot
            </span>
            <span className="text-[11px] text-slate-400 truncate">
              Your insurance business, organized.
            </span>
          </div>
        </div>

        {/* Mobile close button */}
        <button 
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
          Main Menu
        </div>
        {navItems.map((item) => {
          const isActive = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-white' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Excel Action */}
      <div className="p-3 mx-3 mb-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
        <div className="text-xs font-semibold text-white mb-1 flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5 text-blue-400" />
          <span>Excel Quick Import</span>
        </div>
        <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
          Import client lists, auto-detect policies & expiry dates.
        </p>
        <button
          onClick={() => handleNavClick('import')}
          className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
        >
          <span>Upload Spreadsheet</span>
        </button>
      </div>

      {/* User Profile & Footer */}
      <div className="p-3 border-t border-slate-800 bg-[#0B1424] flex items-center justify-between shrink-0">
        <div 
          onClick={() => handleNavClick('settings')}
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 min-w-0"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-slate-800 shrink-0">
            {initial}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-white truncate">{displayName}</span>
            <span className="text-[10px] text-slate-400 truncate">{agencyName}</span>
          </div>
        </div>

        <button
          onClick={async () => {
            if (window.confirm('Are you sure you want to log out of PolicyPilot?')) {
              await signOut();
            }
          }}
          title="Sign Out"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 z-30">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
