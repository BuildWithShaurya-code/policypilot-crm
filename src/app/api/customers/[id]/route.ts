import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';
import { getCustomerById, updateCustomer, deleteCustomer, UpdateCustomerInput } from '@/lib/services/customer-service';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { id } = await context.params;
  const result = await getCustomerById(id, auth.supabase);

  if (result.error || !result.data) {
    return errorResponse(result.error || 'Customer not found', 404);
  }

  return jsonResponse(result.data);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { id } = await context.params;
  try {
    const body = await request.json();
    const input: UpdateCustomerInput = {
      name: body.name,
      phone: body.phone,
      email: body.email,
      address: body.address,
      status: body.status,
      notes: body.notes,
    };

    const result = await updateCustomer(id, input, auth.supabase);
    if (result.error || !result.data) {
      return errorResponse(result.error || 'Failed to update customer', 400);
    }

    return jsonResponse(result.data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid request payload';
    return errorResponse(msg, 400);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { id } = await context.params;
  const result = await deleteCustomer(id, auth.supabase);
  if (result.error || !result.success) {
    return errorResponse(result.error || 'Failed to delete customer', 400);
  }

  return jsonResponse({ success: true, message: 'Customer deleted successfully' });
}
