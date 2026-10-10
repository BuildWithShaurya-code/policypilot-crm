import { ColumnMapping } from './excel-parser';
import {
  cleanString,
  normalizePremium,
  normalizePhone,
  normalizeEmail,
  normalizeDate,
  normalizePolicyType,
  derivePolicyStatus,
} from './normalizer';
import type { Customer, Policy } from '@/types/database.types';

export type ValidationCategory = 'VALID' | 'WARNING' | 'ERROR' | 'DUPLICATE';

export interface RowValidationError {
  field: string;
  value: string;
  message: string;
  isFatal: boolean; // if fatal -> ERROR category
}

export interface ValidatedRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  category: ValidationCategory;
  
  // Normalized attributes
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
  
  // Validation details
  errors: RowValidationError[];
  warnings: string[];
  
  // Deduplication & Matching details
  customerMatch: {
    type: 'new' | 'existing';
    existingCustomerId?: string;
    existingCustomerName?: string;
    matchSignal?: 'phone' | 'email' | 'name';
    intraFileGroupKey: string;
  };
  
  policyMatch: {
    type: 'new' | 'existing_db' | 'intra_file_duplicate';
    existingPolicyId?: string;
    existingPolicyNumber?: string;
    action: 'skip' | 'update_existing';
  };
}

export interface ValidationSummary {
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  duplicateCount: number;
  
  // Import impact counts
  newCustomersCount: number;
  existingCustomersCount: number;
  newPoliciesCount: number;
  updatePoliciesCount: number;
  skippedDuplicatesCount: number;
  
  uniqueCustomerGroups: number;
}

/**
 * Generates a consistent matching key for customer deduplication
 */
function getCustomerGroupKey(name: string, phone: string | null, email: string | null): string {
  const normName = cleanString(name).toLowerCase();
  if (phone) return `phone:${phone}`;
  if (email) return `email:${email.toLowerCase()}`;
  return `name:${normName}`;
}

/**
 * Validates and deduplicates all raw rows from an uploaded spreadsheet
 */
