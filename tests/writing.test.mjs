import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const checker = fileURLToPath(new URL('../scripts/check-writing.mjs', import.meta.url));
test('writing helper flags long prose but skips fenced diagram source', t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'writing-check-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const target = path.join(folder, 'architecture.md');
  fs.writeFileSync(target, '# Architecture\nThe UI uses existing components.\n- We will create a careful and detailed and well tested and highly robust new module which can handle many different situations and alternatives in the current system\n```mermaid\nflowchart LR\nA[Hello]-->B[World]\n```\n');
  const result = execFileSync(process.execPath, [checker, target], { encoding: 'utf8' });
  assert.match(result, /heuristic warning/);
  assert.match(result, /Line 3/);
  assert.doesNotMatch(result, /Line 5/);
});
