/**
 * Python/TypeScript Parity Test — All 12 Categories
 * Covers: representative, ambiguous, and short clauses.
 */
import { clauseClassifier } from '../src/ml/clauseClassifier.js';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface Probe {
  expected: string;
  acceptableLabels?: string[];
  text: string;
  tag: string; // 'representative' | 'ambiguous' | 'short'
}

const probes: Probe[] = [
  // --- Representative (clear, typical clauses) ---
  { expected: 'Cap On Liability', tag: 'representative',
    text: 'In no event shall either party aggregate liability exceed the total fees paid in the preceding twelve months.' },
  { expected: 'Governing Law', tag: 'representative',
    text: 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.' },
  { expected: 'Termination For Convenience', tag: 'representative',
    text: 'Either party may terminate this Agreement without cause upon thirty (30) days prior written notice to the other party.' },
  { expected: 'Audit Rights', tag: 'representative',
    text: 'Customer shall allow Vendor and its certified public accountants to inspect and audit books, records, and systems once annually.' },
  { expected: 'Non-Compete', tag: 'representative',
    text: 'The Consultant shall not engage in any business that directly competes with the Company for a period of two years after termination.' },
  { expected: 'Anti-Assignment', tag: 'representative',
    text: 'Neither party may assign or transfer this Agreement or any rights hereunder without the prior written consent of the other party.' },
  { expected: 'Insurance', tag: 'representative',
    text: 'Each party shall maintain commercial general liability insurance with minimum coverage of two million dollars per occurrence.' },
  { expected: 'License Grant', tag: 'representative',
    text: 'Provider grants Customer a non-exclusive, non-transferable, royalty-free license to use the Software during the subscription term.' },
  { expected: 'Renewal Term',
    // Both labels are defensible here: the sentence names renewal periods and the
    // opt-out notice deadline; CUAD also contains exact normalized text under both labels.
    acceptableLabels: ['Renewal Term', 'Notice Period To Terminate Renewal'],
    tag: 'representative',
    text: 'This Agreement shall automatically renew for successive one-year terms unless either party provides written notice of non-renewal at least ninety days before expiration.' },
  { expected: 'Notice Period To Terminate Renewal', tag: 'representative',
    text: 'Either party must provide at least sixty (60) days written notice prior to the end of the then-current term to prevent automatic renewal.' },
  { expected: 'Ip Ownership Assignment', tag: 'representative',
    text: 'Contractor hereby assigns to Company all right, title, and interest in any inventions, works of authorship, and intellectual property created during the engagement.' },
  { expected: 'Liquidated Damages', tag: 'representative',
    text: 'In the event of delay the Contractor shall pay liquidated damages of five thousand dollars per calendar day of delay.' },

  // --- Ambiguous (could confuse models — near class boundaries) ---
  { expected: 'Renewal Term', tag: 'ambiguous',
    text: 'The initial term of this Agreement is one year and shall renew automatically for additional successive periods.' },
  { expected: 'Termination For Convenience', tag: 'ambiguous',
    text: 'The Company reserves the right to end this contract at any time for any reason with reasonable advance notice.' },
  { expected: 'Cap On Liability', tag: 'ambiguous',
    text: 'Under no circumstances will the total amount payable under this agreement exceed the annual subscription fee.' },
  { expected: 'Anti-Assignment', tag: 'ambiguous',
    text: 'This contract is personal to the parties and may not be transferred to any third party without consent.' },
  { expected: 'Ip Ownership Assignment', tag: 'ambiguous',
    text: 'All work product and deliverables created by Contractor shall become the sole property of Client upon payment.' },
  { expected: 'Notice Period To Terminate Renewal', tag: 'ambiguous',
    text: 'To cancel renewal, written notice must be given no later than thirty days before the term expires.' },

  // --- Short (minimal text — boundary stress tests) ---
  { expected: 'Insurance', tag: 'short',
    text: 'Vendor shall carry adequate workers compensation and liability insurance coverage.' },
  { expected: 'Governing Law', tag: 'short',
    text: 'Governed by the laws of New York.' },
  { expected: 'Audit Rights', tag: 'short',
    text: 'Company may audit records related to performance of services.' },
  { expected: 'License Grant', tag: 'short',
    text: 'Licensor grants a perpetual license to use the technology.' },
  { expected: 'Liquidated Damages', tag: 'short',
    text: 'Liquidated damages of one thousand dollars per day apply for late delivery.' },
  { expected: 'Non-Compete', tag: 'short',
    text: 'Employee agrees not to compete with Employer for eighteen months post-termination.' },
];

const status = clauseClassifier.getStatus();
const cachedData = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', 'preprocessed_dataset.json'), 'utf8')
);
const renewalTexts = new Set(
  cachedData.train_samples
    .filter((sample: { category: string }) => sample.category === 'Renewal Term')
    .map((sample: { normalized_text: string }) => sample.normalized_text)
);
const noticeTexts = new Set(
  cachedData.train_samples
    .filter((sample: { category: string }) => sample.category === 'Notice Period To Terminate Renewal')
    .map((sample: { normalized_text: string }) => sample.normalized_text)
);
const sharedRenewalNoticeTexts = [...renewalTexts].filter(text => noticeTexts.has(text));
const lines: string[] = [];
lines.push('=== Python/TypeScript Runtime Parity: All 12 Categories ===');
lines.push('Model: ' + status.modelName + ' (' + status.featureCount + ' features, ' + status.categories.length + ' classes)');
lines.push('');

