#!/usr/bin/env node
/**
 * File-backed review gate, phased implementation and resumable task tracker.
 * Node.js >= 18, no dependencies. The host agent performs the actual work.
 * --user-approved is an attestation, not independent proof of user consent.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const STAGES = ['architecture', 'mockups', 'planning', 'implementation', 'completed'];
const PARALLEL_LIMIT = 4;
const MAX_PARALLEL = 8;
const PLANS_DIR = '.plans';
const SKIPPABLE = new Set(['research', 'architecture', 'mockups', 'diagrams', 'writing-review', 'qa-review', 'new-tests', 'parallel-subagents', 'lessons']);
const SKIPPABLE_GATES = new Set(['architecture', 'mockups']);
const ARTIFACT_STAGE = { research: 'architecture', architecture: 'architecture', mockups: 'mockups', planning: 'planning', implementation: 'implementation' };
const REVIEW_STAGES = ['architecture', 'mockups', 'planning'];
const STATUSES = new Set(['pending', 'in_progress', 'blocked', 'done']);
const MODES = new Set(['all', 'phase', 'task']);
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

function fail(message) { throw new Error(message); }
function required(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`Missing ${label}`); return value; }
function args(argv) {
  const positionals = [], options = {};
  const hasValue = new Set(['root', 'title', 'evidence', 'reason', 'skip', 'parallel']);
  for (let i = 0; i < argv.length; i++) {
    const part = argv[i];
    if (!part.startsWith('--')) { positionals.push(part); continue; }
    const key = part.slice(2);
    if (hasValue.has(key)) options[key] = required(argv[++i], `--${key} value`);
    else if (key === 'user-approved') options[key] = true;
    else fail(`Unknown flag: ${part}`);
  }
  return { positionals, options };
}
function getPaths(slug, options) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(required(slug, 'feature slug'))) fail('Use a kebab-case feature slug.');
  const root = path.resolve(options.root || process.cwd());
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) fail(`Repository directory does not exist: ${root}`);
  const base = path.join(root, PLANS_DIR, slug);
  return { root, base, stateFile: path.join(base, 'state.json') };
}
function safeFile(paths, relativePath) {
  const abs = path.resolve(paths.root, required(relativePath, 'file path'));
  const rel = path.relative(paths.root, abs);
  if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) fail('File must be inside the repository.');
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) fail(`File is missing: ${abs}`);
  const actual = fs.realpathSync(abs), actualRoot = fs.realpathSync(paths.root);
  const actualRel = path.relative(actualRoot, actual);
  if (!actualRel || actualRel === '..' || actualRel.startsWith('..' + path.sep) || path.isAbsolute(actualRel)) fail('Symlink escapes repository.');
  return { abs, rel: rel.split(path.sep).join('/') };
}
function sha(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function bundleSha(dir) {
  const h = crypto.createHash('sha256');
  function walk(folder) {
    const entries = fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const absolute = path.join(folder, e.name);
      if (e.isSymbolicLink()) fail('Mockup bundle cannot contain symlinks.');
      if (e.isDirectory()) walk(absolute);
      else if (e.isFile()) { h.update(path.relative(dir, absolute)); h.update('\0'); h.update(fs.readFileSync(absolute)); }
    }
  }
  walk(dir);
  return h.digest('hex');
}
function load(paths) {
  if (!fs.existsSync(paths.stateFile)) fail('Feature is not initialized. Run init first.');
  const state = JSON.parse(fs.readFileSync(paths.stateFile, 'utf8'));
  if (state.schemaVersion !== 2) fail('Unsupported state version. See migration instructions in the README.');
  return state;
}
function save(paths, state) {
  state.updatedAt = new Date().toISOString();
  fs.mkdirSync(paths.base, { recursive: true });
  const tmp = `${paths.stateFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  try { fs.renameSync(tmp, paths.stateFile); }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
function event(state, type, detail = {}) { state.events.push({ type, timestamp: new Date().toISOString(), ...detail }); }
function fileRecord(paths, relativePath, extra = {}) {
  const f = safeFile(paths, relativePath);
  return { file: f.rel, sha256: sha(f.abs), ...extra };
}
function assertFileRecord(paths, record, name) {
  if (!record) fail(`Missing ${name}.`);
  const f = safeFile(paths, record.file);
  if (sha(f.abs) !== record.sha256) fail(`${name} changed since approval. Reopen planning or the affected review stage.`);
  return f;
}
function verifyArtifact(paths, state, kind) {
  const record = state.artifacts[kind];
  const f = assertFileRecord(paths, record, `${kind} artifact`);
  if (kind === 'mockups' && bundleSha(path.dirname(f.abs)) !== record.bundleSha256) fail('Mockups changed since approval. Reopen mockups.');
}
function validateTasks(raw) {
  if (!Array.isArray(raw) || raw.length === 0) fail('tasks.json must be a nonempty array.');
  const ids = new Set();
  const tasks = raw.map(t => {
    if (!t || typeof t !== 'object' || Array.isArray(t)) fail('Invalid task entry.');
    if (!ID.test(required(t.id, 'task ID')) || ids.has(t.id)) fail(`Invalid or duplicate task ID: ${t.id}`);
    ids.add(t.id);
    if (!Array.isArray(t.depends_on) || !t.depends_on.every(d => typeof d === 'string')) fail(`Invalid dependencies for ${t.id}.`);
    if (!Array.isArray(t.acceptance) || !t.acceptance.length || !t.acceptance.every(a => typeof a === 'string' && a.trim())) fail(`Task ${t.id} needs verifiable acceptance criteria.`);
    if (t.files !== undefined && (!Array.isArray(t.files) || (t.files.length > 0 && !taskFiles(t)))) fail(`Task ${t.id} files must be repository paths.`);
    if (!ID.test(required(t.phase, `phase of ${t.id}`))) fail(`Task ${t.id} needs a valid phase ID.`);
    return { ...t, title: required(t.title, `title of ${t.id}`), status: 'pending', evidence: null };
  });
  const byId = new Map(tasks.map(t => [t.id, t]));
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) fail('Task dependency cycle found.');
    visiting.add(id);
    for (const d of byId.get(id).depends_on) {
      if (!byId.has(d) || d === id) fail(`Invalid task dependency ${id} -> ${d}.`);
      visit(d);
    }
    visiting.delete(id); visited.add(id);
  }
  tasks.forEach(t => visit(t.id));
  return tasks;
}
function validatePhaseManifest(paths, raw, tasks) {
  if (!raw || !Array.isArray(raw.phases) || !raw.phases.length) fail('phase-manifest.json requires a nonempty phases array.');
  const phases = [], phaseIds = new Set(), taskOwners = new Map();
  const taskById = new Map(tasks.map(t => [t.id, t]));
  for (const p of raw.phases) {
    if (!p || !ID.test(required(p.id, 'phase ID')) || phaseIds.has(p.id)) fail(`Invalid or duplicate phase: ${p?.id}`);
    phaseIds.add(p.id);
    if (!Array.isArray(p.tasks) || !p.tasks.length) fail(`${p.id} needs at least one task.`);
    if (!Array.isArray(p.depends_on) || !p.depends_on.every(x => typeof x === 'string')) fail(`${p.id} needs a depends_on array.`);
    const file = safeFile(paths, p.file);
    const expectedDir = path.join(paths.base, 'phases');
    const subPath = path.relative(expectedDir, file.abs);
    if (!subPath || subPath === '..' || subPath.startsWith('..' + path.sep) || path.isAbsolute(subPath)) fail(`Phase file must be under .plans/<slug>/phases/: ${p.id}`);
    for (const id of p.tasks) {
      if (!taskById.has(id) || taskOwners.has(id) || taskById.get(id).phase !== p.id) fail(`Incorrect or duplicate task ${id} in ${p.id}.`);
      taskOwners.set(id, p.id);
    }
    phases.push({ id: p.id, title: required(p.title, `phase title ${p.id}`), file: file.rel, sha256: sha(file.abs), tasks: [...p.tasks], depends_on: [...p.depends_on] });
  }
  if (taskOwners.size !== tasks.length) fail('Every task must appear in exactly one matching phase.');
  const phaseById = new Map(phases.map(p => [p.id, p]));
  const visiting = new Set(), visited = new Set();
  function visitPhase(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) fail('Phase dependency cycle found.');
    visiting.add(id);
    for (const dep of phaseById.get(id).depends_on) {
      if (!phaseById.has(dep) || dep === id) fail(`Invalid phase dependency ${id} -> ${dep}.`);
      visitPhase(dep);
    }
    visiting.delete(id); visited.add(id);
  }
  phases.forEach(p => visitPhase(p.id));
  function dependsOn(phase, expected, seen = new Set()) {
    if (seen.has(phase)) return false;
    seen.add(phase);
    return phaseById.get(phase).depends_on.some(d => d === expected || dependsOn(d, expected, seen));
  }
  for (const t of tasks) for (const d of t.depends_on) {
    const other = taskById.get(d);
    if (other.phase !== t.phase && !dependsOn(t.phase, other.phase)) fail(`${t.id} depends on ${d}, but phase ${t.phase} does not depend on ${other.phase}.`);
  }
  return phases;
}
function checkPlan(paths, state) {
  assertFileRecord(paths, state.taskSource, 'Imported tasks.json');
  assertFileRecord(paths, state.phaseSource, 'Phase manifest');
  if (!state.phases.length) fail('No imported phase plans.');
  for (const p of state.phases) assertFileRecord(paths, p, `Phase document ${p.id}`);
}
function scopeOf(state) {
  return { skip: state.scope?.skip ?? [], parallel: state.scope?.parallel ?? PARALLEL_LIMIT };
}
function isSkipped(state, stage) {
  return SKIPPABLE_GATES.has(stage) && scopeOf(state).skip.includes(stage);
}
function stageAfter(state, stage) {
  return STAGES.slice(STAGES.indexOf(stage) + 1).find(s => !isSkipped(state, s));
}
function resetFrom(state, stage) {
  const at = STAGES.indexOf(stage);
  for (const label of REVIEW_STAGES) if (STAGES.indexOf(label) >= at) { state.approvals[label] = null; state.artifacts[label] = null; }
  state.artifacts.implementation = null;
  state.taskSource = null; state.phaseSource = null; state.phases = []; state.tasks = [];
  state.execution.activePhaseId = null;
}
function parseSkip(value) {
  if (value.trim() === 'none') return [];
  const items = [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
  for (const item of items) if (!SKIPPABLE.has(item)) fail(`Cannot skip ${item}. Skippable steps: ${[...SKIPPABLE].join(', ')}.`);
  return items;
}
function parseParallel(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARALLEL) fail(`--parallel must be a whole number from 1 to ${MAX_PARALLEL}.`);
  return n;
}
function verifyApproved(paths, state) {
  REVIEW_STAGES.filter(stage => !isSkipped(state, stage)).forEach(stage => {
    if (!state.approvals[stage]) fail(`No user approval for ${stage}.`);
    verifyArtifact(paths, state, stage);
  });
  checkPlan(paths, state);
}
function done(state, phaseId) {
  const phase = state.phases.find(p => p.id === phaseId);
  return phase.tasks.every(id => state.tasks.find(t => t.id === id)?.status === 'done');
}
function phaseReady(state, p) { return p.depends_on.every(dep => done(state, dep)); }
function readyTasks(state, phaseId) {
  const p = state.phases.find(x => x.id === phaseId);
  return p.tasks.map(id => state.tasks.find(t => t.id === id)).filter(t =>
    ['pending', 'in_progress'].includes(t.status) && t.depends_on.every(dep => state.tasks.find(x => x.id === dep)?.status === 'done'));
}
function taskFiles(task) {
  if (!task || !Array.isArray(task.files) || !task.files.length) return null;
  const files = [];
  for (const file of task.files) {
    if (typeof file !== 'string' || !file.trim()) return null;
    const normalized = file.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
    if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) return null;
    files.push(normalized);
  }
  return files;
}
function filesOverlap(left, right) {
  for (const a of left) for (const b of right) {
    if (a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)) return true;
  }
  return false;
}
function parallelBatch(state, tasks) {
  const scope = scopeOf(state);
  const limit = scope.skip.includes('parallel-subagents') ? 1 : scope.parallel;
  const active = tasks.filter(task => task.status === 'in_progress');
  const pool = active.length ? active : tasks;
  if (active.some(task => !taskFiles(task))) return [active[0]];
  const chosen = [];
  const chosenFiles = [];
  for (const task of pool) {
    const files = taskFiles(task);
    if (!files) {
      if (!chosen.length) return [task];
      continue;
    }
    if (chosenFiles.some(existing => filesOverlap(existing, files))) continue;
    chosen.push(task);
    chosenFiles.push(files);
    if (chosen.length === limit) break;
  }
  return chosen;
}
function readyResult(state, batch) {
  const mode = state.execution.mode;
  const parallel = mode === 'task' ? [] : batch.slice(1);
  const result = { status: 'ready', mode, phase: batch[0].phase, task: batch[0], parallel };
  if (mode === 'task') result.message = 'Stop after verifying this one task.';
  else if (parallel.length) result.message = 'These tasks do not overlap. Run them in parallel with subagents when the host supports that, then verify and record each result from the parent session.';
  else if (mode === 'all') result.message = 'Continue through all ready tasks.';
  return result;
}
function plansIgnored(text) {
  return text.split(/\r?\n/).some(line => {
    const pattern = line.trim().replace(/\\/g, '/');
    if (!pattern || pattern.startsWith('#') || pattern.startsWith('!')) return false;
    return ['.plans', '.plans/', '/.plans', '/.plans/', '.plans/**', '/.plans/**', '**/.plans', '**/.plans/', '**/.plans/**'].includes(pattern);
  });
}
function git(root, args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' });
}
function ensurePlansUntracked(root) {
  const ignoreFile = path.join(root, '.gitignore');
  const current = fs.existsSync(ignoreFile) ? fs.readFileSync(ignoreFile, 'utf8') : '';
  if (!plansIgnored(current)) {
    const base = current.length === 0 ? '' : current.endsWith('\n') ? current : `${current}\n`;
    const spacer = base.length === 0 || base.endsWith('\n\n') ? '' : '\n';
    fs.writeFileSync(ignoreFile, `${base}${spacer}# Local feature plans. Do not commit.\n.plans/\n`);
  }
  const inside = git(root, ['rev-parse', '--is-inside-work-tree']);
  if (inside.status !== 0 || inside.stdout.trim() !== 'true') return;
  const listed = git(root, ['ls-files', '--', PLANS_DIR]);
  if (listed.status !== 0 || !listed.stdout.trim()) return;
  const removed = git(root, ['rm', '-r', '--cached', '-q', '--', PLANS_DIR]);
  if (removed.status !== 0) fail(`Could not stop tracking .plans: ${removed.stderr.trim()}`);
}
function next(state) {
  if (state.tasks.every(t => t.status === 'done')) return { status: 'all_tasks_done', message: 'Run final regression and review before marking complete.' };
  const mode = state.execution.mode;
  if (mode === 'phase') {
    const id = state.execution.activePhaseId;
    if (id) {
      if (done(state, id)) {
        return { status: 'phase_complete', phase: id, message: 'Write the phase handoff and stop. A later continue may start the next eligible phase.' };
      }
      const ready = readyTasks(state, id);
      if (!ready.length) return { status: 'blocked', phase: id, message: 'No unblocked tasks in the selected phase.' };
      return readyResult(state, parallelBatch(state, ready));
    }
    const p = state.phases.find(p => !done(state, p.id) && phaseReady(state, p));
    return p ? { status: 'awaiting_phase_start', phase: p.id, title: p.title, message: 'Start this phase, then call next.' } : { status: 'blocked', message: 'No phase has satisfied dependencies.' };
  }
  const ready = [];
  for (const p of state.phases) {
    if (!phaseReady(state, p)) continue;
    ready.push(...readyTasks(state, p.id));
  }
  if (!ready.length) return { status: 'blocked', message: 'No unblocked tasks. Inspect task status and dependencies.' };
  return readyResult(state, parallelBatch(state, ready));
}
function help() {
  return `Feature Architect CLI. Node.js 18+ and no dependencies.
Usage: node scripts/workflow.mjs COMMAND SLUG ... --root REPOSITORY
  init SLUG --title "Feature" [--skip a,b] [--parallel N]
                                              Create state in .plans/SLUG/ and ignore that folder in git
  show SLUG                                   Print saved state and progress
  scope SLUG [--skip a,b|none] [--parallel N]  Save skipped steps and parallel limit before plan approval
  record SLUG architecture|mockups|planning FILE
  approve SLUG architecture|mockups|planning --user-approved
  import-tasks SLUG FILE                      Register global tasks.json during planning
  import-phases SLUG FILE                     Register phase-manifest.json and phase documents
  reopen SLUG architecture|mockups|planning --reason "Reason"
  mode SLUG all|phase|task                     Choose full, phase-at-a-time or task-at-a-time
  next SLUG                                   Suggest the next safe action, including disjoint parallel tasks
  start-phase SLUG P01                        Start/resume a dependency-ready phase
  task SLUG T01 in_progress|blocked|pending|done [--evidence "Verification"] [--reason "Why blocked"]
  complete SLUG                               Finish after all verified tasks
Human-facing work is performed by the host agent, not this tracker.
The --user-approved flag does not independently verify approval.`;
}
function main() {
  const { positionals, options } = args(process.argv.slice(2));
  const [command, slug, ...rest] = positionals;
  if (!command || command === 'help' || command === '--help') { console.log(help()); return; }
  const paths = getPaths(slug, options);
  if (command === 'init') {
    ensurePlansUntracked(paths.root);
    if (fs.existsSync(paths.stateFile)) fail('Already initialized. Use show or next.');
    const now = new Date().toISOString();
    const scope = { skip: options.skip ? parseSkip(options.skip) : [], parallel: options.parallel ? parseParallel(options.parallel) : PARALLEL_LIMIT };
    const s = { schemaVersion: 2, slug, title: options.title || slug, stage: 'architecture', createdAt: now, updatedAt: now,
      approvals: { architecture: null, mockups: null, planning: null },
      artifacts: { research: null, architecture: null, mockups: null, planning: null, implementation: null },
      taskSource: null, phaseSource: null, phases: [], tasks: [], execution: { mode: 'phase', activePhaseId: null }, scope, events: [] };
    s.stage = REVIEW_STAGES.find(stage => !isSkipped(s, stage));
    event(s, 'init', { scope });
    const dirs = isSkipped(s, 'mockups') ? ['phases'] : ['mockups', 'phases'];
    for (const dir of dirs) fs.mkdirSync(path.join(paths.base, dir), { recursive: true });
    save(paths, s);
    console.log(`Initialized: ${paths.base}`);
    return;
  }
  const state = load(paths);
  if (command === 'show') { console.log(JSON.stringify(state, null, 2)); return; }
  if (command === 'next') {
    if (state.stage !== 'implementation') fail(`Cannot select implementation tasks while stage is ${state.stage}.`);
    verifyApproved(paths, state);
    console.log(JSON.stringify(next(state), null, 2));
    return;
  }
  if (command === 'scope') {
    if (!REVIEW_STAGES.includes(state.stage)) fail('Change scope only before the implementation plan is approved.');
    if (options.skip === undefined && options.parallel === undefined) fail('Pass --skip and/or --parallel.');
    const current = scopeOf(state);
    state.scope = {
      skip: options.skip === undefined ? current.skip : parseSkip(options.skip),
      parallel: options.parallel === undefined ? current.parallel : parseParallel(options.parallel)
    };
    for (const stage of SKIPPABLE_GATES) if (isSkipped(state, stage)) { state.approvals[stage] = null; state.artifacts[stage] = null; }
    const target = REVIEW_STAGES.find(stage => !isSkipped(state, stage) && !state.approvals[stage]);
    if (STAGES.indexOf(target) < STAGES.indexOf(state.stage)) resetFrom(state, target);
    state.stage = target;
    event(state, 'scope', { scope: state.scope });
  } else if (command === 'record') {
    const [kind, file] = rest;
    if (ARTIFACT_STAGE[kind] !== state.stage) fail(`Cannot record ${kind} while stage is ${state.stage}.`);
    const rec = fileRecord(paths, file);
    if (kind === 'mockups') {
      if (path.basename(rec.file) !== 'README.md') fail('Record mockups/README.md to track the preview bundle.');
      const p = safeFile(paths, file);
      rec.bundleSha256 = bundleSha(path.dirname(p.abs));
    }
    state.artifacts[kind] = rec;
    event(state, 'record', { kind, file: rec.file });
  } else if (command === 'import-tasks') {
    if (state.stage !== 'planning') fail('Import tasks only during planning.');
    const f = safeFile(paths, rest[0]);
    state.tasks = validateTasks(JSON.parse(fs.readFileSync(f.abs, 'utf8')));
    state.taskSource = fileRecord(paths, f.rel);
    state.phaseSource = null; state.phases = [];
    event(state, 'import-tasks', { count: state.tasks.length });
  } else if (command === 'import-phases') {
    if (state.stage !== 'planning') fail('Import phases only during planning.');
    if (!state.tasks.length) fail('Import tasks.json before phase-manifest.json.');
    const f = safeFile(paths, rest[0]);
    const raw = JSON.parse(fs.readFileSync(f.abs, 'utf8'));
    state.phases = validatePhaseManifest(paths, raw, state.tasks);
    state.phaseSource = fileRecord(paths, f.rel);
    event(state, 'import-phases', { phases: state.phases.map(p => p.id) });
  } else if (command === 'approve') {
    const stage = rest[0];
    if (state.stage !== stage || !REVIEW_STAGES.includes(stage)) fail(`Can approve only the current review stage: ${state.stage}.`);
    if (!options['user-approved']) fail('Explicit user approval is required before --user-approved.');
    verifyArtifact(paths, state, stage);
    if (stage === 'planning') {
      if (!state.tasks.length) fail('Missing tasks.json.');
      checkPlan(paths, state);
    }
    state.approvals[stage] = { approvedAt: new Date().toISOString(), origin: 'user-approved attestation', sha256: state.artifacts[stage].sha256 };
    state.stage = stageAfter(state, stage);
    event(state, 'approve', { stage });
  } else if (command === 'reopen') {
    const stage = rest[0];
    const at = STAGES.indexOf(stage);
    if (!REVIEW_STAGES.includes(stage) || at > STAGES.indexOf(state.stage)) fail(`Cannot reopen ${stage} from ${state.stage}.`);
    if (isSkipped(state, stage)) fail(`${stage} is skipped. Use scope --skip to include it again.`);
    state.stage = stage;
    resetFrom(state, stage);
    event(state, 'reopen', { stage, reason: options.reason || 'User requested refinement.' });
  } else if (command === 'mode') {
    if (state.stage !== 'implementation') fail('Execution mode can change only after plan approval.');
    verifyApproved(paths, state);
    const mode = rest[0];
    if (!MODES.has(mode)) fail('Mode must be all, phase, or task.');
    state.execution.mode = mode;
    if (mode !== 'phase') state.execution.activePhaseId = null;
    event(state, 'mode', { mode });
  } else if (command === 'start-phase') {
    if (state.stage !== 'implementation') fail('A phase can start only after plan approval.');
    verifyApproved(paths, state);
    if (state.execution.mode !== 'phase') fail('Use mode phase before start-phase.');
    const id = required(rest[0], 'phase ID');
    const p = state.phases.find(p => p.id === id);
    if (!p) fail(`Unknown phase ${id}.`);
    if (!phaseReady(state, p)) fail(`Phase ${id} has incomplete dependencies.`);
    if (done(state, id)) fail(`Phase ${id} is already complete.`);
    const previous = state.execution.activePhaseId;
    if (previous && previous !== id && !done(state, previous)) fail(`Finish selected phase ${previous} before starting ${id}.`);
    state.execution.activePhaseId = id;
    event(state, 'start-phase', { phase: id });
  } else if (command === 'task') {
    if (state.stage !== 'implementation') fail('Cannot update implementation tasks before approval.');
    verifyApproved(paths, state);
    const [taskId, status] = rest;
    if (!STATUSES.has(status)) fail('Task status must be pending, in_progress, blocked, or done.');
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) fail(`Unknown task ${taskId}.`);
    const phase = state.phases.find(p => p.id === task.phase);
    if (!phaseReady(state, phase)) fail(`Task ${taskId} is in a phase with incomplete dependencies.`);
    if (state.execution.mode === 'phase' && state.execution.activePhaseId !== task.phase) fail(`Start phase ${task.phase} first.`);
    if (['in_progress', 'done'].includes(status)) for (const d of task.depends_on) {
      if (state.tasks.find(t => t.id === d)?.status !== 'done') fail(`Task ${taskId} depends on incomplete ${d}.`);
    }
    if (status === 'done' && !options.evidence?.trim()) fail(`Task ${taskId} needs verification evidence.`);
    if (status === 'blocked' && !options.reason?.trim()) fail(`Task ${taskId} needs --reason explaining what was tried and what decision is needed.`);
    task.status = status;
    task.evidence = status === 'done' ? options.evidence : null;
    task.blockedReason = status === 'blocked' ? options.reason : null;
    event(state, 'task', { task: taskId, phase: task.phase, status, evidence: task.evidence, reason: task.blockedReason });
  } else if (command === 'complete') {
    if (state.stage !== 'implementation') fail(`Cannot complete from ${state.stage}.`);
    verifyApproved(paths, state);
    if (!state.tasks.length || state.tasks.some(t => t.status !== 'done' || !t.evidence)) fail('Cannot complete while tasks lack verified completion evidence.');
    state.stage = 'completed';
    event(state, 'complete', { taskCount: state.tasks.length });
  } else fail(`Unknown command: ${command}. Run help.`);
  save(paths, state);
  const completeCount = state.tasks.filter(t => t.status === 'done').length;
  console.log(`${slug}: ${state.stage} | ${completeCount}/${state.tasks.length} tasks | mode ${state.execution.mode}`);
}
try { main(); } catch (error) { console.error(`feature-architect: ${error.message}`); process.exitCode = 1; }
