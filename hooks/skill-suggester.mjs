// skill-suggester.mjs v1.0 — PostToolUse hook: nudge toward the matching 1C skill when
// the model works the sources with raw tools (forgot a skill, or went manual).
// Source: https://github.com/Nikolay-Shirokov/cc-1c-skills
//
// stdin: PostToolUse JSON { tool_name, tool_input, session_id, cwd, ... }.
// Non-blocking: emits stdout JSON hookSpecificOutput.additionalContext (model-visible).
// Throttled to 1×/session/skill-group via marker files. Switch: skillSuggester (on|off)
// in .v8-project.json. Never throws.

import { classifyFile, classifySearch } from './common/object-class.mjs';
import { findConfigRoot } from './common/support-state.mjs';
import { getSuggesterMode } from './common/project.mjs';
import { resolve, isAbsolute, join } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

function pickTarget(input, cwd) {
  const ti = input.tool_input || {};
  const tool = input.tool_name;
  let raw = null, kind = 'file';
  if (tool === 'Read' || tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit') {
    raw = typeof ti.file_path === 'string' ? ti.file_path
      : (Array.isArray(ti.file_edits) && ti.file_edits[0]?.file_path) || null;
  } else if (tool === 'Grep') {
    raw = typeof ti.path === 'string' ? ti.path : null; kind = 'search';
  } else if (tool === 'Glob') {
    raw = typeof ti.path === 'string' ? ti.path : (typeof ti.pattern === 'string' ? ti.pattern : null); kind = 'search';
  }
  if (!raw) return null;
  const path = isAbsolute(raw) ? raw : resolve(cwd, raw);
  return { path, kind };
}

function sanitize(s) {
  return String(s || 'nosession').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

// Core. opts.throttleDir overrides the marker directory (tests). Returns {stdout,stderr,exitCode}.
export function processInput(input, opts = {}) {
  const empty = { stdout: '', stderr: '', exitCode: 0 };
  try {
    const cwd = typeof input.cwd === 'string' ? input.cwd : process.cwd();
    const t = pickTarget(input, cwd);
    if (!t) return empty;

    const hit = t.kind === 'search' ? classifySearch(t.path) : classifyFile(t.path);
    if (!hit) return empty;

    const { cfgDir } = findConfigRoot(t.path);
    if (getSuggesterMode(cfgDir, cwd) === 'off') return empty;

    const dir = opts.throttleDir || tmpdir();
    const marker = join(dir, `cc-1c-suggest-${sanitize(input.session_id)}-${hit.group}`);
    if (existsSync(marker)) return empty; // already nudged this group this session
    try { writeFileSync(marker, ''); } catch { /* throttle best-effort */ }

    const decision = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `[1c-skills] ${hit.message}`,
      },
    };
    return { stdout: JSON.stringify(decision), stderr: '', exitCode: 0 };
  } catch {
    return empty;
  }
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('skill-suggester.mjs')) {
  const raw = await readStdin();
  let input = {};
  try { input = raw.trim() ? JSON.parse(raw) : {}; } catch { input = {}; }
  const { stdout, stderr, exitCode } = processInput(input);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr + '\n');
  process.exit(exitCode);
}