const python = spawnSync(
  process.env.PYTHON || 'python',
  [path.join('ml_pipeline', 'inference.py'), '--json-input'],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: JSON.stringify(probes.map(probe => probe.text)),
  }
);
if (python.error) {
  throw new Error(`Could not run Python inference: ${python.error.message}`);
}
if (python.status !== 0) {
  throw new Error(
    `Python inference exited with status ${python.status}: ${python.stderr}`
  );
}

const pythonResult = JSON.parse(python.stdout);
if (
  pythonResult.model.name !== status.modelName ||
  pythonResult.model.featureCount !== status.featureCount ||
  JSON.stringify(pythonResult.model.categories) !== JSON.stringify(status.categories)
) {
  throw new Error('Python and TypeScript model metadata do not agree.');
}

let parityMatches = 0;
let confidenceMatches = 0;
let expectedMatches = 0;
let acceptableLabelMatches = 0;
let parityMismatches = 0;
const tagStats: Record<string, { total: number; correct: number }> = {
  representative: { total: 0, correct: 0 },
  ambiguous: { total: 0, correct: 0 },
  short: { total: 0, correct: 0 },
};

lines.push('Tag | Expected | Python | TypeScript | Parity | Expected label');
lines.push('--- | --- | --- | --- | --- | ---');

for (const [index, probe] of probes.entries()) {
  const tsResult = clauseClassifier.classifyClause(probe.text);
  const pythonPrediction = pythonResult.predictions[index];
  const parityMatch =
    pythonPrediction.predictedCategory === tsResult.predictedCategory;
  const confidenceMatch =
    Math.abs(pythonPrediction.confidence - tsResult.confidence) <= 0.02;
  const expectedMatch = tsResult.predictedCategory === probe.expected;
  const acceptableMatch = (
    probe.acceptableLabels || [probe.expected]
  ).includes(tsResult.predictedCategory);
  if (parityMatch) parityMatches++;
  else parityMismatches++;
  if (confidenceMatch) confidenceMatches++;
  if (expectedMatch) expectedMatches++;
  if (acceptableMatch) acceptableLabelMatches++;
  if (probe.acceptableLabels) {
    if (!acceptableMatch) {
      throw new Error(
        `Ambiguous-label regression failed for probe ${index + 1}: `
        + `${tsResult.predictedCategory} is not in the evidence-backed label set.`
      );
    }
  }
  tagStats[probe.tag].total++;
  if (expectedMatch) tagStats[probe.tag].correct++;
  lines.push(`| ${probe.tag} | ${probe.expected} | ${pythonPrediction.predictedCategory} | ${tsResult.predictedCategory} | ${parityMatch ? 'MATCH' : 'MISMATCH'} | ${expectedMatch ? 'MATCH' : 'MISMATCH'} |`);
  if (!confidenceMatch) {
    lines.push(
      `  Confidence mismatch for probe ${index + 1}: Python=${pythonPrediction.confidence}, TypeScript=${tsResult.confidence}.`
    );
  }
}

lines.push('');
lines.push('=== Python/TypeScript Parity Summary ===');
lines.push(`Predicted-label agreement: ${parityMatches}/${probes.length}`);
lines.push(`Confidence agreement (within 0.02 pp): ${confidenceMatches}/${probes.length}`);
lines.push(`Expected-label matches (separate quality probe): ${expectedMatches}/${probes.length}`);
lines.push(`Evidence-backed acceptable-label matches: ${acceptableLabelMatches}/${probes.length}`);
lines.push(`Exact shared normalized Renewal/Notice texts in training partition: ${sharedRenewalNoticeTexts.length}`);
lines.push(
  'The renewal probe combines renewal duration and its opt-out deadline; '
  + 'the cached training labels contain overlapping evidence for both categories.'
);
if (sharedRenewalNoticeTexts.length === 0) {
  throw new Error('Expected training evidence for the ambiguous renewal/notice probe was not found.');
}
for (const tag of ['representative', 'ambiguous', 'short']) {
  const s = tagStats[tag];
  lines.push(`Expected-label matches — ${tag}: ${s.correct}/${s.total}`);
}

const covered = new Set(probes.map(p => p.expected));
lines.push('');
lines.push(`Category coverage: ${covered.size}/${status.categories.length}`);

const output = lines.join('\n');
process.stdout.write(output + '\n');
fs.writeFileSync('data/ts_parity_results.txt', output, 'utf8');
if (
  parityMismatches > 0
  || confidenceMatches !== probes.length
  || acceptableLabelMatches !== probes.length
) {
  process.exitCode = 1;
}
