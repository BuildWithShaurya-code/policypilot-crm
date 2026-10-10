import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  RefreshCw, 
  PhoneCall 
} from 'lucide-react';
import { useApp, ScreenType } from '../../context/AppContext';

export const MobileNav: React.FC = () => {
  const { currentScreen, navigateTo, metrics } = useApp();

  const tabs: Array<{
    id: ScreenType;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: 'dashboard', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'customers', label: 'Clients', icon: <Users className="w-5 h-5" /> },
    { id: 'policies', label: 'Policies', icon: <FileText className="w-5 h-5" /> },
    { 
      id: 'renewals', 
      label: 'Renewals', 
      icon: <RefreshCw className="w-5 h-5" />, 
      badge: metrics.expiringToday 
    },
    { 
      id: 'follow-ups', 
      label: 'Follow-ups', 
      icon: <PhoneCall className="w-5 h-5" />, 
      badge: metrics.todayFollowUps 
    },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
      {tabs.map((tab) => {
        const isActive = currentScreen === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => navigateTo(tab.id)}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all relative ${
              isActive 
                ? 'text-blue-600 font-semibold' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              {tab.icon}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
