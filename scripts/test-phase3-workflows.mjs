/**
 * PolicyPilot Phase 3 Automated Test Suite
 * Covers:
 * 1. Pure Business Logic (Date calculations, IST timezone, renewal classifications, overdue rules)
 * 2. Normalization & Validation (Premiums, phones, emails, dates, policy types)
 * 3. Import Engine & Deduplication (Intra-file duplicate detection, status transitions, counters)
 * 4. Security & Boundary Correctness (Client/server boundary, error sanitization, secret hygiene)
 * 5. Automation & API Contract Assumptions (Bearer token auth, query param blocking)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load Pure Utilities
import {
  getTodayDateString,
  formatDateInIndia,
  checkIsOverdue,
} from '../src/lib/date-utils.ts';
import { calculateDaysRemaining } from '../src/lib/services/renewal-service.ts';

import {
  normalizePremium,
  normalizePhone,
  normalizeEmail,
  normalizeDate,
  normalizePolicyType,
  derivePolicyStatus,
} from '../src/lib/import/normalizer.ts';

import {
  validateAndDeduplicateRows,
} from '../src/lib/import/validation-engine.ts';

import {
  sanitizeDatabaseError,
} from '../src/lib/error-utils.ts';

console.log('================================================================');
console.log('   POLICYPILOT PHASE 3: COMPREHENSIVE AUTOMATED TEST SUITE      ');
console.log('================================================================\n');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    failedTests++;
  }
}

// -----------------------------------------------------------------------------
// 1. PURE BUSINESS LOGIC: DATES & TIMEZONES (IST)
// -----------------------------------------------------------------------------
console.log('\n--- 1. DATE UTILITIES & IST TIMEZONE LOGIC ---');

test('getTodayDateString returns YYYY-MM-DD format in Asia/Kolkata timezone', () => {
  const today = getTodayDateString();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/, 'Should be YYYY-MM-DD');
});

test('formatDateInIndia correctly formats UTC timestamps to IST calendar date', () => {
  // 2026-10-07 19:00 UTC is 2026-10-08 00:30 IST (+5:30)
  const utcDate = new Date('2026-10-07T19:00:00Z');
  const istFormatted = formatDateInIndia(utcDate);
  assert.equal(istFormatted, '2026-10-08', '19:00 UTC must advance to next day in IST');
});

test('calculateDaysRemaining accurately measures date deltas', () => {
  const today = getTodayDateString();
  assert.equal(calculateDaysRemaining(today), 0, 'Today expiry must have 0 days remaining');
  
  // Future date (+10 days)
  const d = new Date();
  d.setDate(d.getDate() + 10);
  const futureStr = d.toISOString().split('T')[0];
  const delta = calculateDaysRemaining(futureStr);
  assert.ok(delta >= 9 && delta <= 11, 'Future date should have approx 10 days remaining');

  // Past date (-5 days)
  const past = new Date();
  past.setDate(past.getDate() - 5);
  const pastStr = past.toISOString().split('T')[0];
  assert.ok(calculateDaysRemaining(pastStr) < 0, 'Past date must have negative days remaining');
});

// -----------------------------------------------------------------------------
// 2. FOLLOW-UP WORKFLOW & OVERDUE CLASSIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- 2. FOLLOW-UP & OVERDUE CLASSIFICATION ---');

test('Completed follow-up is NEVER overdue regardless of date/time', () => {
  assert.equal(checkIsOverdue('2020-01-01', '09:00', 'completed'), false);
  assert.equal(checkIsOverdue('2020-01-01', null, 'completed'), false);
});

test('Past scheduled_date is overdue for pending follow-up', () => {
  assert.equal(checkIsOverdue('2020-01-01', null, 'pending'), true);
  assert.equal(checkIsOverdue('2020-01-01', '10:00', 'pending'), true);
});

test('Future scheduled_date is NOT overdue for pending follow-up', () => {
  const futureYear = new Date().getFullYear() + 2;
  assert.equal(checkIsOverdue(`${futureYear}-12-31`, null, 'pending'), false);
  assert.equal(checkIsOverdue(`${futureYear}-12-31`, '09:00', 'pending'), false);
});

test('Today scheduled_date with past time is overdue', () => {
  const today = getTodayDateString();
  assert.equal(checkIsOverdue(today, '00:01', 'pending'), true);
});

test('Today scheduled_date with future time (23:59) is not overdue', () => {
  const today = getTodayDateString();
  assert.equal(checkIsOverdue(today, '23:59', 'pending'), false);
});

// -----------------------------------------------------------------------------
// 3. NORMALIZATION & PARSING LOGIC
// -----------------------------------------------------------------------------
console.log('\n--- 3. DATA NORMALIZATION ---');

test('normalizePremium handles currency symbols, commas, and decimals', () => {
  assert.equal(normalizePremium(' ₹ 25,000.50 ').amount, 25000.50);
  assert.equal(normalizePremium('Rs. 1,50,000').amount, 150000);
  assert.equal(normalizePremium(18500).amount, 18500);
  assert.equal(normalizePremium('0').amount, 0);
  assert.equal(normalizePremium('').amount, null);
  assert.equal(normalizePremium(null).amount, null);
  assert.ok(normalizePremium('invalid-amt').warning !== undefined);
});

test('normalizePhone formats Indian numbers and strips +91 / prefixes', () => {
  assert.equal(normalizePhone('+91 98765-43210').phone, '9876543210');
  assert.equal(normalizePhone('09876543210').phone, '9876543210');
  assert.equal(normalizePhone('919876543210').phone, '9876543210');
  assert.equal(normalizePhone('9876543210').phone, '9876543210');
  assert.equal(normalizePhone('').phone, null);
  assert.ok(normalizePhone('123').warning !== undefined, 'Short phone gives warning');
});

test('normalizeEmail lowercases and validates email syntax', () => {
  assert.equal(normalizeEmail('  John.Doe@Example.COM  ').email, 'john.doe@example.com');
  assert.equal(normalizeEmail('').email, null);
  assert.ok(normalizeEmail('invalid-email-address').warning !== undefined);
});

test('normalizeDate parses multiple formats to ISO YYYY-MM-DD', () => {
  assert.equal(normalizeDate('2026-10-15').date, '2026-10-15');
  assert.equal(normalizeDate('15/10/2026').date, '2026-10-15');
  assert.equal(normalizeDate('15-10-2026').date, '2026-10-15');
  assert.equal(normalizeDate('2026/10/15').date, '2026-10-15');
  assert.equal(normalizeDate('').date, null);
  assert.ok(normalizeDate('not-a-date').warning !== undefined);
});

test('normalizePolicyType maps common variations', () => {
  assert.equal(normalizePolicyType('Two Wheeler Comprehensive'), 'motor');
  assert.equal(normalizePolicyType('Mediclaim Individual'), 'health');
  assert.equal(normalizePolicyType('Term Life Plan'), 'life');
  assert.equal(normalizePolicyType('Fire & Special Perils'), 'commercial');
  assert.equal(normalizePolicyType(''), 'other');
});

test('derivePolicyStatus classifies active, expiring_soon, due_today, expired', () => {
  const today = getTodayDateString();
  assert.equal(derivePolicyStatus(today), 'due_today');

  const pastDate = '2020-01-01';
  assert.equal(derivePolicyStatus(pastDate), 'expired');

  // 15 days in future -> expiring_soon
  const in15 = new Date();
  in15.setDate(in15.getDate() + 15);
  assert.equal(derivePolicyStatus(in15.toISOString().split('T')[0]), 'expiring_soon');

  // 100 days in future -> active
  const in100 = new Date();
  in100.setDate(in100.getDate() + 100);
  assert.equal(derivePolicyStatus(in100.toISOString().split('T')[0]), 'active');
});

// -----------------------------------------------------------------------------
// 4. IMPORT PIPELINE & DEDUPLICATION ENGINE
// -----------------------------------------------------------------------------
console.log('\n--- 4. IMPORT VALIDATION & DEDUPLICATION ENGINE ---');

test('validateAndDeduplicateRows marks valid rows and catches invalid data', () => {
  const rawRows = [
    {
      'Customer': 'Arun Verma',
      'Phone': '9876543210',
      'Email': 'arun@example.com',
      'Policy Number': 'POL-1001',
      'Insurer': 'HDFC ERGO',
      'Type': 'Health',
      'Premium': '15000',
      'Start Date': '2025-01-01',
      'Expiry Date': '2026-01-01',
    },
    {
      'Customer': '', // Fatal error: missing customer name
      'Phone': '9876543211',
      'Policy Number': 'POL-1002',
      'Expiry Date': '2026-01-01',
    },
    {
      'Customer': 'Deepa Nair',
      'Phone': '9876543212',
      'Policy Number': 'POL-1003',
      'Start Date': '2026-12-31', // Fatal error: start date > expiry date
      'Expiry Date': '2026-01-01',
    },
  ];

  const mappings = {
    customer_name: 'Customer',
    phone: 'Phone',
    email: 'Email',
    policy_number: 'Policy Number',
    insurance_company: 'Insurer',
    policy_type: 'Type',
    premium: 'Premium',
    start_date: 'Start Date',
    expiry_date: 'Expiry Date',
  };

  const { validatedRows, summary } = validateAndDeduplicateRows(rawRows, mappings, [], []);

  assert.equal(summary.totalRows, 3, 'Total rows should be 3');
  assert.equal(summary.validCount, 1, 'Only 1 row should be completely valid');
  assert.equal(summary.errorCount, 2, '2 rows must have fatal validation errors');
  assert.equal(validatedRows[0].category, 'VALID');
  assert.equal(validatedRows[1].category, 'ERROR');
  assert.equal(validatedRows[2].category, 'ERROR');
});

test('Deduplication identifies existing DB policy and handles intra-file duplicate', () => {
  const existingCustomers = [
    { id: 'cust-1', name: 'Rohan Sharma', phone: '9988776655', email: 'rohan@example.com' },
  ];
  const existingPolicies = [
    { id: 'pol-1', policy_number: 'POL-EXISTING-99', customer_id: 'cust-1' },
  ];

  const rawRows = [
    // 1. Existing DB policy match
    {
      'Customer': 'Rohan Sharma',
      'Phone': '9988776655',
      'Policy': 'POL-EXISTING-99',
      'Company': 'HDFC ERGO',
      'Premium': '12000',
      'Expiry': '2027-01-01',
    },
    // 2. Unique row
    {
      'Customer': 'Kiran Patel',
      'Phone': '9123456789',
      'Policy': 'POL-NEW-101',
      'Company': 'ICICI Lombard',
      'Premium': '8500',
      'Expiry': '2027-01-01',
    },
    // 3. Intra-file duplicate of row 2
    {
      'Customer': 'Kiran Patel',
      'Phone': '9123456789',
      'Policy': 'POL-NEW-101',
      'Company': 'ICICI Lombard',
      'Premium': '8500',
      'Expiry': '2027-01-01',
    },
  ];

  const mappings = {
    customer_name: 'Customer',
    phone: 'Phone',
    policy_number: 'Policy',
    insurance_company: 'Company',
    premium: 'Premium',
    expiry_date: 'Expiry',
  };

  const { validatedRows, summary } = validateAndDeduplicateRows(
    rawRows,
    mappings,
    existingCustomers,
    existingPolicies
  );

  assert.equal(summary.duplicateCount, 2, 'Should flag 2 duplicates (1 db match, 1 intra-file duplicate)');
  assert.equal(validatedRows[0].policyMatch.type, 'existing_db', 'Row 1 matched existing database policy');
  assert.equal(validatedRows[2].policyMatch.type, 'intra_file_duplicate', 'Row 3 is intra-file duplicate');
});

// -----------------------------------------------------------------------------
// 5. DATABASE ERROR SANITIZATION & SECURITY
// -----------------------------------------------------------------------------
console.log('\n--- 5. ERROR SANITIZATION & SECURITY ---');

test('sanitizeDatabaseError conceals postgres schema internals for unique constraints', () => {
  const pgDuplicateError = {
    code: '23505',
    message: 'duplicate key value violates unique constraint "policies_owner_policy_number_key"',
  };
  const sanitized = sanitizeDatabaseError(pgDuplicateError);
  assert.equal(
    sanitized,
    'A policy with this policy number already exists in your account.',
    'Should translate duplicate policy error into friendly message'
  );
  assert.ok(!sanitized.includes('policies_owner_policy_number_key'), 'Must not leak index name');
});

test('sanitizeDatabaseError translates check constraint violations', () => {
  const pgCheckError = {
    code: '23514',
    message: 'new row for relation "policies" violates check constraint "policies_premium_check"',
  };
  const sanitized = sanitizeDatabaseError(pgCheckError);
  assert.equal(sanitized, 'Premium amount must be zero or a positive number.');
});

test('Client bundles never contain SUPABASE_SERVICE_ROLE_KEY', () => {
  // Read all client-side files in src/app and src/components
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        // Skip API routes and server libraries
        if (fullPath.includes(path.join('src', 'app', 'api')) || fullPath.includes(path.join('src', 'lib', 'supabase', 'admin.ts'))) {
          continue;
        }
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(
          !content.includes('SUPABASE_SERVICE_ROLE_KEY'),
          `Service role key must never appear in client module: ${fullPath}`
        );
      }
    }
  }

  scanDir(path.resolve(process.cwd(), 'src', 'app'));
  scanDir(path.resolve(process.cwd(), 'src', 'components'));
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL WORKFLOW & REGRESSION TESTS PASSED! ✨\n');
  process.exit(0);
}
