import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../scripts/workflow.mjs', import.meta.url));
function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-architect-v2-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = (...args) => execFileSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' });
  const bad = (...args) => spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' });
  const write = (rel, contents) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
    return rel;
  };
  const state = () => JSON.parse(fs.readFileSync(path.join(root, '.plans', 'feature', 'state.json'), 'utf8'));
  const next = () => JSON.parse(run('next', 'feature'));
  return { root, run, bad, write, state, next };
}
const prefix = '.plans/feature/';
function bootstrap(w) {
  w.run('init', 'feature');
  w.write(prefix + 'architecture.md', '# Design\nThe app displays the feature.');
  w.run('record', 'feature', 'architecture', prefix + 'architecture.md');
  w.run('approve', 'feature', 'architecture', '--user-approved');
  w.write(prefix + 'mockups/README.md', '# Mockups\nThe UI uses app tokens.');
  w.run('record', 'feature', 'mockups', prefix + 'mockups/README.md');
  w.run('approve', 'feature', 'mockups', '--user-approved');
  w.write(prefix + 'implementation-plan.md', '# Plan\nThe feature has three phases.');
  w.run('record', 'feature', 'planning', prefix + 'implementation-plan.md');
}
function plan(w) {
  bootstrap(w);
  w.write(prefix + 'tasks.json', JSON.stringify([
    { id: 'T01', phase: 'P01', title: 'Define contracts', depends_on: [], acceptance: ['The contract test passes.'] },
    { id: 'T02', phase: 'P02', title: 'Build service', depends_on: ['T01'], acceptance: ['Service integration test passes.'] },
    { id: 'T03', phase: 'P03', title: 'Build UI', depends_on: ['T02'], acceptance: ['The UI shows both supported themes.'] }
  ]));
  for (const id of ['P01', 'P02', 'P03']) w.write(`${prefix}phases/${id}.md`, `# ${id}\nThe agent implements this phase and runs tests.`);
  w.write(prefix + 'phase-manifest.json', JSON.stringify({ schemaVersion: 1, phases: [
    { id: 'P01', title: 'Contracts', file: prefix + 'phases/P01.md', tasks: ['T01'], depends_on: [] },
    { id: 'P02', title: 'Service', file: prefix + 'phases/P02.md', tasks: ['T02'], depends_on: ['P01'] },
    { id: 'P03', title: 'User interface', file: prefix + 'phases/P03.md', tasks: ['T03'], depends_on: ['P02'] }
  ] }));
  w.run('import-tasks', 'feature', prefix + 'tasks.json');
  w.run('import-phases', 'feature', prefix + 'phase-manifest.json');
  w.run('approve', 'feature', 'planning', '--user-approved');
}
function finishTask(w, task) {
  w.run('task', 'feature', task, 'in_progress');
  w.run('task', 'feature', task, 'done', '--evidence', `Verified ${task}: test passed`);
}

test('requires real stage artifacts and explicit approval attestation', t => {
  const w = setup(t);
  w.run('init', 'feature');
  assert.notEqual(w.bad('approve', 'feature', 'architecture', '--user-approved').status, 0);
  w.write(prefix + 'architecture.md', '# Draft');
  w.run('record', 'feature', 'architecture', prefix + 'architecture.md');
  assert.notEqual(w.bad('approve', 'feature', 'architecture').status, 0);
  w.run('approve', 'feature', 'architecture', '--user-approved');
  assert.equal(w.state().stage, 'mockups');
});

test('does not approve a plan without phase manifest and documents', t => {
  const w = setup(t);
  bootstrap(w);
  assert.notEqual(w.bad('approve', 'feature', 'planning', '--user-approved').status, 0);
});

test('phase mode stops at each completed phase and resumes on next continue', t => {
  const w = setup(t);
  plan(w);
  assert.equal(w.state().execution.mode, 'phase');
  assert.equal(w.next().status, 'awaiting_phase_start');
  assert.equal(w.next().phase, 'P01');
  assert.notEqual(w.bad('task', 'feature', 'T01', 'in_progress').status, 0);
  assert.notEqual(w.bad('start-phase', 'feature', 'P02').status, 0);
  w.run('start-phase', 'feature', 'P01');
  assert.equal(w.next().task.id, 'T01');
  assert.notEqual(w.bad('task', 'feature', 'T02', 'done', '--evidence', 'test passed').status, 0);
  finishTask(w, 'T01');
  assert.equal(w.next().status, 'phase_complete');
  assert.equal(w.next().phase, 'P01');
  w.write(prefix + 'phases/P01-handoff.md', 'The contract tests passed. This phase is complete.');
  w.run('start-phase', 'feature', 'P02');
  assert.equal(w.next().task.id, 'T02');
  finishTask(w, 'T02');
  assert.equal(w.next().status, 'phase_complete');
  w.run('start-phase', 'feature', 'P03');
  finishTask(w, 'T03');
  assert.equal(w.next().status, 'all_tasks_done');
  w.run('complete', 'feature');
  assert.equal(w.state().stage, 'completed');
});

