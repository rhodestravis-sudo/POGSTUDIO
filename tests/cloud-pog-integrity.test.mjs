import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/api/state/route.ts', import.meta.url), 'utf8');

const functionBody = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, 'expected storage function exists');
  return source.slice(from, to);
};

test('valid owner workspace is not automatically replaced by a legacy copy', () => {
  const fn = functionBody('async function repairOwnerWorkspaceIfNeeded(', 'async function saveStreamedState(');
  const validityCheck = fn.indexOf('if (currentStructure)');
  const legacyLookup = fn.indexOf('const legacy =');
  assert.ok(validityCheck >= 0 && legacyLookup > validityCheck);
  assert.match(fn.slice(validityCheck, legacyLookup), /return \{ data, revision, repaired: false \}/);
  assert.doesNotMatch(fn.slice(0, legacyLookup), /currentStructure\.plans\.length\s*>\s*1/);
});

test('active POG save uses canonical workspace membership instead of cached pointer membership', () => {
  const fn = functionBody('async function writeActivePlanState(', 'async function legacyWorkspaceData(');
  assert.match(fn, /existingSummaries\s*=\s*scannedSummaries\.map\(/);
  assert.match(fn, /r2Key:\s*existingCacheKeys\.get\(item\.id\)/);
  assert.doesNotMatch(fn, /existingSummaries\s*=\s*existingPointer\?\.planograms/);
});
