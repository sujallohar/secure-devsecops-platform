#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────
// tests/smoke/smoke-test.js — End-to-End Smoke Test
// Purpose: Verify all services are reachable through the API
//          gateway. Run this after docker-compose up or k8s deploy.
// Usage:   node tests/smoke/smoke-test.js [GATEWAY_URL]
//          Default GATEWAY_URL: http://localhost:3000
// ──────────────────────────────────────────────────────────────

const GATEWAY_URL = process.argv[2] || 'http://localhost:3000';

const checks = [
  // Health probes — these should always work if services are up
  { name: 'Gateway /health',         url: `${GATEWAY_URL}/health`,        expected: 200 },
  { name: 'Gateway /ready',          url: `${GATEWAY_URL}/ready`,         expected: 200 },
];

let passed = 0;
let failed = 0;

async function runCheck({ name, url, expected }) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.status === expected) {
      console.log(`  ✅  ${name} → ${res.status}`);
      passed++;
    } else {
      console.log(`  ❌  ${name} → ${res.status} (expected ${expected})`);
      failed++;
    }
  } catch (err) {
    console.log(`  ❌  ${name} → ${err.message}`);
    failed++;
  }
}

(async () => {
  console.log(`\n🔥 Smoke Test — ${GATEWAY_URL}\n`);

  for (const check of checks) {
    await runCheck(check);
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
