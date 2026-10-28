import assert from 'assert';
import { calculateRiskScoreBreakdown } from '../src/server/riskScoringService';

console.log('--- Production risk-scoring service tests ---');

{
  const result = calculateRiskScoreBreakdown([]);
  assert.strictEqual(result.overallScore, 30);
  assert.strictEqual(result.riskLevel, 'Low Risk');
  assert.strictEqual(result.totalClauses, 0);
}

{
  const result = calculateRiskScoreBreakdown([
    { riskLevel: 'Critical Risk' },
    { riskLevel: 'High Risk' },
    { riskLevel: 'Medium Risk' },
    { riskLevel: 'Low Risk' },
    {},
  ]);
  assert.strictEqual(result.overallScore, 50);
  assert.strictEqual(result.riskLevel, 'High Risk');
  assert.strictEqual(result.criticalRiskCount, 1);
  assert.strictEqual(result.highRiskCount, 2);
  assert.strictEqual(result.mediumRiskCount, 1);
  assert.strictEqual(result.lowRiskCount, 2);
  assert.deepStrictEqual(
    result.scoreBreakdown?.contributingClauses.map(clause => clause.riskScore),
    [85, 75, 50, 20, 20],
  );
}

{
  const result = calculateRiskScoreBreakdown([
    { riskLevel: 'Low Risk', riskScore: 100 },
    { riskLevel: 'Low Risk', riskScore: 120 },
  ]);
  assert.strictEqual(result.overallScore, 100);
  assert.deepStrictEqual(
    result.scoreBreakdown?.contributingClauses.map(clause => clause.riskScore),
    [100, 100],
  );
}

{
  const result = calculateRiskScoreBreakdown([
    { riskLevel: 'Critical Risk', riskScore: 100 },
  ]);
  assert.strictEqual(result.scoreBreakdown?.criticalRiskContribution?.points, 100);
}

{
  const result = calculateRiskScoreBreakdown([
    { riskLevel: 'High Risk', riskScore: Number.POSITIVE_INFINITY },
    { riskLevel: 'High Risk', riskScore: Number.NaN },
    { riskLevel: 'High Risk', riskScore: -10 },
  ]);
  assert.strictEqual(result.overallScore, 75);
  assert.strictEqual(result.riskLevel, 'High Risk');
  assert.deepStrictEqual(
    result.scoreBreakdown?.contributingClauses.map(clause => clause.riskScore),
    [75, 75, 75],
  );
}

{
  const highAtRoundedBoundary = calculateRiskScoreBreakdown([
    { riskLevel: 'Low Risk', riskScore: 59.5 },
  ]);
  assert.strictEqual(highAtRoundedBoundary.overallScore, 60);
  assert.strictEqual(highAtRoundedBoundary.riskLevel, 'High Risk');

  const mediumAtRoundedBoundary = calculateRiskScoreBreakdown([
    { riskLevel: 'Low Risk', riskScore: 34.5 },
  ]);
  assert.strictEqual(mediumAtRoundedBoundary.overallScore, 35);
  assert.strictEqual(mediumAtRoundedBoundary.riskLevel, 'Medium Risk');
}

{
  const highCountEscalation = calculateRiskScoreBreakdown([
    { riskLevel: 'High Risk', riskScore: 20 },
    { riskLevel: 'High Risk', riskScore: 20 },
  ]);
  assert.strictEqual(highCountEscalation.overallScore, 20);
  assert.strictEqual(highCountEscalation.riskLevel, 'High Risk');

  const mediumCountEscalation = calculateRiskScoreBreakdown([
    { riskLevel: 'Medium Risk', riskScore: 10 },
    { riskLevel: 'Medium Risk', riskScore: 10 },
  ]);
  assert.strictEqual(mediumCountEscalation.overallScore, 10);
  assert.strictEqual(mediumCountEscalation.riskLevel, 'Medium Risk');
}

console.log('✓ Production risk aggregation, defaults, bounds, rounding, and escalations verified.');
