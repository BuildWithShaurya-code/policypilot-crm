/**
 * Environment variables validation and configuration for PolicyPilot.
 * Never logs or returns sensitive values.
 */

export interface EnvValidationResult {
  isValid: boolean;
  missingVariables: string[];
  errors: string[];
}

export function validateClientEnv(): EnvValidationResult {
  const missing: string[] = [];
  const errors: string[] = [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || url.trim() === '') {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  } else if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL');
  }

  if (!anonKey || anonKey.trim() === '') {
    missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  return {
    isValid: missing.length === 0 && errors.length === 0,
    missingVariables: missing,
    errors,
  };
}

export function validateServerEnv(): EnvValidationResult {
  const clientValidation = validateClientEnv();
  const missing = [...clientValidation.missingVariables];
  const errors = [...clientValidation.errors];

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || serviceKey.trim() === '') {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  return {
    isValid: missing.length === 0 && errors.length === 0,
    missingVariables: missing,
    errors,
  };
}

/**
 * Safe environment summary that indicates whether keys are configured
 * without ever exposing secret values.
 */
export function getSafeEnvStatus() {
  return {
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabasePublishableKeyConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    supabaseServiceRoleKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseUrlDomain: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null,
  };
}