export function validateAndDeduplicateRows(
  rawRows: Record<string, unknown>[],
  mappings: ColumnMapping,
  existingCustomers: Pick<Customer, 'id' | 'name' | 'phone' | 'email'>[],
  existingPolicies: Pick<Policy, 'id' | 'policy_number' | 'customer_id'>[]
): { validatedRows: ValidatedRow[]; summary: ValidationSummary } {
  // Build lookup maps for fast O(1) checks without N+1 queries
  const phoneToCustomerMap = new Map<string, Pick<Customer, 'id' | 'name' | 'phone' | 'email'>>();
  const emailToCustomerMap = new Map<string, Pick<Customer, 'id' | 'name' | 'phone' | 'email'>>();
  const nameToCustomerMap = new Map<string, Pick<Customer, 'id' | 'name' | 'phone' | 'email'>>();

  existingCustomers.forEach((cust) => {
    if (cust.phone) {
      const norm = normalizePhone(cust.phone).phone;
      if (norm) phoneToCustomerMap.set(norm, cust);
    }
    if (cust.email) {
      emailToCustomerMap.set(cust.email.trim().toLowerCase(), cust);
    }
    if (cust.name) {
      nameToCustomerMap.set(cust.name.trim().toLowerCase(), cust);
    }
  });

  const existingPolicyNumberMap = new Map<string, Pick<Policy, 'id' | 'policy_number' | 'customer_id'>>();
  existingPolicies.forEach((p) => {
    if (p.policy_number) {
      existingPolicyNumberMap.set(p.policy_number.trim().toUpperCase(), p);
    }
  });

  const validatedRows: ValidatedRow[] = [];
  const intraFilePolicyNumbers = new Set<string>();
  const intraFileCustomerGroups = new Map<string, { groupKey: string; assignedId?: string }>();

  // Process each row
  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // Row 1 is header
    const errors: RowValidationError[] = [];
    const warnings: string[] = [];

    // Extract raw values using user mappings
    const rawCustName = mappings.customer_name ? raw[mappings.customer_name] : '';
    const rawPhone = mappings.phone ? raw[mappings.phone] : '';
    const rawEmail = mappings.email ? raw[mappings.email] : '';
    const rawAddress = mappings.address ? raw[mappings.address] : '';
    const rawPolicyNum = mappings.policy_number ? raw[mappings.policy_number] : '';
    const rawInsurer = mappings.insurance_company ? raw[mappings.insurance_company] : '';
    const rawPolicyType = mappings.policy_type ? raw[mappings.policy_type] : '';
    const rawPremium = mappings.premium ? raw[mappings.premium] : '';
    const rawStartDate = mappings.start_date ? raw[mappings.start_date] : '';
    const rawExpiryDate = mappings.expiry_date ? raw[mappings.expiry_date] : '';
    const rawStatus = mappings.status ? String(raw[mappings.status] ?? '') : '';

    // 1. Customer Name Validation
    const customerName = cleanString(rawCustName);
    if (!customerName) {
      errors.push({
        field: 'Customer Name',
        value: String(rawCustName || ''),
        message: 'Customer name is required',
        isFatal: true,
      });
    }

    // 2. Phone Validation
    const { phone, warning: phoneWarn } = normalizePhone(rawPhone);
    if (phoneWarn) warnings.push(phoneWarn);

    // 3. Email Validation
    const { email, warning: emailWarn } = normalizeEmail(rawEmail);
    if (emailWarn) warnings.push(emailWarn);

    // 4. Address Normalization
    const address = cleanString(rawAddress) || null;

    // 5. Policy Number Validation
    const policyNumber = cleanString(rawPolicyNum).toUpperCase();
    if (!policyNumber) {
      errors.push({
        field: 'Policy Number',
        value: String(rawPolicyNum || ''),
        message: 'Policy number is required',
        isFatal: true,
      });
    }

    // 6. Insurance Company Validation
    const insuranceCompany = cleanString(rawInsurer);
    if (!insuranceCompany) {
      errors.push({
        field: 'Insurance Company',
        value: String(rawInsurer || ''),
        message: 'Insurance company is required',
        isFatal: true,
      });
    }

    // 7. Policy Type Normalization
    const policyType = normalizePolicyType(rawPolicyType);

    // 8. Premium Validation
    const { amount: premium, warning: premWarn } = normalizePremium(rawPremium);
    if (premWarn) warnings.push(premWarn);
    if (premium === null || premium === undefined) {
      errors.push({
        field: 'Premium',
        value: String(rawPremium || ''),
        message: 'Valid premium amount is required',
        isFatal: true,
      });
    } else if (premium < 0) {
      errors.push({
        field: 'Premium',
        value: String(rawPremium || ''),
        message: 'Premium cannot be negative',
        isFatal: true,
      });
    }

    // 9. Start Date Validation
    const { date: startDate, warning: startWarn } = normalizeDate(rawStartDate);
    if (startWarn) warnings.push(startWarn);

    // 10. Expiry Date Validation
    const { date: expiryDate, warning: expWarn } = normalizeDate(rawExpiryDate);
    if (expWarn) warnings.push(expWarn);
    if (!expiryDate) {
      errors.push({
        field: 'Expiry Date',
        value: String(rawExpiryDate || ''),
        message: 'Valid expiry date is required (e.g. DD/MM/YYYY or YYYY-MM-DD)',
        isFatal: true,
      });
    }

    // 11. Date Relationship Check: start_date <= expiry_date
    if (startDate && expiryDate) {
      if (startDate > expiryDate) {
        errors.push({
          field: 'Start / Expiry Date',
          value: `Start: ${startDate}, Expiry: ${expiryDate}`,
          message: 'Start date cannot be after expiry date',
          isFatal: true,
        });
      }
    }

    // 12. Policy Status
    const status = derivePolicyStatus(expiryDate, rawStatus);

    // 13. Customer Deduplication & Matching
    const groupKey = getCustomerGroupKey(customerName, phone, email);
    let customerMatch: ValidatedRow['customerMatch'] = {
      type: 'new',
      intraFileGroupKey: groupKey,
    };

    if (phone && phoneToCustomerMap.has(phone)) {
      const existing = phoneToCustomerMap.get(phone)!;
      customerMatch = {
        type: 'existing',
        existingCustomerId: existing.id,
        existingCustomerName: existing.name || customerName,
        matchSignal: 'phone',
        intraFileGroupKey: groupKey,
      };
    } else if (email && emailToCustomerMap.has(email.toLowerCase())) {
      const existing = emailToCustomerMap.get(email.toLowerCase())!;
      customerMatch = {
        type: 'existing',
        existingCustomerId: existing.id,
        existingCustomerName: existing.name || customerName,
        matchSignal: 'email',
        intraFileGroupKey: groupKey,
      };
    } else if (!phone && !email && customerName && nameToCustomerMap.has(customerName.toLowerCase())) {
      // Only match by name if phone and email are absent or don't conflict
      const existing = nameToCustomerMap.get(customerName.toLowerCase())!;
      if (existingCustomers.filter(c => c.name.trim().toLowerCase() === customerName.toLowerCase()).length === 1) {
        customerMatch = {
          type: 'existing',
          existingCustomerId: existing.id,
          existingCustomerName: existing.name || customerName,
          matchSignal: 'name',
          intraFileGroupKey: groupKey,
        };
      }
    }

    if (!intraFileCustomerGroups.has(groupKey)) {
      intraFileCustomerGroups.set(groupKey, {
        groupKey,
        assignedId: customerMatch.existingCustomerId,
      });
    }

    // 14. Policy Duplicate Detection
    let policyMatch: ValidatedRow['policyMatch'] = {
      type: 'new',
      action: 'skip',
    };

    if (policyNumber) {
      if (existingPolicyNumberMap.has(policyNumber)) {
        const existing = existingPolicyNumberMap.get(policyNumber)!;
        policyMatch = {
          type: 'existing_db',
          existingPolicyId: existing.id,
          existingPolicyNumber: existing.policy_number,
          action: 'skip', // default action
        };
      } else if (intraFilePolicyNumbers.has(policyNumber)) {
        policyMatch = {
          type: 'intra_file_duplicate',
          action: 'skip',
        };
      } else {
        intraFilePolicyNumbers.add(policyNumber);
      }
    }

    // 15. Determine Overall Category
    let category: ValidationCategory = 'VALID';
    const hasFatalErrors = errors.some((e) => e.isFatal);

    if (hasFatalErrors) {
      category = 'ERROR';
    } else if (policyMatch.type !== 'new') {
      category = 'DUPLICATE';
    } else if (warnings.length > 0) {
      category = 'WARNING';
    } else {
      category = 'VALID';
    }

    validatedRows.push({
      rowNumber,
      raw,
      category,
      customerName,
      phone,
      email,
      address,
      policyNumber,
      insuranceCompany,
      policyType,
      premium,
      startDate,
      expiryDate,
      status,
      errors,
      warnings,
      customerMatch,
      policyMatch,
    });
  });

  // Calculate dynamic summary
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;
  let newPoliciesCount = 0;
  let updatePoliciesCount = 0;
  let skippedDuplicatesCount = 0;

  const newCustomerGroupKeys = new Set<string>();
  const existingCustomerIds = new Set<string>();

  validatedRows.forEach((row) => {
    if (row.category === 'ERROR') {
      errorCount++;
    } else if (row.category === 'DUPLICATE') {
      duplicateCount++;
      if (row.policyMatch.action === 'update_existing') {
        updatePoliciesCount++;
      } else {
        skippedDuplicatesCount++;
      }
    } else if (row.category === 'WARNING') {
      warningCount++;
      newPoliciesCount++;
    } else {
      validCount++;
      newPoliciesCount++;
    }

    // Only count customer groups for non-error rows
    if (row.category !== 'ERROR') {
      if (row.customerMatch.type === 'existing' && row.customerMatch.existingCustomerId) {
        existingCustomerIds.add(row.customerMatch.existingCustomerId);
      } else {
        newCustomerGroupKeys.add(row.customerMatch.intraFileGroupKey);
      }
    }
  });

  const summary: ValidationSummary = {
    totalRows: validatedRows.length,
    validCount,
    warningCount,
    errorCount,
    duplicateCount,
    newCustomersCount: newCustomerGroupKeys.size,
    existingCustomersCount: existingCustomerIds.size,
    newPoliciesCount,
    updatePoliciesCount,
    skippedDuplicatesCount,
    uniqueCustomerGroups: intraFileCustomerGroups.size,
  };

  return { validatedRows, summary };
}
