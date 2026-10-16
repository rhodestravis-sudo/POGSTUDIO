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

test('partial cloud workspaces cannot perform misleading POG deletions', () => {
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const start = page.indexOf('  const deletePog = () => {');
  const end = page.indexOf('  const restoreDeletedPog =', start);
  assert.ok(start >= 0 && end > start, 'POG deletion function exists');
  const fn = page.slice(start, end);
  assert.match(fn, /if \(partialWorkspace && !fullWorkspaceHydrated\.current\)/);
  assert.match(fn, /No POG has been deleted/);
  assert.match(fn, /openedPlanograms\.current\.delete\(plan\.id\)/);
  assert.match(fn, /setPlanogramSummaries\(remainingSummaries\)/);
});

test('cloud loading never substitutes a different POG for the selected file', () => {
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const start = page.indexOf('  const loadPlanogramFromCloud = async (');
  const end = page.indexOf('  useEffect(() => {', start);
  assert.ok(start >= 0 && end > start, 'cloud POG loader exists');
  const fn = page.slice(start, end);
  assert.match(fn, /loadedWorkspace\.planograms\.find\(\(item\) => item\.id === id\)/);
  assert.match(fn, /if \(!loadedPlan\) throw new Error/);
  assert.doesNotMatch(fn, /loadedWorkspace\.planograms\[0\]/);
});
