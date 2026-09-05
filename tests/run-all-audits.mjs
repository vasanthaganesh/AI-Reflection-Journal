import { spawn } from 'node:child_process';
import path from 'node:path';

console.log('\n===============================================================');
console.log('🏛️  MNEMÓSYNE AI REFLECTION JOURNAL — MULTI-AGENT AUDIT RUNNER');
console.log('===============================================================\n');

const suites = [
  { name: 'Agent 1: Functional & Feature QA Tester', file: 'functional-qa.test.mjs' },
  { name: 'Agent 2: UX Auditor & UI Engineer', file: 'ux-ui-audit.test.mjs' },
  { name: 'Agent 3: Security & AI Vulnerability Engineer', file: 'security-audit.test.mjs' },
];

async function runSuite(suite) {
  console.log(`\n▶ Starting [${suite.name}]...`);
  const filePath = path.join(process.cwd(), 'tests', suite.file);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', '--test', filePath], {
      stdio: 'inherit',
      env: { ...process.env, TEST_BASE_URL: process.env.TEST_BASE_URL || 'http://localhost:3000' },
    });

    child.on('close', (code) => {
      console.log(`✔ Finished [${suite.name}] with exit code ${code}`);
      resolve({ name: suite.name, code });
    });
  });
}

async function runAll() {
  const startTime = Date.now();
  const results = [];
  for (const s of suites) {
    const res = await runSuite(s);
    results.push(res);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n===============================================================');
  console.log(`🏁 AUDIT EXECUTION COMPLETE (${duration}s)`);
  console.log('===============================================================');
  results.forEach((r) => {
    const status = r.code === 0 ? '✅ PASSED / DIAGNOSED' : '❌ FAILED';
    console.log(`  ${status} — ${r.name}`);
  });
  console.log('===============================================================\n');
}

runAll();
