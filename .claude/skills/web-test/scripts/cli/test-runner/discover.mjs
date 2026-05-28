// web-test cli/test-runner/discover v1.0 — test file discovery + state reset between tests
// Source: https://github.com/Nikolay-Shirokov/cc-1c-skills
import { existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

export function discoverTests(testPath) {
  if (testPath.endsWith('.test.mjs')) return existsSync(testPath) ? [testPath] : [];
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.test.mjs')) files.push(full);
    }
  }
  walk(testPath);
  return files.sort();
}

export async function resetState(ctx) {
  try { if (typeof ctx.dismissPendingErrors === 'function') await ctx.dismissPendingErrors(); } catch {}
  for (let i = 0; i < 10; i++) {
    try {
      const state = await ctx.getFormState();
      // form === null means no form open (desktop). form === 0 is a real background form
      // 1C exposes in some states — must still close it to fully reset.
      if (state.form == null) break;
      await ctx.closeForm({ save: false });
    } catch { break; }
  }
}