test('all mode keeps working through every ready phase', t => {
  const w = setup(t);
  plan(w);
  w.run('mode', 'feature', 'all');
  for (const id of ['T01', 'T02', 'T03']) {
    assert.equal(w.next().task.id, id);
    finishTask(w, id);
  }
  assert.equal(w.next().status, 'all_tasks_done');
  w.run('complete', 'feature');
});

test('task mode returns one safe task per turn', t => {
  const w = setup(t);
  plan(w);
  w.run('mode', 'feature', 'task');
  assert.equal(w.next().mode, 'task');
  assert.equal(w.next().task.id, 'T01');
  finishTask(w, 'T01');
  assert.equal(w.next().task.id, 'T02');
});

test('resuming in another process preserves task status and phase', t => {
  const w = setup(t);
  plan(w);
  w.run('start-phase', 'feature', 'P01');
  finishTask(w, 'T01');
  assert.equal(w.next().status, 'phase_complete');
  assert.equal(w.state().tasks[0].evidence, 'Verified T01: test passed');
  w.run('start-phase', 'feature', 'P02');
  assert.equal(w.next().task.id, 'T02');
});

test('changing any approved phase document invalidates execution', t => {
  const w = setup(t);
  plan(w);
  w.write(prefix + 'phases/P02.md', '# Changed plan');
  const attempt = w.bad('next', 'feature');
  assert.notEqual(attempt.status, 0);
  assert.match(attempt.stderr, /Phase document P02 changed/);
});

test('handoff and progress files may change without invalidating plan', t => {
  const w = setup(t);
  plan(w);
  w.write(prefix + 'progress.md', 'The agent completed task T01.');
  w.write(prefix + 'phases/P01-handoff.md', 'The agent verified the contract.');
  assert.equal(w.next().status, 'awaiting_phase_start');
});

test('reopening planning clears phased execution state but retains previous approvals', t => {
  const w = setup(t);
  plan(w);
  w.run('start-phase', 'feature', 'P01');
  finishTask(w, 'T01');
  w.run('reopen', 'feature', 'planning', '--reason', 'Change phase tasks');
  const s = w.state();
  assert.equal(s.stage, 'planning');
  assert.equal(s.phases.length, 0);
  assert.equal(s.tasks.length, 0);
  assert.equal(s.execution.activePhaseId, null);
  assert.ok(s.approvals.architecture);
  assert.ok(s.approvals.mockups);
});

test('invalid manifests and task mappings are rejected', t => {
  const w = setup(t);
  bootstrap(w);
  w.write(prefix + 'tasks.json', JSON.stringify([{ id: 'T01', phase: 'P01', title: 'Task', depends_on: [], acceptance: ['Test passes.'] }]));
  w.run('import-tasks', 'feature', prefix + 'tasks.json');
  w.write(prefix + 'phases/P01.md', 'The agent completes this task.');
  w.write(prefix + 'phase-manifest.json', JSON.stringify({ phases: [{ id: 'P01', title: 'Plan', file: prefix + 'phases/P01.md', tasks: ['UNKNOWN'], depends_on: [] }] }));
  assert.notEqual(w.bad('import-phases', 'feature', prefix + 'phase-manifest.json').status, 0);
});

test('rejects path escapes, invalid slugs and unverified task completion', t => {
  const w = setup(t);
  assert.notEqual(w.bad('init', '../escape').status, 0);
  plan(w);
  assert.notEqual(w.bad('complete', 'feature').status, 0);
  w.run('start-phase', 'feature', 'P01');
  assert.notEqual(w.bad('task', 'feature', 'T01', 'done').status, 0);
});

const gitWorks = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;

test('init adds one .plans gitignore entry', t => {
  const w = setup(t);
  fs.writeFileSync(path.join(w.root, '.gitignore'), 'node_modules/\n');
  w.run('init', 'feature');
  const ignore = fs.readFileSync(path.join(w.root, '.gitignore'), 'utf8');
  assert.equal(ignore.split('\n').filter(line => line.trim() === '.plans/').length, 1);
  assert.match(ignore, /node_modules/);
  w.run('init', 'other-feature');
  const again = fs.readFileSync(path.join(w.root, '.gitignore'), 'utf8');
  assert.equal(again.split('\n').filter(line => line.trim() === '.plans/').length, 1);
});

