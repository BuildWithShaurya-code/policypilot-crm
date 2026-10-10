import assert from 'node:assert/strict';
import { readAllPages } from '../src/lib/supabase/pagination.ts';
import { isAccountAllowed } from '../src/lib/account-access.ts';

const calls = [];
const records = Array.from({ length: 1006 }, (_, id) => ({ id }));
const all = await readAllPages(async (from, to) => {
  calls.push([from, to]);
  return { data: records.slice(from, to + 1), error: null };
});
assert.equal(all.length, 1006);
assert.deepEqual(calls, [[0,499],[500,999],[1000,1499]]);
await assert.rejects(readAllPages(async () => ({ data: null, error: { message: 'Page unavailable' } })), /Page unavailable/);
const priorNode = process.env.NODE_ENV;
const priorEmails = process.env.APP_ALLOWED_EMAILS;
try {
  process.env.NODE_ENV = 'production';
  delete process.env.APP_ALLOWED_EMAILS;
  assert.equal(isAccountAllowed('owner@example.test'), false);
  process.env.APP_ALLOWED_EMAILS = ' OWNER@example.test, team@example.test ';
  assert.equal(isAccountAllowed('owner@example.test'), true);
  assert.equal(isAccountAllowed('TEAM@EXAMPLE.TEST'), true);
  assert.equal(isAccountAllowed('outsider@example.test'), false);
} finally {
  if (priorNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorNode;
  if (priorEmails === undefined) delete process.env.APP_ALLOWED_EMAILS; else process.env.APP_ALLOWED_EMAILS = priorEmails;
}
console.log('Private access and multi-page failure regressions passed.');
