export type PolicyStatus = 'Active' | 'Due Today' | 'Expiring Soon' | 'Expired' | 'Renewed';

export type CustomerStatus = 'Active' | 'Renewal Due' | 'Expired';

export type RenewalStage = 
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Quote Sent'
  | 'Payment Pending'
  | 'Renewed'
  | 'Not Interested';

export type FollowUpStatus = 'Pending' | 'Completed' | 'Overdue';

export type FollowUpReason = 
  | 'Renewal'
  | 'Quote'
  | 'Payment'
  | 'Document'
  | 'Callback'
  | 'Other';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  createdAt: string;
  notes?: string;
  verified?: boolean;
}

export interface Policy {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  policyNumber: string;
  insurer: string;
  policyType: string;
  premium: number;
  startDate: string;
  expiryDate: string;
  status: PolicyStatus;
  renewalStage: RenewalStage;
  lastContactDate?: string;
  notes?: string;
  ncbPercent?: number;
  idvAmount?: number;
}

export interface FollowUp {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  policyId: string;
  policyNumber: string;
  policyType: string;
  reason: FollowUpReason;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  notes: string;
  status: FollowUpStatus;
  completedAt?: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  customerId: string;
  policyId?: string;
  type: 'import' | 'contact' | 'quote' | 'followup' | 'renewal' | 'edit';
  description: string;
  timestamp: string;
}

export interface BusinessSettings {
  businessName: string;
  ownerName: string;
  mobile: string;
  email: string;
  address: string;
  dailyReminderTime: string;
  reminderDays: {
    thirtyDays: boolean;
    fifteenDays: boolean;
    sevenDays: boolean;
    oneDay: boolean;
    onExpiry: boolean;
  };
  notifications: {
    emailRenewals: boolean;
    emailDailySummary: boolean;
    emailFollowUps: boolean;
    emailImports: boolean;
    whatsappRenewals: boolean;
    whatsappFollowUps: boolean;
  };
  importPreferences: {
    duplicateHandling: 'ask' | 'skip' | 'update';
    dateFormat: string;
    defaultPolicyStatus: PolicyStatus;
  };
}

export interface ImportRawRow {
  id: string;
  [key: string]: unknown;
}

export interface MappedFieldData {
  customerName: string;
  phone: string;
  email?: string;
  address?: string;
  policyNumber: string;
  insurer: string;
  policyType: string;
  premium: number;
  startDate: string;
  expiryDate: string;
  isValid: boolean;
  issues: string[];
  isDuplicate?: boolean;
  duplicateResolution?: 'skip' | 'update';
}
