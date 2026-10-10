import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';
import type { Customer, Policy } from '@/types/database.types';
import { validateAndDeduplicateRows } from '@/lib/import/validation-engine';
import { ImportService } from '@/lib/services/import-service';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { data, error } = await auth.supabase
    .from('imports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse(data || []);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return errorResponse('Unauthorized: Please sign in', 401);
  try {
    const body = await request.json();
    const rows = body.rows || body.mappedRows;
    const strategy = body.duplicateStrategy || 'skip';
    if (!Array.isArray(rows) || rows.length === 0 || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
      return errorResponse('Provide a non-empty array of import rows', 400);
    }
    if (!['skip', 'update'].includes(strategy)) return errorResponse('Duplicate strategy must be skip or update', 400);
    async function references<T>(table: 'customers' | 'policies', columns: string): Promise<T[]> {
      const records: T[] = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await auth!.supabase.from(table).select(columns).order('id').range(from, from + 499);
        if (error) throw new Error('Failed to load existing import records');
        const page = (data || []) as unknown as T[];
        records.push(...page);
        if (page.length < 500) return records;
      }
    }
    const [customers, policies] = await Promise.all([
      references<Pick<Customer, 'id' | 'name' | 'phone' | 'email'>>('customers', 'id,name,phone,email'),
      references<Pick<Policy, 'id' | 'policy_number' | 'customer_id'>>('policies', 'id,policy_number,customer_id'),
    ]);
    const { validatedRows, summary } = validateAndDeduplicateRows(rows, {
      customer_name: 'customerName', phone: 'phone', email: 'email', address: 'address',
      policy_number: 'policyNumber', insurance_company: 'insurer', policy_type: 'policyType',
      premium: 'premium', start_date: 'startDate', expiry_date: 'expiryDate',
    }, customers, policies);
    for (const row of validatedRows) {
      if (row.policyMatch.type === 'existing_db') {
        row.policyMatch.action = strategy === 'update' ? 'update_existing' : 'skip';
      }
    }
    const result = await ImportService.executeImport({
      filename: typeof body.filename === 'string' ? body.filename : 'Insurance_Import.xlsx', validatedRows, summary,
    }, undefined, auth.supabase);
    if (result.errorMessage) return errorResponse(result.errorMessage, 400);
    return jsonResponse({ ...result, customersAdded: result.customersCreated, policiesAdded: result.policiesCreated });
  } catch {
    return errorResponse('Unable to process the import. Please check the uploaded rows.', 400);
  }
}
