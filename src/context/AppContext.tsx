'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { checkIsOverdue } from '@/lib/date-utils';
import { derivePolicyStatus } from '@/lib/import/normalizer';
import { fetchAllRecords, readApiResponse } from '@/lib/api-client';
import type { Customer as DbCustomer, Policy as DbPolicy, FollowUp as DbFollowUp, Activity as DbActivity } from '@/types/database.types';
import { 
  Customer, 
  Policy, 
  FollowUp, 
  Activity, 
  BusinessSettings, 
  PolicyStatus, 
  RenewalStage,
  FollowUpReason,
  FollowUpStatus,
  MappedFieldData
} from '../types';

export type ScreenType = 
  | 'dashboard'
  | 'customers'
  | 'policies'
  | 'renewals'
  | 'import'
  | 'follow-ups'
  | 'reports'
  | 'settings';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}

export interface AppMetrics {
  expiringToday: number;
  next7Days: number;
  next30Days: number;
  overdue: number;
  activeCount: number;
  renewedCount: number;
  expiredCount: number;
  todayFollowUps: number;
  upcomingFollowUps: number;
  completedFollowUps: number;
  overdueFollowUps: number;
  totalAUM: number;
  renewalRate: number;
}

export interface AppContextType {
  // Navigation & UI
  currentScreen: ScreenType;
  navigateTo: (screen: ScreenType, params?: { customerId?: string; policyId?: string; tab?: string }) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  
  // Data
  customers: Customer[];
  policies: Policy[];
  followUps: FollowUp[];
  activities: Activity[];
  settings: BusinessSettings;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  
  // Selected state for modals & drawers
  selectedCustomer: Customer | null;
  selectedPolicy: Policy | null;
  selectedFollowUp: FollowUp | null;
  setSelectedFollowUp: (fu: FollowUp | null) => void;
  isCustomerDrawerOpen: boolean;
  isPolicyDrawerOpen: boolean;
  isAddCustomerModalOpen: boolean;
  isAddPolicyModalOpen: boolean;
  isAddFollowUpModalOpen: boolean;
  prefilledFollowUpData: { customerId?: string; policyId?: string; reason?: string } | null;
  
  // Modals & Drawers Controls
  openCustomerDrawer: (customer: Customer) => void;
  closeCustomerDrawer: () => void;
  openPolicyDrawer: (policy: Policy) => void;
  closePolicyDrawer: () => void;
  openAddCustomerModal: () => void;
  closeAddCustomerModal: () => void;
  openAddPolicyModal: (prefilledCustomerId?: string) => void;
  closeAddPolicyModal: () => void;
  openAddFollowUpModal: (prefill?: { customerId?: string; policyId?: string; reason?: string }) => void;
  closeAddFollowUpModal: () => void;

  // Actions
  addCustomer: (data: Omit<Customer, 'id' | 'createdAt'>) => Promise<Customer>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  
  addPolicy: (data: Omit<Policy, 'id'>) => Promise<Policy>;
  updatePolicy: (id: string, data: Partial<Policy>) => Promise<void>;
  deletePolicy: (id: string) => Promise<void>;
  markPolicyRenewed: (id: string, newExpiryDate?: string) => Promise<void>;
  updateRenewalStage: (id: string, stage: RenewalStage) => Promise<void>;
  
  addFollowUp: (data: Omit<FollowUp, 'id' | 'createdAt'>) => Promise<FollowUp>;
  completeFollowUp: (id: string) => Promise<void>;
  rescheduleFollowUp: (id: string, newDate: string, newTime: string) => Promise<void>;
  deleteFollowUp: (id: string) => Promise<void>;
  
  updateSettings: (data: Partial<BusinessSettings>) => Promise<void>;
  importExcelBatch: (mappedRows: MappedFieldData[], duplicateStrategy: 'skip' | 'update') => Promise<{
    customersAdded: number;
    policiesAdded: number;
    policiesUpdated: number;
  }>;
  resetToDefaults: () => void;
  