test('init untracks an indexed .plans directory', { skip: !gitWorks }, t => {
  const w = setup(t);
  execFileSync('git', ['init'], { cwd: w.root });
  const tracked = path.join(w.root, '.plans', 'feature', 'notes.md');
  fs.mkdirSync(path.dirname(tracked), { recursive: true });
  fs.writeFileSync(tracked, 'Keep this file on disk.');
  execFileSync('git', ['add', '--', '.plans'], { cwd: w.root });
  w.run('init', 'feature');
  assert.equal(execFileSync('git', ['ls-files', '--', '.plans'], { cwd: w.root, encoding: 'utf8' }), '');
  assert.equal(fs.readFileSync(tracked, 'utf8'), 'Keep this file on disk.');
});

test('ready tasks with disjoint files form a parallel batch', t => {
  const w = setup(t);
  bootstrap(w);
  const tasks = [
    { id: 'T01', phase: 'P01', title: 'Contracts', depends_on: [], acceptance: ['Contract tests pass.'], files: ['src/feature/contracts.ts'] },
    { id: 'T02', phase: 'P01', title: 'Telemetry', depends_on: [], acceptance: ['Telemetry tests pass.'], files: ['src/feature/telemetry.ts'] },
    { id: 'T03', phase: 'P01', title: 'Shared edit', depends_on: [], acceptance: ['Types compile.'], files: ['src/feature/contracts.ts'] },
    { id: 'T04', phase: 'P01', title: 'Unknown scope', depends_on: [], acceptance: ['The check passes.'] },
    { id: 'T05', phase: 'P01', title: 'Directory edit', depends_on: [], acceptance: ['The directory builds.'], files: ['src/feature'] }
  ];
  w.write(prefix + 'tasks.json', JSON.stringify(tasks));
  w.write(prefix + 'phases/P01.md', '# P01\nThe agent implements this phase and runs tests.');
  w.write(prefix + 'phase-manifest.json', JSON.stringify({ schemaVersion: 1, phases: [
    { id: 'P01', title: 'Foundation', file: prefix + 'phases/P01.md', tasks: tasks.map(task => task.id), depends_on: [] }
  ] }));
  w.run('import-tasks', 'feature', prefix + 'tasks.json');
  w.run('import-phases', 'feature', prefix + 'phase-manifest.json');
  w.run('approve', 'feature', 'planning', '--user-approved');
  w.run('mode', 'feature', 'task');
  assert.deepEqual(w.next().parallel, []);
  w.run('mode', 'feature', 'all');
  const batch = w.next();
  assert.equal(batch.task.id, 'T01');
  assert.deepEqual(batch.parallel.map(task => task.id), ['T02']);
  w.run('mode', 'feature', 'phase');
  w.run('start-phase', 'feature', 'P01');
  const phaseBatch = w.next();
  assert.deepEqual([phaseBatch.task.id, ...phaseBatch.parallel.map(task => task.id)], ['T01', 'T02']);
});

test('a parallel batch stops at four tasks', t => {
  const w = setup(t);
  bootstrap(w);
  const tasks = ['T01', 'T02', 'T03', 'T04', 'T05'].map(id => ({
    id, phase: 'P01', title: id, depends_on: [], acceptance: ['The check passes.'], files: [`src/${id}.ts`]
  }));
  w.write(prefix + 'tasks.json', JSON.stringify(tasks));
  w.write(prefix + 'phases/P01.md', '# P01\nThe agent implements this phase and runs tests.');
  w.write(prefix + 'phase-manifest.json', JSON.stringify({ schemaVersion: 1, phases: [
    { id: 'P01', title: 'Foundation', file: prefix + 'phases/P01.md', tasks: tasks.map(task => task.id), depends_on: [] }
  ] }));
  w.run('import-tasks', 'feature', prefix + 'tasks.json');
  w.run('import-phases', 'feature', prefix + 'phase-manifest.json');
  w.run('approve', 'feature', 'planning', '--user-approved');
  w.run('mode', 'feature', 'all');
  const batch = w.next();
  assert.deepEqual([batch.task.id, ...batch.parallel.map(task => task.id)], ['T01', 'T02', 'T03', 'T04']);
});

test('rejects task file paths that leave the repository', t => {
  const w = setup(t);
  bootstrap(w);
  w.write(prefix + 'tasks.json', JSON.stringify([
    { id: 'T01', phase: 'P01', title: 'Contracts', depends_on: [], acceptance: ['Contract tests pass.'], files: ['../secrets.txt'] }
  ]));
  assert.notEqual(w.bad('import-tasks', 'feature', prefix + 'tasks.json').status, 0);
});

