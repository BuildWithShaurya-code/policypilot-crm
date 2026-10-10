/**
 * Error Sanitizer & Translation Utility
 * Translates PostgreSQL error codes, PostgREST errors, and network issues
 * into clean, user-friendly messages without leaking database internals.
 */

export interface ErrorDetails {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export function sanitizeDatabaseError(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  if (!error) return fallbackMessage;

  const err = error as Record<string, unknown>;
  const code = typeof err.code === 'string' ? err.code : '';
  const rawMessage = typeof err.message === 'string' ? err.message : '';

  // 1. Unique constraint violations (e.g. duplicate policy number)
  if (code === '23505' || rawMessage.includes('duplicate key value') || rawMessage.includes('unique constraint')) {
    if (rawMessage.includes('policies_owner_policy_number_key') || rawMessage.includes('policy_number')) {
      return 'A policy with this policy number already exists in your account.';
    }
    if (rawMessage.includes('uq_automation_daily_run')) {
      return 'This daily automation run has already executed today.';
    }
    return 'A record with these unique details already exists.';
  }

  // 2. Check constraint violations (e.g. negative premium, invalid dates)
  if (code === '23514' || rawMessage.includes('violates check constraint')) {
    if (rawMessage.includes('policies_premium_check') || rawMessage.includes('premium')) {
      return 'Premium amount must be zero or a positive number.';
    }
    if (rawMessage.includes('check_policy_dates') || rawMessage.includes('start_date')) {
      return 'Policy expiry date cannot be earlier than the start date.';
    }
    if (rawMessage.includes('check_customer_name_length') || rawMessage.includes('name')) {
      return 'Customer name must be at least 2 characters long.';
    }
    if (rawMessage.includes('check_customer_phone_format') || rawMessage.includes('phone')) {
      return 'Phone number must be between 7 and 30 characters.';
    }
    if (rawMessage.includes('check_policy_number_length')) {
      return 'Policy number cannot be empty.';
    }
    if (rawMessage.includes('check_policy_insurer_length')) {
      return 'Insurer name must be at least 2 characters long.';
    }
    if (rawMessage.includes('check_policy_type_length')) {
      return 'Policy type must be at least 2 characters long.';
    }
    return 'Invalid data entered. Please check that all fields satisfy validation rules.';
  }

  // 3. Foreign key violations (e.g. deleted customer or policy)
  if (code === '23503' || rawMessage.includes('violates foreign key constraint')) {
    if (rawMessage.includes('customer_id')) {
      return 'The associated customer could not be found or has been removed.';
    }
    if (rawMessage.includes('policy_id')) {
      return 'The associated policy could not be found or has been removed.';
    }
    return 'A linked reference record could not be found.';
  }

  // 4. Permission / Row Level Security violations
  if (code === '42501' || rawMessage.includes('row-level security') || rawMessage.includes('permission denied')) {
    return 'You do not have permission to view or modify this record.';
  }

  // 5. Network / timeout errors
  if (
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('NetworkError') ||
    rawMessage.includes('timeout') ||
    rawMessage.includes('aborted')
  ) {
    return 'Unable to reach the server. Please check your internet connection.';
  }

  // 6. Auth errors
  if (rawMessage.includes('Invalid login credentials') || rawMessage.includes('invalid_grant')) {
    return 'Invalid email or password. Please try again.';
  }
  if (rawMessage.includes('User not authenticated') || rawMessage.includes('JWT')) {
    return 'Your session has expired. Please log in again to continue.';
  }

  // If already a clean user-level validation string (not raw SQL), return it
  if (!rawMessage.includes('relation') && !rawMessage.includes('constraint') && !rawMessage.includes('syntax error')) {
    return rawMessage || fallbackMessage;
  }

  return fallbackMessage;
}
