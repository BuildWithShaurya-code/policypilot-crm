import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Import, ImportError, Customer, Policy, Database } from '@/types/database.types';
import type { ValidatedRow, ValidationSummary } from '@/lib/import/validation-engine';
import { sanitizeDatabaseError } from '@/lib/error-utils';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ExecuteImportOptions {
  filename: string;
  validatedRows: ValidatedRow[];
  summary: ValidationSummary;
}

export interface ImportExecutionResult {
  importId: string;
  status: 'completed' | 'partially_completed' | 'failed';
  totalRows: number;
  customersCreated: number;
  policiesCreated: number;
  policiesUpdated: number;
  duplicatesSkipped: number;
  errorsCount: number;
  errorMessage?: string;
}

/**
 * Service to manage Excel / CSV imports and execution
 */
export class ImportService {
  /**
   * Fetches the user's import history (capped at limit)
   */
  static async getImportHistory(limit: number = 50, clientInstance?: SupabaseClient): Promise<Import[]> {
    const supabase = clientInstance || getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('imports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching import history:', error);
      throw new Error(sanitizeDatabaseError(error, 'Failed to load import history'));
    }

    return (data as Import[]) || [];
  }

  /**
   * Fetches detailed error records for a specific import
   */
  static async getImportErrors(importId: string, clientInstance?: SupabaseClient): Promise<ImportError[]> {
    const supabase = clientInstance || getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('import_errors')
      .select('*')
      .eq('import_id', importId)
      .order('row_number', { ascending: true });

    if (error) {
      console.error('Error fetching import errors:', error);
      throw new Error(`Failed to load import errors: ${error.message}`);
    }

    return (data as ImportError[]) || [];
  }

  /**
   * Fetches existing customers for duplicate detection
   */
  static async getExistingCustomers(clientInstance?: SupabaseClient): Promise<Pick<Customer, 'id' | 'name' | 'phone' | 'email'>[]> {
    const supabase = clientInstance || getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone, email');

    if (error) {
      console.error('Error fetching existing customers:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Fetches existing policies for duplicate detection
   */
  static async getExistingPolicies(clientInstance?: SupabaseClient): Promise<Pick<Policy, 'id' | 'policy_number' | 'customer_id'>[]> {
    const supabase = clientInstance || getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('policies')
      .select('id, policy_number, customer_id');

    if (error) {
      console.error('Error fetching existing policies:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Executes the complete database import safely with batching and transaction simulation
   */
  static async executeImport(
    options: ExecuteImportOptions,
    onProgress?: (stage: string, percent: number) => void,
    clientInstance?: SupabaseClient
  ): Promise<ImportExecutionResult> {
    const supabase = clientInstance || getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Authentication required to perform an import.');
    }

    const { filename, validatedRows } = options;
    onProgress?.('Initializing import record...', 5);

    // 1. Create Initial Imports Record (status: processing)
    const { data: importRecord, error: importCreateError } = await supabase
      .from('imports')
      .insert({
        owner_id: user.id,
        filename,
        total_rows: validatedRows.length,
        customers_created: 0,
        policies_created: 0,
        policies_updated: 0,
        duplicates: 0,
        errors: 0,
        status: 'processing',
      })
      .select()
      .single();

    if (importCreateError || !importRecord) {
      throw new Error(`Failed to create import session: ${importCreateError?.message}`);
    }

    const importId = importRecord.id;
    let customersCreatedCount = 0;
    let policiesCreatedCount = 0;
    let policiesUpdatedCount = 0;
    let duplicatesSkippedCount = 0;
    const errorsToLog: Array<{
      import_id: string;
      row_number: number;
      field: string | null;
      value: string | null;
      error_type: string | null;
      message: string;
    }> = [];

    try {
      // 2. Identify distinct new customers to create
      onProgress?.('Processing customers...', 20);

      // Map to track customer IDs by group key
      const groupKeyToCustomerId = new Map<string, string>();

      // Pre-fill already matched existing customers
      validatedRows.forEach((r) => {
        if (r.customerMatch.type === 'existing' && r.customerMatch.existingCustomerId) {
          groupKeyToCustomerId.set(
            r.customerMatch.intraFileGroupKey,
            r.customerMatch.existingCustomerId
          );
        }
      });

      // Filter non-error rows that need customer creation
      const validRowsForCustomerCreation = validatedRows.filter(
        (r) => r.category !== 'ERROR' && r.customerMatch.type === 'new' &&
          !(r.category === 'DUPLICATE' && r.policyMatch.action === 'skip')
      );

      // Group by intraFileGroupKey so we don't insert duplicate customers
      const distinctNewCustomerMap = new Map<
        string,
        {
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
        }
      >();

      validRowsForCustomerCreation.forEach((r) => {
        const key = r.customerMatch.intraFileGroupKey;
        if (!distinctNewCustomerMap.has(key) && !groupKeyToCustomerId.has(key)) {
          distinctNewCustomerMap.set(key, {
            name: r.customerName,
            phone: r.phone,
            email: r.email,
            address: r.address,
          });
        }
      });

      // Batch insert new customers
      const newCustomersToInsert = Array.from(distinctNewCustomerMap.values()).map(
        (data) => ({
          owner_id: user.id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          status: 'active' as const,
        })
      );

      if (newCustomersToInsert.length > 0) {
        // Insert in batches of 50
        const batchSize = 50;
        for (let i = 0; i < newCustomersToInsert.length; i += batchSize) {
          const batch = newCustomersToInsert.slice(i, i + batchSize);
          const { data: insertedCustomers, error: custInsertErr } = await supabase
            .from('customers')
            .insert(batch)
            .select('id, name, phone, email');

          if (custInsertErr) {
            console.error('Error batch inserting customers:', custInsertErr);
            throw new Error(`Failed to insert customers: ${custInsertErr.message}`);
          }

          if (insertedCustomers) {
            customersCreatedCount += insertedCustomers.length;
            // Map inserted customers back to their group keys
            insertedCustomers.forEach((cust) => {
              // Match against the entries in distinctNewCustomerMap
              for (const [key, val] of distinctNewCustomerMap.entries()) {
                if (
                  val.name === cust.name &&
                  (val.phone === cust.phone || (!val.phone && !cust.phone))
                ) {
                  groupKeyToCustomerId.set(key, cust.id);
                  break;
                }
              }
            });
          }
        }
      }

      onProgress?.('Processing policies...', 50);

      // 3. Process Policies: New Insertions vs Updates vs Skips
      const policiesToInsert: Database['public']['Tables']['policies']['Insert'][] = [];
      const policiesToUpdate: Array<{
        id: string;
        data: Database['public']['Tables']['policies']['Update'];
        rowNumber: number;
      }> = [];

      for (const row of validatedRows) {
        // If row has validation errors, log to errors list
        if (row.category === 'ERROR') {
          row.errors.forEach((e) => {
            errorsToLog.push({
              import_id: importId,
              row_number: row.rowNumber,
              field: e.field,
              value: e.value,
              error_type: 'VALIDATION_ERROR',
              message: e.message,
            });
          });
          continue;
        }

        // Handle duplicates
        if (row.category === 'DUPLICATE') {
          if (row.policyMatch.action === 'skip') {
            duplicatesSkippedCount++;
            continue; // Skip without inserting
          } else if (
            row.policyMatch.action === 'update_existing' &&
            row.policyMatch.existingPolicyId
          ) {
            policiesToUpdate.push({
              id: row.policyMatch.existingPolicyId,
              data: {
                insurer: row.insuranceCompany,
                policy_type: row.policyType,
                premium: row.premium ?? 0,
                start_date: row.startDate,
                expiry_date: row.expiryDate ?? undefined,
                status: row.status,
              },
              rowNumber: row.rowNumber,
            });
            continue;
          }
        }

        // New policy to insert
        const customerId = groupKeyToCustomerId.get(row.customerMatch.intraFileGroupKey);
        if (!customerId) {
          errorsToLog.push({
            import_id: importId,
            row_number: row.rowNumber,
            field: 'customer_id',
            value: row.customerName,
            error_type: 'RELATIONSHIP_ERROR',
            message: `Could not link policy to customer "${row.customerName}"`,
          });
          continue;
        }

        policiesToInsert.push({
          owner_id: user.id,
          customer_id: customerId,
          policy_number: row.policyNumber,
          insurer: row.insuranceCompany,
          policy_type: row.policyType,
          premium: row.premium ?? 0,
          start_date: row.startDate,
          expiry_date: row.expiryDate || new Date().toISOString().split('T')[0],
          status: row.status,
        });
      }

      // Batch insert new policies
      if (policiesToInsert.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < policiesToInsert.length; i += batchSize) {
          const batch = policiesToInsert.slice(i, i + batchSize);
          const { error: polInsertErr } = await supabase.from('policies').insert(batch);

          if (polInsertErr) {
            console.error('Error inserting policy batch:', polInsertErr);
            // Log as import errors
            batch.forEach((p) => {
              errorsToLog.push({
                import_id: importId,
                row_number: 0,
                field: 'policy_number',
                value: p.policy_number,
                error_type: 'DATABASE_ERROR',
                message: polInsertErr.message,
              });
            });
          } else {
            policiesCreatedCount += batch.length;
          }

          const currentPct = 50 + Math.floor((i / policiesToInsert.length) * 30);
          onProgress?.(`Inserting policies (${policiesCreatedCount}/${policiesToInsert.length})...`, currentPct);
        }
      }

      // Execute policy updates
      if (policiesToUpdate.length > 0) {
        onProgress?.('Updating existing policies...', 85);
        for (const item of policiesToUpdate) {
          const { error: updateErr } = await supabase
            .from('policies')
            .update(item.data)
            .eq('id', item.id);

          if (updateErr) {
            errorsToLog.push({
              import_id: importId,
              row_number: item.rowNumber,
              field: 'policy_number',
              value: item.id,
              error_type: 'UPDATE_ERROR',
              message: updateErr.message,
            });
          } else {
            policiesUpdatedCount++;
          }
        }
      }

      // 4. Batch insert logged errors
      if (errorsToLog.length > 0) {
        onProgress?.('Recording error logs...', 90);
        const errBatchSize = 100;
        for (let i = 0; i < errorsToLog.length; i += errBatchSize) {
          const batch = errorsToLog.slice(i, i + errBatchSize);
          await supabase.from('import_errors').insert(batch);
        }
      }

      // 5. Record activity
      onProgress?.('Creating audit trail...', 95);
      await supabase.from('activities').insert({
        owner_id: user.id,
        type: 'import_completed',
        description: `Imported ${policiesCreatedCount} policies (${customersCreatedCount} new customers) from "${filename}"`,
        metadata: {
          import_id: importId,
          filename,
          customers_created: customersCreatedCount,
          policies_created: policiesCreatedCount,
          policies_updated: policiesUpdatedCount,
          duplicates_skipped: duplicatesSkippedCount,
          errors_count: errorsToLog.length,
        },
      });

      // 6. Update imports session to completed
      const finalStatus =
        errorsToLog.length > 0 && policiesCreatedCount === 0 && policiesUpdatedCount === 0
          ? 'failed'
          : errorsToLog.length > 0
          ? 'partially_completed'
          : 'completed';

      await supabase
        .from('imports')
        .update({
          customers_created: customersCreatedCount,
          policies_created: policiesCreatedCount,
          policies_updated: policiesUpdatedCount,
          duplicates: duplicatesSkippedCount,
          errors: errorsToLog.length,
          status: finalStatus,
          completed_at: new Date().toISOString(),
        })
        .eq('id', importId);

      onProgress?.('Import complete!', 100);

      return {
        importId,
        status: finalStatus,
        totalRows: validatedRows.length,
        customersCreated: customersCreatedCount,
        policiesCreated: policiesCreatedCount,
        policiesUpdated: policiesUpdatedCount,
        duplicatesSkipped: duplicatesSkippedCount,
        errorsCount: errorsToLog.length,
      };
    } catch (err: unknown) {
      console.error('Fatal error during import execution:', err);
      // Mark import record as failed
      await supabase
        .from('imports')
        .update({
          status: 'failed',
          errors: errorsToLog.length + 1,
          completed_at: new Date().toISOString(),
        })
        .eq('id', importId);

      throw err;
    }
  }
}