test('skipped mockups go straight from architecture to planning', t => {
  const w = setup(t);
  w.run('init', 'feature', '--skip', 'mockups,qa-review', '--parallel', '2');
  assert.deepEqual(w.state().scope, { skip: ['mockups', 'qa-review'], parallel: 2 });
  w.write(prefix + 'architecture.md', '# Design\nThe app displays the feature.');
  w.run('record', 'feature', 'architecture', prefix + 'architecture.md');
  w.run('approve', 'feature', 'architecture', '--user-approved');
  assert.equal(w.state().stage, 'planning');
  w.write(prefix + 'implementation-plan.md', '# Plan\nThe feature has one phase.');
  w.run('record', 'feature', 'planning', prefix + 'implementation-plan.md');
  const tasks = ['T01', 'T02', 'T03'].map(id => ({ id, phase: 'P01', title: id, depends_on: [], acceptance: ['The check passes.'], files: [`src/${id}.ts`] }));
  w.write(prefix + 'tasks.json', JSON.stringify(tasks));
  w.write(prefix + 'phases/P01.md', '# P01\nThe agent implements this phase.');
  w.write(prefix + 'phase-manifest.json', JSON.stringify({ schemaVersion: 1, phases: [
    { id: 'P01', title: 'Only', file: prefix + 'phases/P01.md', tasks: tasks.map(task => task.id), depends_on: [] }
  ] }));
  w.run('import-tasks', 'feature', prefix + 'tasks.json');
  w.run('import-phases', 'feature', prefix + 'phase-manifest.json');
  w.run('approve', 'feature', 'planning', '--user-approved');
  w.run('mode', 'feature', 'all');
  const batch = w.next();
  assert.deepEqual([batch.task.id, ...batch.parallel.map(task => task.id)], ['T01', 'T02']);
});

test('skipping both design gates starts at planning and the plan gate stays', t => {
  const w = setup(t);
  w.run('init', 'feature', '--skip', 'architecture,mockups,research');
  assert.equal(w.state().stage, 'planning');
  assert.notEqual(w.bad('init', 'other', '--skip', 'planning').status, 0);
  assert.notEqual(w.bad('reopen', 'feature', 'architecture').status, 0);
});

test('turning a skipped gate back on reopens it and resets planning', t => {
  const w = setup(t);
  w.run('init', 'feature', '--skip', 'mockups');
  w.write(prefix + 'architecture.md', '# Design\nThe app displays the feature.');
  w.run('record', 'feature', 'architecture', prefix + 'architecture.md');
  w.run('approve', 'feature', 'architecture', '--user-approved');
  w.write(prefix + 'implementation-plan.md', '# Plan\nThe plan.');
  w.run('record', 'feature', 'planning', prefix + 'implementation-plan.md');
  w.run('scope', 'feature', '--skip', 'none');
  const s = w.state();
  assert.equal(s.stage, 'mockups');
  assert.ok(s.approvals.architecture);
  assert.equal(s.artifacts.planning, null);
  w.run('scope', 'feature', '--skip', 'mockups');
  assert.equal(w.state().stage, 'planning');
});

test('rejects invalid scope values and scope changes after plan approval', t => {
  const w = setup(t);
  assert.notEqual(w.bad('init', 'feature', '--parallel', '0').status, 0);
  assert.notEqual(w.bad('init', 'feature', '--skip', 'unknown-step').status, 0);
  plan(w);
  assert.notEqual(w.bad('scope', 'feature', '--parallel', '2').status, 0);
});

test('blocked tasks need a reason', t => {
  const w = setup(t);
  plan(w);
  w.run('start-phase', 'feature', 'P01');
  w.run('task', 'feature', 'T01', 'in_progress');
  assert.notEqual(w.bad('task', 'feature', 'T01', 'blocked').status, 0);
  w.run('task', 'feature', 'T01', 'blocked', '--reason', 'Three fixes failed. Options: A or B.');
  assert.equal(w.state().tasks[0].blockedReason, 'Three fixes failed. Options: A or B.');
});

test('reopening architecture revokes all downstream approvals', t => {
  const w = setup(t);
  plan(w);
  w.run('reopen', 'feature', 'architecture', '--reason', 'Updated boundary');
  assert.equal(w.state().stage, 'architecture');
  assert.deepEqual(w.state().approvals, { architecture: null, mockups: null, planning: null });
});
