import { ScoreBreakdown, OverallAssessment } from '../types/legal';

interface RiskScoringClause {
  clauseNumber?: number;
  title?: string;
  potentialRiskLabel?: string;
  riskLevel?: string;
  riskScore?: number;
  riskReason?: string;
  potentialConsequences?: string;
  whatDoesThisMean?: string;
  whatDoesItSay?: string;
  exactQuotation?: string;
}

export function calculateRiskScoreBreakdown(clauses: RiskScoringClause[]): OverallAssessment {
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;
  let criticalRiskCount = 0;
  let criticalRiskPoints = 0;
  let totalScoreSum = 0;

  const contributingClauses: Array<{
    clauseNumber: number;
    title: string;
    riskLevel: string;
    riskScore: number;
    riskReason?: string;
    exactQuotation?: string;
  }> = [];

  for (let idx = 0; idx < clauses.length; idx++) {
    const c = clauses[idx];
    const rawLvl = (c.potentialRiskLabel || c.riskLevel || '').toLowerCase();
    let score = typeof c.riskScore === 'number' && Number.isFinite(c.riskScore) && c.riskScore > 0
      ? Math.min(c.riskScore, 100)
      : 0;

    let normLvl = 'Low Risk';
    if (rawLvl.includes('critical')) {
      criticalRiskCount++;
      highRiskCount++;
      normLvl = 'High Risk';
      if (!score) score = 85;
      criticalRiskPoints += score;
      totalScoreSum += score;
    } else if (rawLvl.includes('high')) {
      highRiskCount++;
      normLvl = 'High Risk';
      if (!score) score = 75;
      totalScoreSum += score;
    } else if (rawLvl.includes('medium') || rawLvl.includes('mod')) {
      mediumRiskCount++;
      normLvl = 'Medium Risk';
      if (!score) score = 50;
      totalScoreSum += score;
    } else {
      lowRiskCount++;
      normLvl = 'Low Risk';
      if (!score) score = 20;
      totalScoreSum += score;
    }

    contributingClauses.push({
      clauseNumber: c.clauseNumber || (idx + 1),
      title: c.title || `Clause ${idx + 1}`,
      riskLevel: normLvl,
      riskScore: score,
      riskReason: c.riskReason || c.potentialConsequences || c.whatDoesThisMean,
      exactQuotation: c.whatDoesItSay || c.exactQuotation
    });
  }

  const clauseCount = clauses.length;
  const rawScore = clauseCount > 0 ? Math.round(totalScoreSum / clauseCount) : 30;
  const overallScore = Math.min(100, Math.max(0, rawScore));

  let riskLevel: 'High Risk' | 'Medium Risk' | 'Low Risk' = 'Low Risk';
  let escalationRuleTriggered: string | null = null;

  if (overallScore >= 60 || highRiskCount >= 2 || criticalRiskCount > 0) {
    riskLevel = 'High Risk';
    if (criticalRiskCount > 0) {
      escalationRuleTriggered = `High Risk escalated because ${criticalRiskCount} critical risk clause(s) were flagged.`;
    } else if (highRiskCount >= 2 && overallScore < 60) {
      escalationRuleTriggered = `Escalated to High Risk because ${highRiskCount} high-risk clauses were flagged (escalation threshold: >= 2 high-risk clauses).`;
    } else {
      escalationRuleTriggered = `High Risk triggered by overall calculated score (${overallScore} >= 60 threshold).`;
    }
  } else if (overallScore >= 35 || mediumRiskCount >= 2) {
    riskLevel = 'Medium Risk';
    if (mediumRiskCount >= 2 && overallScore < 35) {
      escalationRuleTriggered = `Escalated to Medium Risk because ${mediumRiskCount} medium-risk clauses were flagged (escalation threshold: >= 2 medium-risk clauses).`;
    } else {
      escalationRuleTriggered = `Medium Risk triggered by overall calculated score (${overallScore} >= 35 threshold).`;
    }
  } else {
    escalationRuleTriggered = 'Low Risk tier: No escalation thresholds triggered (score < 35, high-risk clauses < 2).';
  }

  let scoreExplanation = '';
  if (riskLevel === 'High Risk') {
    scoreExplanation = 'This document has clauses that could create serious problems or financial responsibility. Review them carefully before agreeing.';
  } else if (riskLevel === 'Medium Risk') {
    scoreExplanation = 'This document has terms that could cause confusion or future inconvenience. Consider asking questions or requesting clarifications.';
  } else {
    scoreExplanation = 'No major risks were identified in the available text, but you should still make sure you understand what you are agreeing to.';
  }

  const scoreBreakdown: ScoreBreakdown = {
    formula: 'OverallScore = min(100, max(0, round(sum(clause_scores) / total_clauses)))',
    totalScoreSum,
    clauseCount,
    averageScore: rawScore,
    highRiskContribution: {
      count: highRiskCount,
      weight: 75,
      points: contributingClauses.filter(c => c.riskLevel === 'High Risk').reduce((sum, c) => sum + c.riskScore, 0)
    },
    mediumRiskContribution: {
      count: mediumRiskCount,
      weight: 50,
      points: contributingClauses.filter(c => c.riskLevel === 'Medium Risk').reduce((sum, c) => sum + c.riskScore, 0)
    },
    lowRiskContribution: {
      count: lowRiskCount,
      weight: 20,
      points: contributingClauses.filter(c => c.riskLevel === 'Low Risk').reduce((sum, c) => sum + c.riskScore, 0)
    },
    criticalRiskContribution: {
      count: criticalRiskCount,
      weight: 85,
      points: criticalRiskPoints
    },
    escalationRuleTriggered,
    contributingClauses
  };

  return {
    overallScore,
    riskLevel,
    scoreExplanation,
    totalClauses: clauseCount,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    criticalRiskCount,
    scoreBreakdown
  };
}
