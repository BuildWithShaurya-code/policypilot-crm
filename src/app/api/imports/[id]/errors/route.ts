import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';

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

  const { data: importExists, error: importCheckError } = await auth.supabase
    .from('imports')
    .select('id')
    .eq('id', id)
    .single();

  if (importCheckError || !importExists) {
    return errorResponse('Import session not found', 404);
  }

  const { data, error } = await auth.supabase
    .from('import_errors')
    .select('*')
    .eq('import_id', id)
    .order('row_number', { ascending: true });

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse(data || []);
}
