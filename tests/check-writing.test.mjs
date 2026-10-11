import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const checker = fileURLToPath(new URL('../scripts/check-writing.mjs', import.meta.url));
function run(text) {
  const dir = mkdtempSync(path.join(tmpdir(), 'writing-review-test-'));
  try {
    const file = path.join(dir, 'doc.md');
    writeFileSync(file, text);
    return spawnSync(process.execPath, [checker, '--strict', file], {encoding:'utf8'});
  } finally { rmSync(dir, {recursive: true, force: true}); }
}
test('passes complete and concise prose', () => {
  const result = run('# Architecture\n\nThe desktop app sends the request to the worker.\n\n- The worker returns the result to the user.\n');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Found 0 heuristic warning/);
});
test('flags incomplete list item', () => {
  const result = run('# Architecture\n\n- Cache invalidation and local persistence\n');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /possible_fragment/);
});
test('ignores diagrams and tables', () => {
  const result = run('# Architecture\n\n```mermaid\nflowchart LR\n  A[User interface] --> B[Service]\n```\n\n| Field | Type |\n|---|---|\n| id | string |\n');
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
