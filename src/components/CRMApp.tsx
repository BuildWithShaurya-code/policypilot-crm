'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { AppProvider, useApp, ScreenType } from '@/context/AppContext';
import { Sidebar } from './layout/Sidebar';
import { Header } from './layout/Header';
import { MobileNav } from './layout/MobileNav';
import { ToastContainer } from './common/Toast';

import { DashboardScreen } from './dashboard/DashboardScreen';
import { CustomersScreen } from './customers/CustomersScreen';
import { PoliciesScreen } from './policies/PoliciesScreen';
import { RenewalsScreen } from './renewals/RenewalsScreen';
import { ImportScreen } from './import/ImportScreen';
import { FollowUpsScreen } from './followups/FollowUpsScreen';
import { LiveReportsScreen } from './reports/LiveReportsScreen';
import { SettingsScreen } from './settings/SettingsScreen';

import { CustomerDrawer } from './customers/CustomerDrawer';
import { PolicyDrawer } from './policies/PolicyDrawer';
import { AddCustomerModal } from './customers/AddCustomerModal';
import { AddPolicyModal } from './policies/AddPolicyModal';
import { AddFollowUpModal } from './followups/AddFollowUpModal';
import { Shield, Loader2 } from 'lucide-react';

interface CRMAppProps {
  initialScreen?: ScreenType;
}

const AppContent: React.FC = () => {
  const { currentScreen, isLoading } = useApp();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'customers':
        return <CustomersScreen />;
      case 'policies':
        return <PoliciesScreen />;
      case 'renewals':
        return <RenewalsScreen />;
      case 'import':
        return <ImportScreen />;
      case 'follow-ups':
        return <FollowUpsScreen />;
      case 'reports':
        return <LiveReportsScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827] flex font-sans antialiased">
      {/* Desktop & Mobile Sidebar */}
      <Sidebar 
        mobileOpen={mobileSidebarOpen} 
        onCloseMobile={() => setMobileSidebarOpen(false)} 
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header */}
        <Header onOpenMobileMenu={() => setMobileSidebarOpen(true)} />

        {/* Viewport Screen Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20 lg:pb-12">
          {isLoading ? <div role="status" className="flex items-center justify-center gap-2 p-12 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading records...</div> : renderScreen()}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />

      {/* Global Interactive Modals & Slide-over Drawers */}
      <CustomerDrawer />
      <PolicyDrawer />
      <OpenModals />

      {/* Toast Feedback System */}
      <ToastContainer />
    </div>
  );
};

function OpenModals() {
  const { isAddCustomerModalOpen, isAddPolicyModalOpen, isAddFollowUpModalOpen } = useApp();
  return <>
    {isAddCustomerModalOpen && <AddCustomerModal />}
    {isAddPolicyModalOpen && <AddPolicyModal />}
    {isAddFollowUpModalOpen && <AddFollowUpModal />}
  </>;
}

export function CRMApp({ initialScreen = 'dashboard' }: CRMAppProps) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      const target = initialScreen === 'dashboard' ? '/dashboard' : `/${initialScreen}`;
      router.replace(`/login?redirect=${encodeURIComponent(target)}`);
    }
  }, [isAuthLoading, user, router, initialScreen]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
          <Shield className="w-6 h-6 animate-pulse" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Loading PolicyPilot...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppProvider initialScreen={initialScreen}>
      <AppContent />
    </AppProvider>
  );
}

export default CRMApp;