  // Communications helpers
  triggerCall: (phone: string, name?: string) => void;
  triggerWhatsApp: (phone: string, message: string, name?: string) => void;
  triggerEmail: (email: string, subject: string, body?: string) => void;
  
  // Toasts
  toasts: ToastItem[];
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;

  // Metrics
  metrics: AppMetrics;
}

const defaultSettings: BusinessSettings = {
  businessName: 'PolicyPilot Advisory',
  ownerName: 'Lead Broker',
  mobile: '+91 98765 43210',
  email: '',
  address: 'India',
  dailyReminderTime: '09:00',
  reminderDays: {
    thirtyDays: true,
    fifteenDays: true,
    sevenDays: true,
    oneDay: true,
    onExpiry: true,
  },
  notifications: {
    emailRenewals: true,
    emailDailySummary: true,
    emailFollowUps: true,
    emailImports: true,
    whatsappRenewals: false,
    whatsappFollowUps: false,
  },
  importPreferences: {
    duplicateHandling: 'skip',
    dateFormat: 'YYYY-MM-DD',
    defaultPolicyStatus: 'Active',
  },
};

const initialMetrics: AppMetrics = {
  expiringToday: 0,
  next7Days: 0,
  next30Days: 0,
  overdue: 0,
  activeCount: 0,
  renewedCount: 0,
  expiredCount: 0,
  todayFollowUps: 0,
  upcomingFollowUps: 0,
  completedFollowUps: 0,
  overdueFollowUps: 0,
  totalAUM: 0,
  renewalRate: 0,
};

// Data mappers from Backend API to Frontend Domain
function mapCustomerFromApi(c: DbCustomer): Customer {
  return {
    id: c.id,
    name: c.name || '',
    phone: c.phone || '',
    email: c.email || '',
    address: c.address || '',
    createdAt: c.created_at || new Date().toISOString(),
    notes: c.notes || '',
    verified: true,
  };
}

type ApiPolicy = DbPolicy & { customer?: Pick<DbCustomer, 'name' | 'phone' | 'email'> | null };
type ApiFollowUp = DbFollowUp & { customer?: Pick<DbCustomer, 'name' | 'phone' | 'email'> | null; policy?: Pick<DbPolicy, 'policy_number' | 'policy_type'> | null };

function mapPolicyFromApi(p: ApiPolicy): Policy {
  let status: PolicyStatus = 'Active';
  const rawStatus = derivePolicyStatus(p.expiry_date, p.status);
  const rawRenewalStatus = (p.renewal_status || '').toLowerCase();

  if (rawStatus === 'renewed' || rawRenewalStatus === 'renewed') status = 'Renewed';
  else if (rawStatus === 'due_today') status = 'Due Today';
  else if (rawStatus === 'expiring_soon') status = 'Expiring Soon';
  else if (rawStatus === 'expired') status = 'Expired';
  else status = 'Active';

  let renewalStage: RenewalStage = 'New';
  if (rawRenewalStatus === 'quote_sent') renewalStage = 'Quote Sent';
  else if (rawRenewalStatus === 'contacted') renewalStage = 'Contacted';
  else if (rawRenewalStatus === 'interested') renewalStage = 'Interested';
  else if (rawRenewalStatus === 'payment_pending') renewalStage = 'Payment Pending';
  else if (rawRenewalStatus === 'renewed') renewalStage = 'Renewed';
  else if (rawRenewalStatus === 'lost' || rawRenewalStatus === 'not_interested') renewalStage = 'Not Interested';
  else renewalStage = 'New';

  return {
    id: p.id,
    customerId: p.customer_id,
    customerName: p.customer?.name || 'Client',
    customerPhone: p.customer?.phone || '',
    customerEmail: p.customer?.email || '',
    policyNumber: p.policy_number,
    insurer: p.insurer || 'General Insurance',
    policyType: p.policy_type || 'General',
    premium: Number(p.premium) || 0,
    startDate: p.start_date || '',
    expiryDate: p.expiry_date || '',
    status,
    renewalStage,
    notes: p.notes || '',
  };
}

