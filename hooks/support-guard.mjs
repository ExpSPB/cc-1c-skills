// support-guard.mjs v1.0 — PreToolUse hook (§1A): block raw Edit/Write/MultiEdit of
// vendor objects "на замке" / read-only configs that bypass the in-skill guard (§1B).
// Source: https://github.com/Nikolay-Shirokov/cc-1c-skills
//
// stdin: PreToolUse JSON { tool_name, tool_input, cwd, ... }.
// Decision via stdout JSON hookSpecificOutput.permissionDecision (deny) — see
// docs/1c-support-state-spec.md. Reaction (deny|warn|off) from .v8-project.json
// editingAllowedCheck, identical to §1B. Never blocks on its own errors.

import { decideSupport } from './common/support-state.mjs';
import { getEditMode } from './common/project.mjs';
import { resolve, isAbsolute } from 'node:path';

// Collect candidate file paths from an Edit/Write/MultiEdit tool_input. Handles the
// single-file form ({ file_path }) and the array form ({ file_edits: [{ file_path }] }).
function candidatePaths(toolInput) {
  const out = [];
  if (!toolInput || typeof toolInput !== 'object') return out;
  if (typeof toolInput.file_path === 'string') out.push(toolInput.file_path);
  if (Array.isArray(toolInput.file_edits)) {
    for (const e of toolInput.file_edits) {
      if (e && typeof e.file_path === 'string') out.push(e.file_path);
    }
  }
  return out;
}

function diagnostic(reason, target) {
  return (
    `[support-guard] Операция запрещена: ${reason}.\n` +
    `  Цель: ${target}\n` +
    `  Безопасные пути: доработка через расширение (cfe-*); либо support-edit -Path <цель> -Set editable ` +
    `(включить объект) / -Path <дамп> -Capability on (вся конфа read-only) / -Set off-support (снять с поддержки).\n` +
    `  Отключить проверку: editingAllowedCheck = warn|off в .v8-project.json.`
  );
}

// Core decision. Returns { stdout, stderr, exitCode }. Pure (no I/O) for testability.
export function processInput(input) {
  const empty = { stdout: '', stderr: '', exitCode: 0 };
  try {
    const cwd = typeof input.cwd === 'string' ? input.cwd : process.cwd();
    const paths = candidatePaths(input.tool_input);
    for (const p of paths) {
      const target = isAbsolute(p) ? p : resolve(cwd, p);
      const r = decideSupport(target, 'editable');
      if (!r.blocked) continue;
      const mode = getEditMode(r.cfgDir, cwd);
      if (mode === 'off') continue;
      if (mode === 'warn') {
        return { stdout: '', stderr: `[support-guard] ПРЕДУПРЕЖДЕНИЕ: ${r.reason}. Цель: ${target}`, exitCode: 0 };
      }
      // deny (default): structured PreToolUse decision.
      const decision = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: diagnostic(r.reason, target),
        },
      };
      return { stdout: JSON.stringify(decision), stderr: '', exitCode: 0 };
    }
    return empty;
  } catch {
    return empty; // guard errors must never block
  }
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

// Run only when executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('support-guard.mjs')) {
  const raw = await readStdin();
  let input = {};
  try { input = raw.trim() ? JSON.parse(raw) : {}; } catch { input = {}; }
  const { stdout, stderr, exitCode } = processInput(input);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr + '\n');
  process.exit(exitCode);
}
