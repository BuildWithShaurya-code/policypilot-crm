export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CustomerStatus = 'active' | 'renewal_due' | 'expired';
export type PolicyStatus = 'active' | 'expiring_soon' | 'due_today' | 'expired' | 'renewed';
export type RenewalWorkflowStatus =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'quote_sent'
  | 'payment_pending'
  | 'renewed'
  | 'not_interested';
export type FollowUpReason = 'renewal' | 'quote' | 'payment' | 'document' | 'callback' | 'other';
export type FollowUpStatus = 'pending' | 'completed' | 'overdue';
export type ImportStatus = 'processing' | 'completed' | 'failed' | 'partially_completed';
export type AutomationType = 'daily_summary' | 'renewal_reminders' | 'follow_up_reminders';
export type AutomationStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface NotificationPreferences {
  daily_summary_email: boolean;
  renewal_reminders: boolean;
  follow_up_reminders: boolean;
  notification_email: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          business_name: string | null;
          business_address: string | null;
          avatar_url: string | null;
          notification_preferences: NotificationPreferences | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          business_name?: string | null;
          business_address?: string | null;
          avatar_url?: string | null;
          notification_preferences?: NotificationPreferences | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          business_name?: string | null;
          business_address?: string | null;
          avatar_url?: string | null;
          notification_preferences?: NotificationPreferences | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      customers: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          status: CustomerStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          status?: CustomerStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          status?: CustomerStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      policies: {
        Row: {
          id: string;
          owner_id: string;
          customer_id: string;
          policy_number: string;
          insurer: string;
          policy_type: string;
          premium: number;
          start_date: string | null;
          expiry_date: string;
          status: PolicyStatus;
          notes: string | null;
          renewal_status: RenewalWorkflowStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          customer_id: string;
          policy_number: string;
          insurer: string;
          policy_type: string;
          premium: number;
          start_date?: string | null;
          expiry_date: string;
          status?: PolicyStatus;
          notes?: string | null;
          renewal_status?: RenewalWorkflowStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          customer_id?: string;
          policy_number?: string;
          insurer?: string;
          policy_type?: string;
          premium?: number;
          start_date?: string | null;
          expiry_date?: string;
          status?: PolicyStatus;
          notes?: string | null;
          renewal_status?: RenewalWorkflowStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'policies_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'policies_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          }
        ];
      };
      follow_ups: {
        Row: {
          id: string;
          owner_id: string;
          customer_id: string;
          policy_id: string | null;
          reason: FollowUpReason;
          scheduled_date: string;
          scheduled_time: string | null;
          notes: string | null;
          status: FollowUpStatus;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          customer_id: string;
          policy_id?: string | null;
          reason: FollowUpReason;
          scheduled_date: string;
          scheduled_time?: string | null;
          notes?: string | null;
          status?: FollowUpStatus;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          customer_id?: string;
          policy_id?: string | null;
          reason?: FollowUpReason;
          scheduled_date?: string;
          scheduled_time?: string | null;
          notes?: string | null;
          status?: FollowUpStatus;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'follow_ups_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follow_ups_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follow_ups_policy_id_fkey';
            columns: ['policy_id'];
            referencedRelation: 'policies';
            referencedColumns: ['id'];
          }
        ];
      };
      activities: {
        Row: {
          id: string;
          owner_id: string;
          customer_id: string | null;
          policy_id: string | null;
          type: string;
          description: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          customer_id?: string | null;
          policy_id?: string | null;
          type: string;
          description: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          customer_id?: string | null;
          policy_id?: string | null;
          type?: string;
          description?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activities_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activities_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activities_policy_id_fkey';
            columns: ['policy_id'];
            referencedRelation: 'policies';
            referencedColumns: ['id'];
          }
        ];
      };
      imports: {
        Row: {
          id: string;
          owner_id: string;
          filename: string;
          total_rows: number;
          customers_created: number;
          policies_created: number;
          policies_updated: number;
          duplicates: number;
          errors: number;
          status: ImportStatus;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          filename: string;
          total_rows?: number;
          customers_created?: number;
          policies_created?: number;
          policies_updated?: number;
          duplicates?: number;
          errors?: number;
          status?: ImportStatus;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          filename?: string;
          total_rows?: number;
          customers_created?: number;
          policies_created?: number;
          policies_updated?: number;
          duplicates?: number;
          errors?: number;
          status?: ImportStatus;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'imports_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      import_errors: {
        Row: {
          id: string;
          import_id: string;
          row_number: number;
          field: string | null;
          value: string | null;
          error_type: string | null;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          import_id: string;
          row_number: number;
          field?: string | null;
          value?: string | null;
          error_type?: string | null;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          import_id?: string;
          row_number?: number;
          field?: string | null;
          value?: string | null;
          error_type?: string | null;
          message?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'import_errors_import_id_fkey';
            columns: ['import_id'];
            referencedRelation: 'imports';
            referencedColumns: ['id'];
          }
        ];
      };
      automation_logs: {
        Row: {
          id: string;
          owner_id: string;
          automation_type: AutomationType;
          execution_date: string;
          status: AutomationStatus;
          records_processed: number;
          notification_sent: boolean;
          error_message: string | null;
          payload_summary: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          automation_type: AutomationType;
          execution_date: string;
          status: AutomationStatus;
          records_processed?: number;
          notification_sent?: boolean;
          error_message?: string | null;
          payload_summary?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          automation_type?: AutomationType;
          execution_date?: string;
          status?: AutomationStatus;
          records_processed?: number;
          notification_sent?: boolean;
          error_message?: string | null;
          payload_summary?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'automation_logs_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      renew_policy: {
        Args: { policy_id_input: string; new_expiry_input?: string | null };
        Returns: Json;
      };
    };
    Enums: {
      customer_status: CustomerStatus;
      policy_status: PolicyStatus;
      renewal_workflow_status: RenewalWorkflowStatus;
      follow_up_reason: FollowUpReason;
      follow_up_status: FollowUpStatus;
      import_status: ImportStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Policy = Database['public']['Tables']['policies']['Row'];
export type FollowUp = Database['public']['Tables']['follow_ups']['Row'];
export type Activity = Database['public']['Tables']['activities']['Row'];
export type Import = Database['public']['Tables']['imports']['Row'];
export type ImportError = Database['public']['Tables']['import_errors']['Row'];
export type AutomationLog = Database['public']['Tables']['automation_logs']['Row'];
