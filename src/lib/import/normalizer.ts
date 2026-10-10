/**
 * Data Normalization utilities for PolicyPilot Excel/CSV import
 */

export interface NormalizedPolicyRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  customerName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  policyNumber: string;
  insuranceCompany: string;
  policyType: string;
  premium: number | null;
  startDate: string | null;
  expiryDate: string | null;
  status: 'active' | 'expiring_soon' | 'due_today' | 'expired' | 'renewed';
  warnings: string[];
}

/**
 * Trims and collapses multiple spaces
 */
export function cleanString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes currency and numeric strings (e.g., " ₹18,500 " -> 18500)
 */
export function normalizePremium(val: unknown): { amount: number | null; warning?: string } {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { amount: null };
  }

  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return { amount: null };
    return { amount: Math.round(val * 100) / 100 };
  }

  let str = String(val).trim();
  // Strip common currency prefixes like "Rs.", "Rs", "INR", "USD" first so the dot in "Rs." isn't treated as decimal point
  str = str.replace(/^(rs\.?|inr|usd)\s*/i, '');
  // Remove currency signs, commas, letters, spaces (preserving digits and decimal dot)
  str = str.replace(/[₹$,\s€£a-zA-Z]/g, '');

  const parsed = parseFloat(str);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return { amount: null, warning: `Unparseable premium value: "${String(val)}"` };
  }

  return { amount: Math.round(parsed * 100) / 100 };
}

/**
 * Normalizes phone numbers
 * e.g., "+91 98765-43210" -> "9876543210" or "+919876543210"
 */
export function normalizePhone(val: unknown): { phone: string | null; warning?: string } {
  const clean = cleanString(val);
  if (!clean) return { phone: null };

  // Strip spaces, dashes, parentheses, dots
  let digits = clean.replace(/[\s\-\(\)\.]/g, '');

  // If starts with +91 or 91 and has 12 digits, strip country code to standardize 10-digit Indian numbers
  if (digits.startsWith('+91') && digits.length === 13) {
    digits = digits.substring(3);
  } else if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.substring(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.substring(1);
  }

  // Basic sanity check: should be 7-15 digits
  const digitOnly = digits.replace(/\D/g, '');
  if (digitOnly.length < 7 || digitOnly.length > 15) {
    return {
      phone: clean,
      warning: `Phone number "${clean}" may be invalid format`,
    };
  }

  return { phone: digitOnly };
}

/**
 * Normalizes email address
 */
export function normalizeEmail(val: unknown): { email: string | null; warning?: string } {
  const clean = cleanString(val).toLowerCase();
  if (!clean) return { email: null };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clean)) {
    return { email: clean, warning: `Invalid email address format: "${clean}"` };
  }

  return { email: clean };
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
function formatDateToISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses and normalizes date inputs from Excel or string to YYYY-MM-DD
 */
export function normalizeDate(val: unknown): { date: string | null; warning?: string } {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { date: null };
  }

  // 1. Direct Date object
  if (val instanceof Date) {
    if (isNaN(val.getTime())) {
      return { date: null, warning: 'Invalid Date object in cell' };
    }
    return { date: formatDateToISO(val) };
  }

  // 2. Numeric Excel serial number (e.g. 45200)
  if (typeof val === 'number') {
    try {
      // Excel epoch starts Jan 1 1900 with leap year bug offset
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const parsedDate = new Date(excelEpoch.getTime() + val * 86400000);
      if (!isNaN(parsedDate.getTime())) {
        return { date: formatDateToISO(parsedDate) };
      }
    } catch {
      return { date: null, warning: `Invalid Excel date serial: ${val}` };
    }
  }

  const str = cleanString(val);

  // 3. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      };
    }
  }

  // 4. Standard DD/MM/YYYY or DD-MM-YYYY format (common in Indian insurance sheets)
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);

    // If month > 12 and day <= 12, it might be MM/DD/YYYY, swap with warning
    if (month > 12 && day <= 12) {
      return {
        date: `${year}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`,
        warning: `Date "${str}" interpreted as MM/DD/YYYY`,
      };
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      };
    }
  }

  // 5. Native JS Date parsing fallback
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime()) && fallback.getFullYear() > 1990 && fallback.getFullYear() < 2100) {
    return {
      date: formatDateToISO(fallback),
      warning: `Date "${str}" parsed using standard date parser`,
    };
  }

  return { date: null, warning: `Unrecognized date format: "${str}"` };
}

/**
 * Normalizes insurance policy type
 */
export function normalizePolicyType(val: unknown): string {
  const clean = cleanString(val).toLowerCase();
  if (!clean) return 'other';

  if (clean.includes('motor') || clean.includes('car') || clean.includes('auto') || clean.includes('vehicle') || clean.includes('bike') || clean.includes('two wheeler') || clean.includes('commercial vehicle')) {
    return 'motor';
  }
  if (clean.includes('health') || clean.includes('mediclaim') || clean.includes('medical') || clean.includes('critical')) {
    return 'health';
  }
  if (clean.includes('life') || clean.includes('term') || clean.includes('endowment') || clean.includes('ulip')) {
    return 'life';
  }
  if (clean.includes('commercial') || clean.includes('fire') || clean.includes('marine') || clean.includes('business') || clean.includes('liability')) {
    return 'commercial';
  }
  if (clean.includes('travel') || clean.includes('overseas')) {
    return 'travel';
  }
  if (clean.includes('home') || clean.includes('house') || clean.includes('property')) {
    return 'home';
  }

  // Capitalize first letter of whatever was given or return as is
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Derives policy status based on expiry date
 */
export function derivePolicyStatus(
  expiryDateStr: string | null,
  explicitStatus?: string | null
): 'active' | 'expiring_soon' | 'due_today' | 'expired' | 'renewed' {
  if (explicitStatus) {
    const clean = cleanString(explicitStatus).toLowerCase();
    if (clean === 'renewed') return 'renewed';
    if (clean === 'expired') return 'expired';
    if (clean === 'active') return 'active';
    if (clean.includes('soon')) return 'expiring_soon';
    if (clean.includes('today')) return 'due_today';
  }

  if (!expiryDateStr) return 'active';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'expired';
  } else if (diffDays === 0) {
    return 'due_today';
  } else if (diffDays <= 30) {
    return 'expiring_soon';
  } else {
    return 'active';
  }
}