function mapFollowUpFromApi(f: ApiFollowUp): FollowUp {
  let status: FollowUpStatus = 'Pending';
  if (f.status === 'completed') {
    status = 'Completed';
  } else {
    if (checkIsOverdue(f.scheduled_date, f.scheduled_time, f.status)) {
      status = 'Overdue';
    } else {
      status = 'Pending';
    }
  }

  return {
    id: f.id,
    customerId: f.customer_id,
    customerName: f.customer?.name || 'Client',
    customerPhone: f.customer?.phone || '',
    customerEmail: f.customer?.email || '',
    policyId: f.policy_id || '',
    policyNumber: f.policy?.policy_number || 'General',
    policyType: f.policy?.policy_type || 'Insurance',
    reason: (f.reason.charAt(0).toUpperCase() + f.reason.slice(1)) as FollowUpReason,
    date: f.scheduled_date || '',
    time: f.scheduled_time?.slice(0, 5) || '',
    notes: f.notes || '',
    status,
    createdAt: f.created_at || '',
    completedAt: f.completed_at || undefined,
  };
}

function mapActivityFromApi(a: DbActivity): Activity {
  return {
    id: a.id,
    customerId: a.customer_id || '',
    policyId: a.policy_id || undefined,
    type: (a.type || 'contact') as Activity['type'],
    description: a.description || '',
    timestamp: a.created_at || new Date().toISOString(),
  };
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode; initialScreen?: ScreenType }> = ({ 
  children, 
  initialScreen = 'dashboard' 
}) => {
  const pathname = usePathname();
  const screens: ScreenType[] = ['dashboard', 'customers', 'policies', 'renewals', 'import', 'follow-ups', 'reports', 'settings'];
  const pathScreen = pathname.split('/')[1] as ScreenType;
  const currentScreen = screens.includes(pathScreen) ? pathScreen : initialScreen;
  const [globalSearch, setGlobalSearch] = useState<string>('');
  
  // Real Database state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(defaultSettings);
  const [metrics, setMetrics] = useState<AppMetrics>(initialMetrics);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const initialLoadComplete = useRef(false);

  // UI state for drawers & modals
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUp | null>(null);
  
  const [isCustomerDrawerOpen, setIsCustomerDrawerOpen] = useState(false);
  const [isPolicyDrawerOpen, setIsPolicyDrawerOpen] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isAddPolicyModalOpen, setIsAddPolicyModalOpen] = useState(false);
  const [isAddFollowUpModalOpen, setIsAddFollowUpModalOpen] = useState(false);
  const [prefilledFollowUpData, setPrefilledFollowUpData] = useState<{ customerId?: string; policyId?: string; reason?: string } | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Toast notification system
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch metrics from canonical backend
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics({
          expiringToday: Number(data.expiringToday) || 0,
          next7Days: Number(data.next7Days) || 0,
          next30Days: Number(data.next30Days) || 0,
          overdue: Number(data.overdue) || 0,
          activeCount: Number(data.activeCount) || 0,
          renewedCount: Number(data.renewedCount) || 0,
          expiredCount: Number(data.expiredCount) || 0,
          todayFollowUps: Number(data.todayFollowUps) || 0,
          upcomingFollowUps: Number(data.upcomingFollowUps) || 0,
          completedFollowUps: Number(data.completedFollowUps) || 0,
          overdueFollowUps: Number(data.overdueFollowUps) || 0,
          totalAUM: Number(data.totalAUM) || 0,
          renewalRate: Number(data.renewalRate) || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    }
  }, []);

  // Primary data loader
  const refreshData = useCallback(async () => {
    try {
      if (!initialLoadComplete.current) setIsLoading(true);
      const [customerRecords, policyRecords, fuRes, actRes, setRes] = await Promise.all([
        fetchAllRecords<DbCustomer>('/api/customers'),
        fetchAllRecords<ApiPolicy>('/api/policies'),
        fetch('/api/follow-ups'),
        fetch('/api/activities'),
        fetch('/api/settings'),
      ]);

      setCustomers(customerRecords.map(mapCustomerFromApi));
      setPolicies(policyRecords.map(mapPolicyFromApi));
      for (const response of [fuRes, actRes, setRes]) {
        if (!response.ok) await readApiResponse(response);
      }

      if (fuRes.ok) {
        const fuData = await fuRes.json();
        const list = fuData?.data || fuData || [];
        setFollowUps((Array.isArray(list) ? list : []).map(mapFollowUpFromApi));
      }

      if (actRes.ok) {
        const actData = await actRes.json();
        setActivities((Array.isArray(actData) ? actData : []).map(mapActivityFromApi));
      }

      if (setRes.ok) {
        const setData = await setRes.json();
        if (setData && typeof setData === 'object') {
          setSettings(prev => ({ ...prev, ...setData }));
        }
      }

      await fetchMetrics();
    } catch (err) {
      console.error('Error refreshing PolicyPilot data:', err);
      showToast('Failed to load live database records', 'error');
    } finally {
      initialLoadComplete.current = true;
      setIsLoading(false);
    }
  }, [fetchMetrics, showToast]);

  // Initial load on mount
  useEffect(() => {
    const timer = setTimeout(() => { void refreshData(); }, 0);
    return () => clearTimeout(timer);
  }, [refreshData, showToast]);

  // Navigation controller with browser URL synchronization
  const navigateTo = useCallback((screen: ScreenType, params?: { customerId?: string; policyId?: string; tab?: string }) => {
    if (typeof window !== 'undefined') {
      const targetPath = '/' + (screen === 'dashboard' ? 'dashboard' : screen);
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }

    if (params?.customerId) {
      const found = customers.find(c => c.id === params.customerId);
      if (found) {
        setSelectedCustomer(found);
        setIsCustomerDrawerOpen(true);
      }
    }

    if (params?.policyId) {
      const found = policies.find(p => p.id === params.policyId);
      if (found) {
        setSelectedPolicy(found);
        setIsPolicyDrawerOpen(true);
      }
    }
  }, [customers, policies]);

  // Modal / Drawer controls
  const openCustomerDrawer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setIsCustomerDrawerOpen(true);
  }, []);

  const closeCustomerDrawer = useCallback(() => {
    setIsCustomerDrawerOpen(false);
    setSelectedCustomer(null);
  }, []);

  const openPolicyDrawer = useCallback((policy: Policy) => {
    setSelectedPolicy(policy);
    setIsPolicyDrawerOpen(true);
  }, []);

  const closePolicyDrawer = useCallback(() => {
    setIsPolicyDrawerOpen(false);
    setSelectedPolicy(null);
  }, []);

  const openAddCustomerModal = useCallback(() => setIsAddCustomerModalOpen(true), []);
  const closeAddCustomerModal = useCallback(() => setIsAddCustomerModalOpen(false), []);

  const openAddPolicyModal = useCallback((prefilledCustomerId?: string) => {
    if (prefilledCustomerId) {
      const cust = customers.find(c => c.id === prefilledCustomerId);
      if (cust) setSelectedCustomer(cust);
    }
    setIsAddPolicyModalOpen(true);
  }, [customers]);

  const closeAddPolicyModal = useCallback(() => setIsAddPolicyModalOpen(false), []);

  const openAddFollowUpModal = useCallback((prefill?: { customerId?: string; policyId?: string; reason?: string }) => {
    setPrefilledFollowUpData(prefill || null);
    setIsAddFollowUpModalOpen(true);
  }, []);

  const closeAddFollowUpModal = useCallback(() => {
    setIsAddFollowUpModalOpen(false);
    setPrefilledFollowUpData(null);
  }, []);

  // Customer Operations
  const addCustomer = useCallback(async (data: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          notes: data.notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create customer');
      }

      const created = await res.json();
      const mapped = mapCustomerFromApi(created);
      setCustomers(prev => [mapped, ...prev]);
      showToast(`Client ${data.name} created successfully`, 'success');
      fetchMetrics();
      return mapped;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating customer';
      showToast(msg, 'error');
      throw err;
    }
  }, [fetchMetrics, showToast]);

  const updateCustomer = useCallback(async (id: string, data: Partial<Customer>): Promise<void> => {
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update customer');
      }

      setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
      if (selectedCustomer?.id === id) {
        setSelectedCustomer(prev => prev ? { ...prev, ...data } : null);
      }
      showToast('Client profile updated', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating customer';
      showToast(msg, 'error');
      throw err;
    }
  }, [selectedCustomer, showToast]);

  const deleteCustomer = useCallback(async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete customer');
      }

      setCustomers(prev => prev.filter(c => c.id !== id));
      setPolicies(prev => prev.filter(p => p.customerId !== id));
      setFollowUps(prev => prev.filter(f => f.customerId !== id));
      closeCustomerDrawer();
      showToast('Customer deleted', 'info');
      fetchMetrics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting customer';
      showToast(msg, 'error');
      throw err;
    }
  }, [closeCustomerDrawer, fetchMetrics, showToast]);

  // Policy Operations
  const addPolicy = useCallback(async (data: Omit<Policy, 'id'>): Promise<Policy> => {
    try {
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: data.customerId,
          policyNumber: data.policyNumber,
          insurer: data.insurer,
          policyType: data.policyType,
          premium: data.premium,
          startDate: data.startDate,
          expiryDate: data.expiryDate,
          status: (data.status || 'Active').toLowerCase().replace(/\s+/g, '_'),
          renewalStatus: (data.renewalStage || 'New').toLowerCase().replace(/\s+/g, '_'),
          notes: data.notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create policy');
      }

      const created = await res.json();
      const mapped = mapPolicyFromApi(created);
      setPolicies(prev => [mapped, ...prev]);
      showToast(`Policy ${data.policyNumber} added successfully`, 'success');
      fetchMetrics();
      return mapped;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error adding policy';
      showToast(msg, 'error');
      throw err;
    }
  }, [fetchMetrics, showToast]);

  const updatePolicy = useCallback(async (id: string, data: Partial<Policy>): Promise<void> => {
    try {
      const res = await fetch(`/api/policies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update policy');
      }

      setPolicies(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
      if (selectedPolicy?.id === id) {
        setSelectedPolicy(prev => prev ? { ...prev, ...data } : null);
      }
      showToast('Policy updated', 'success');
      fetchMetrics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating policy';
      showToast(msg, 'error');
      throw err;
    }
  }, [fetchMetrics, selectedPolicy, showToast]);

  const deletePolicy = useCallback(async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/policies/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete policy');
      }

      setPolicies(prev => prev.filter(p => p.id !== id));
      closePolicyDrawer();
      showToast('Policy deleted', 'info');
      fetchMetrics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting policy';
      showToast(msg, 'error');
      throw err;
    }
  }, [closePolicyDrawer, fetchMetrics, showToast]);

  const markPolicyRenewed = useCallback(async (id: string, newExpiryDate?: string): Promise<void> => {
    try {
      const res = await fetch(`/api/policies/${id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newExpiryDate }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to renew policy');
      }

      const updated = await res.json();
      setPolicies(prev => prev.map(p => p.id === id ? mapPolicyFromApi(updated) : p));
      if (selectedPolicy?.id === id) {
        setSelectedPolicy(mapPolicyFromApi(updated));
      }

      // Re-fetch follow-ups since associated pending ones auto-complete upon renewal
      const fuRes = await fetch('/api/follow-ups');
      if (fuRes.ok) {
        const fuData = await fuRes.json();
        const list = fuData?.data || fuData || [];
        setFollowUps(list.map(mapFollowUpFromApi));
      }

      showToast('Policy successfully renewed! Expiry extended.', 'success');
      fetchMetrics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error renewing policy';
      showToast(msg, 'error');
      throw err;
    }
  }, [fetchMetrics, selectedPolicy, showToast]);

  const updateRenewalStage = useCallback(async (id: string, stage: RenewalStage): Promise<void> => {
    try {
      if (stage === 'Renewed') {
        await markPolicyRenewed(id);
        return;
      }
      const res = await fetch(`/api/policies/${id}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update renewal stage');
      }

      const updated = mapPolicyFromApi(await res.json());
      setPolicies(prev => prev.map(p => p.id === id ? updated : p));
      if (selectedPolicy?.id === id) {
        setSelectedPolicy(updated);
      }
      showToast(`Renewal stage advanced to "${stage}"`, 'success');
      void fetchMetrics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating stage';
      showToast(msg, 'error');
      throw err;
    }
  }, [selectedPolicy, showToast, markPolicyRenewed, fetchMetrics]);

  // Follow-up Operations
  const addFollowUp = useCallback(async (data: Omit<FollowUp, 'id' | 'createdAt'>): Promise<FollowUp> => {
    try {
      const res = await fetch('/api/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: data.customerId,
          policyId: data.policyId,
          scheduledDate: data.date,
          scheduledTime: data.time,
          reason: data.reason,
          notes: data.notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to schedule follow-up');
      }

      const created = await res.json();
      const mapped = mapFollowUpFromApi(created);
      setFollowUps(prev => [mapped, ...prev]);
      showToast('Follow-up scheduled successfully', 'success');
      fetchMetrics();
      return mapped;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error scheduling follow-up';
      showToast(msg, 'error');
      throw err;
    }
  }, [fetchMetrics, showToast]);

  const completeFollowUp = useCallback(async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/follow-ups/${id}/complete`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to mark follow-up complete');
      }

      setFollowUps(prev => prev.map(f => f.id === id ? { ...f, status: 'Completed', completedAt: new Date().toISOString() } : f));
      showToast('Follow-up marked as completed', 'success');
      fetchMetrics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error completing follow-up';
      showToast(msg, 'error');
      throw err;
    }
  }, [fetchMetrics, showToast]);

  const rescheduleFollowUp = useCallback(async (id: string, newDate: string, newTime: string): Promise<void> => {
    try {
      const res = await fetch(`/api/follow-ups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledDate: newDate,
          scheduledTime: newTime,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reschedule follow-up');
      }

      setFollowUps(prev => prev.map(f => f.id === id ? { ...f, date: newDate, time: newTime, status: 'Pending' } : f));
      showToast('Follow-up rescheduled', 'info');
      fetchMetrics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error rescheduling follow-up';
      showToast(msg, 'error');
      throw err;
    }
  }, [fetchMetrics, showToast]);

  const deleteFollowUp = useCallback(async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/follow-ups/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete follow-up');
      }

      setFollowUps(prev => prev.filter(f => f.id !== id));
      showToast('Follow-up deleted', 'info');
      fetchMetrics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting follow-up';
      showToast(msg, 'error');
      throw err;
    }
  }, [fetchMetrics, showToast]);

  // Settings & Import Operations
  const updateSettings = useCallback(async (data: Partial<BusinessSettings>): Promise<void> => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save settings');
      }

      setSettings(prev => ({ ...prev, ...data }));
      showToast('Business settings saved', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating settings';
      showToast(msg, 'error');
      throw err;
    }
  }, [showToast]);

  const importExcelBatch = useCallback(async (
    mappedRows: MappedFieldData[], 
    duplicateStrategy: 'skip' | 'update'
  ): Promise<{ customersAdded: number; policiesAdded: number; policiesUpdated: number; }> => {
    try {
      const res = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mappedRows,
          duplicateStrategy,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to execute import batch');
      }

      const result = await res.json();
      await refreshData();

      if (result.errorsCount > 0 || result.status === 'failed' || result.status === 'partially_completed') {
        throw new Error(`Import saved ${result.policiesCreated ?? 0} new and ${result.policiesUpdated ?? 0} updated policies, but ${result.errorsCount ?? 0} rows failed. Review those rows before retrying.`);
      }

      const custAdded = result.customersCreated ?? result.customersAdded ?? 0;
      const polAdded = result.policiesCreated ?? result.policiesAdded ?? 0;
      const polUpdated = result.policiesUpdated ?? 0;

      showToast(`Import batch processed: ${polAdded} policies added, ${polUpdated} updated`, 'success');

      return {
        customersAdded: custAdded,
        policiesAdded: polAdded,
        policiesUpdated: polUpdated,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error during batch import';
      showToast(msg, 'error');
      throw err;
    }
  }, [refreshData, showToast]);

  const resetToDefaults = useCallback(() => {
    refreshData();
    showToast('Refreshed data from database', 'info');
  }, [refreshData, showToast]);

  // Communications helpers
  const triggerCall = useCallback((phone: string, name?: string) => {
    if (!phone.trim()) { showToast('No phone number is saved for this customer', 'warning'); return; }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (typeof window !== 'undefined') {
      window.location.href = `tel:${cleanPhone}`;
    }
    showToast(`Calling ${name || cleanPhone}...`, 'info');
  }, [showToast]);

  const triggerWhatsApp = useCallback((phone: string, message: string, name?: string) => {
    if (!phone.trim()) { showToast('No phone number is saved for this customer', 'warning'); return; }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    showToast(`Opening WhatsApp for ${name || phone}...`, 'info');
  }, [showToast]);

  const triggerEmail = useCallback((email: string, subject: string, body?: string) => {
    if (!email.trim()) { showToast('No email address is saved for this customer', 'warning'); return; }
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body || '')}`;
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
    showToast(`Opening email client for ${email}...`, 'info');
  }, [showToast]);

  const value: AppContextType = useMemo(() => ({
    currentScreen,
    navigateTo,
    globalSearch,
    setGlobalSearch,
    customers,
    policies,
    followUps,
    activities,
    settings,
    isLoading,
    refreshData,
    selectedCustomer,
    selectedPolicy,
    selectedFollowUp,
    setSelectedFollowUp,
    isCustomerDrawerOpen,
    isPolicyDrawerOpen,
    isAddCustomerModalOpen,
    isAddPolicyModalOpen,
    isAddFollowUpModalOpen,
    prefilledFollowUpData,
    openCustomerDrawer,
    closeCustomerDrawer,
    openPolicyDrawer,
    closePolicyDrawer,
    openAddCustomerModal,
    closeAddCustomerModal,
    openAddPolicyModal,
    closeAddPolicyModal,
    openAddFollowUpModal,
    closeAddFollowUpModal,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addPolicy,
    updatePolicy,
    deletePolicy,
    markPolicyRenewed,
    updateRenewalStage,
    addFollowUp,
    completeFollowUp,
    rescheduleFollowUp,
    deleteFollowUp,
    updateSettings,
    importExcelBatch,
    resetToDefaults,
    triggerCall,
    triggerWhatsApp,
    triggerEmail,
    toasts,
    showToast,
    removeToast,
    metrics,
  }), [
    currentScreen,
    navigateTo,
    globalSearch,
    customers,
    policies,
    followUps,
    activities,
    settings,
    isLoading,
    refreshData,
    selectedCustomer,
    selectedPolicy,
    selectedFollowUp,
    isCustomerDrawerOpen,
    isPolicyDrawerOpen,
    isAddCustomerModalOpen,
    isAddPolicyModalOpen,
    isAddFollowUpModalOpen,
    prefilledFollowUpData,
    openCustomerDrawer,
    closeCustomerDrawer,
    openPolicyDrawer,
    closePolicyDrawer,
    openAddCustomerModal,
    closeAddCustomerModal,
    openAddPolicyModal,
    closeAddPolicyModal,
    openAddFollowUpModal,
    closeAddFollowUpModal,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addPolicy,
    updatePolicy,
    deletePolicy,
    markPolicyRenewed,
    updateRenewalStage,
    addFollowUp,
    completeFollowUp,
    rescheduleFollowUp,
    deleteFollowUp,
    updateSettings,
    importExcelBatch,
    resetToDefaults,
    triggerCall,
    triggerWhatsApp,
    triggerEmail,
    toasts,
    showToast,
    removeToast,
    metrics,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
