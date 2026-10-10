import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';
import { getCustomers, createCustomer, CustomerFilters, CreateCustomerInput } from '@/lib/services/customer-service';
import type { CustomerStatus } from '@/types/database.types';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;
  const statusParam = searchParams.get('status');
  const status = statusParam === 'all' || !statusParam ? undefined : (statusParam as CustomerStatus);
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined;
  const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined;

  const filters: CustomerFilters = { search, status, page, pageSize };
  const result = await getCustomers(filters, auth.supabase);

  if (result.error) {
    return errorResponse(result.error, 400);
  }

  return jsonResponse({
    data: result.data,
    count: result.count,
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  try {
    const body = await request.json();
    const input: CreateCustomerInput = {
      name: body.name,
      phone: body.phone,
      email: body.email,
      address: body.address,
      status: body.status,
      notes: body.notes,
    };

    const result = await createCustomer(input, auth.supabase);
    if (result.error) {
      return errorResponse(result.error, 400);
    }

    return jsonResponse(result.data, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid request body';
    return errorResponse(msg, 400);
  }
}
