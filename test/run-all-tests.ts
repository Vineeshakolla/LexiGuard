/**
 * LexiGuard Master Test Runner
 * ----------------------------
 * Runs production risk scoring, ML/assistant, and Python/TypeScript parity tests.
 */

import { execSync } from 'child_process';
import path from 'path';

console.log('###############################################################');
console.log('#              LEXIGUARD VERIFIED TEST RUNNER                 #');
console.log('###############################################################\n');

try {
  console.log('>> [1/5] Running Risk Scoring & Escalation Tests...');
  execSync('npx tsx test/risk-scoring.test.ts', { stdio: 'inherit' });
  console.log('>> [1/5] Risk Scoring Tests Complete.\n');

  console.log('>> [2/5] Running Machine Learning & Preprocessing Tests...');
  execSync('npx tsx test/ml-models.test.ts', { stdio: 'inherit' });
  console.log('>> [2/5] Machine Learning Tests Complete.\n');

  console.log('>> [3/5] Running Python/TypeScript Runtime Parity Tests...');
  execSync('npx tsx test/ts-inference-crosscheck.ts', { stdio: 'inherit' });
  console.log('>> [3/5] Runtime Parity Tests Complete.\n');

  console.log('>> [4/5] Running Deterministic Assistant Fallback Tests...');
  execSync('npx tsx test/assistant-fallback.test.ts', { stdio: 'inherit' });
  console.log('>> [4/5] Assistant Fallback Tests Complete.\n');

  console.log('>> [5/5] Running Isolated API Integration Tests...');
  execSync('npx tsx test/api-integration.test.ts', { stdio: 'inherit' });
  console.log('>> [5/5] API Integration Tests Complete.\n');

  console.log('###############################################################');
  console.log('#       ALL TEST SUITES EXECUTED AND PASSED SUCCESSFULLY      #');
  console.log('###############################################################');
} catch (error: any) {
  console.error('\n❌ Test execution failed with error:', error.message);
  process.exit(1);
}
