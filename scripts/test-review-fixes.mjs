import assert from 'node:assert/strict';
import { addCalendarYear } from '../src/lib/date-utils.ts';
import { fetchAllRecords, readApiResponse } from '../src/lib/api-client.ts';
import { validateAndDeduplicateRows } from '../src/lib/import/validation-engine.ts';

assert.equal(addCalendarYear('2028-02-29'), '2029-02-28');
assert.equal(addCalendarYear('2026-10-09'), '2027-10-09');
assert.throws(() => addCalendarYear('2029-02-29'));

const mapping = { customer_name: 'name', phone: 'phone', email: 'email', policy_number: 'number', insurance_company: 'insurer', policy_type: 'type', premium: 'premium', expiry_date: 'expiry' };
const row = { name: 'Alex Kumar', phone: '9876543210', email: '', number: 'REVIEW-01', insurer: 'Review Insurance', type: 'Motor', premium: '₹1,250', expiry: '2027-10-09' };
const customer = { id: 'existing', name: row.name, phone: '9123456789', email: 'someone@example.com' };
let result = validateAndDeduplicateRows([row], mapping, [customer], []);
assert.equal(result.validatedRows[0].customerMatch.type, 'new', 'Same name with a different phone must remain a separate customer');
assert.equal(result.validatedRows[0].premium, 1250);
result = validateAndDeduplicateRows([{ ...row, phone: '' }], mapping, [customer, { ...customer, id: 'another' }], []);
assert.equal(result.validatedRows[0].customerMatch.type, 'new', 'Ambiguous names must not silently choose one customer');
result = validateAndDeduplicateRows([{ ...row, phone: '+91 9123456789' }], mapping, [customer], []);
assert.equal(result.validatedRows[0].customerMatch.existingCustomerId, 'existing', 'Normalized phone matches must still work');

const originalFetch = globalThis.fetch;
try {
  let requests = 0;
  globalThis.fetch = async url => {
    requests++;
    const page = Number(new URL(url, 'http://localhost').searchParams.get('page'));
    return Response.json({ data: page === 1 ? Array.from({ length: 500 }, (_, id) => ({ id })) : [{ id: 500 }], count: 501 });
  };
  const records = await fetchAllRecords('/api/customers');
  assert.equal(records.length, 501, 'List envelopes must be unwrapped and all pages loaded');
  assert.equal(requests, 2);
  await assert.rejects(() => readApiResponse(Response.json({ error: 'Please sign in' }, { status: 401 })), /Please sign in/);
} finally {
  globalThis.fetch = originalFetch;
}
console.log('Review regression checks passed: leap dates, customer identity, normalization, list pagination, and API failures.');
