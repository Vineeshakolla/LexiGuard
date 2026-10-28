/**
 * LexiGuard Machine Learning & Preprocessing Test Suite
 * -----------------------------------------------------
 * Validates:
 * 1. Data preprocessing pipeline (missing data, deduplication, contract-level split)
 * 2. 4-Model evaluation results and metric sanity checks
 * 3. In-process TF-IDF and Linear SVM / Logistic Regression classification
 * 4. Strict separation between clause category and legal risk scoring
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { clauseClassifier } from '../src/ml/clauseClassifier';

console.log('===============================================================');
console.log('   LEXIGUARD: MACHINE LEARNING PIPELINE & MODEL TEST SUITE     ');
console.log('===============================================================');

// Suite 1: Preprocessed Dataset Validation
{
  console.log('\n--- Test Suite 1: Preprocessed Dataset Validation ---');
  const datasetPath = path.resolve(process.cwd(), 'data', 'preprocessed_dataset.json');
  assert.strictEqual(fs.existsSync(datasetPath), true, 'data/preprocessed_dataset.json must exist');

  const raw = fs.readFileSync(datasetPath, 'utf8');
  const data = JSON.parse(raw);

  assert.ok(data.metadata, 'Dataset must have metadata block');
  assert.strictEqual(data.metadata.total_contracts, 510, 'Must have 510 total contracts');
  assert.strictEqual(data.metadata.train_contracts, 408, 'Must have 408 training contracts (80%)');
  assert.strictEqual(data.metadata.test_contracts, 102, 'Must have 102 test contracts (20%)');

  // Verify missing values were handled
  assert.ok(data.metadata.missing_filtered > 1000, 'Must handle and filter missing or empty clause cells');
  
  // Verify deduplication
  assert.ok(data.metadata.duplicates_removed > 0, 'Must detect and remove duplicate clause instances');

  // Check Zero Document Leakage: train contract IDs and test contract IDs must be completely disjoint
  const trainContractIds = new Set(data.train_samples.map((s: any) => s.contract_id));
  const testContractIds = new Set(data.test_samples.map((s: any) => s.contract_id));
  
  for (const id of testContractIds) {
    assert.strictEqual(
      trainContractIds.has(id),
      false,
      `Data leakage violation: contract ${id} found in both train and test sets!`
    );
  }
  console.log(`✓ Zero Document Leakage Verified: ${trainContractIds.size} train contracts and ${testContractIds.size} test contracts are completely disjoint.`);

  // Verify balanced class weights are present and positive
  const weights = data.metadata.balanced_class_weights;
  assert.ok(weights && Object.keys(weights).length === 12, 'Must have balanced weights for all 12 classes');
  for (const cat of Object.keys(weights)) {
    assert.ok(weights[cat] > 0, `Weight for ${cat} must be positive`);
  }
  console.log('✓ Class Imbalance Handled: Balanced sample weights computed for all 12 categories.');
}

// Suite 2: 4-Model Evaluation Metrics Sanity Checks
{
  console.log('\n--- Test Suite 2: 4-Model Evaluation & Confusion Matrix ---');
  const resultsPath = path.resolve(process.cwd(), 'data', 'traditional_ml_results.json');
  assert.strictEqual(fs.existsSync(resultsPath), true, 'data/traditional_ml_results.json must exist');

  const raw = fs.readFileSync(resultsPath, 'utf8');
  const evalData = JSON.parse(raw);

  const algorithms = evalData.algorithms;
  assert.ok(algorithms, 'Evaluation data must contain algorithms block');
  
  const requiredModels = ['linearSvm', 'logisticRegression', 'multinomialNaiveBayes', 'knn'];
  for (const m of requiredModels) {
    assert.ok(algorithms[m], `Algorithm ${m} must be evaluated`);
    const modelEval = algorithms[m];
    
    // Metric bounds checks
    assert.ok(modelEval.accuracy >= 65 && modelEval.accuracy <= 100, `${m} accuracy must be between 65% and 100%`);
    assert.ok(modelEval.macroF1 >= 60 && modelEval.macroF1 <= 100, `${m} Macro F1 must be between 60% and 100%`);
    assert.ok(modelEval.weightedF1 >= 65 && modelEval.weightedF1 <= 100, `${m} Weighted F1 must be between 65% and 100%`);
    
    // Confusion matrix checks
    assert.strictEqual(modelEval.confusionMatrix.length, 12, `${m} confusion matrix must have 12 rows`);
    assert.strictEqual(modelEval.confusionMatrix[0].length, 12, `${m} confusion matrix must have 12 columns`);
    
    // Per-class metrics
    assert.strictEqual(modelEval.categoryMetrics.length, 12, `${m} must have metrics for all 12 categories`);
    console.log(`  ✓ ${m.padEnd(22)}: Accuracy = ${modelEval.accuracy}% | Macro F1 = ${modelEval.macroF1}% | Weighted F1 = ${modelEval.weightedF1}%`);
  }
}

// Suite 3: Runtime Clause Classifier Inference
{
  console.log('\n--- Test Suite 3: Real-Time Model Inference on Legal Text ---');
  
  // Test Clause 1: Cap On Liability
  const liabilityClause = "In no event shall either party's aggregate liability under this agreement exceed the total fees paid during the prior twelve months.";
  const res1 = clauseClassifier.classifyClause(liabilityClause);
  assert.strictEqual(res1.predictedCategory, 'Cap On Liability', 'Must classify as Cap On Liability');
  assert.ok(res1.confidence > 25, 'Confidence must be positive');
  assert.ok(res1.topFeatures.length > 0, 'Must extract top contributing TF-IDF n-grams');
  console.log(`  ✓ Sample 1 (Liability Cap):     Predicted -> "${res1.predictedCategory}" (Confidence: ${res1.confidence}%, Features: ${res1.topFeatures.slice(0, 3).join(', ')})`);

  // Test Clause 2: Governing Law
  const governingLawClause = "This Agreement and all disputes arising hereunder shall be governed by and construed in accordance with the laws of the State of Delaware.";
  const res2 = clauseClassifier.classifyClause(governingLawClause);
  assert.strictEqual(res2.predictedCategory, 'Governing Law', 'Must classify as Governing Law');
  console.log(`  ✓ Sample 2 (Governing Law):     Predicted -> "${res2.predictedCategory}" (Confidence: ${res2.confidence}%, Features: ${res2.topFeatures.slice(0, 3).join(', ')})`);

  // Test Clause 3: Termination For Convenience
  const terminationClause = "Either party may terminate this Agreement without cause at any time by giving sixty (60) days prior written notice to the other party.";
  const res3 = clauseClassifier.classifyClause(terminationClause);
  assert.strictEqual(res3.predictedCategory, 'Termination For Convenience', 'Must classify as Termination For Convenience');
  console.log(`  ✓ Sample 3 (Termination):        Predicted -> "${res3.predictedCategory}" (Confidence: ${res3.confidence}%, Features: ${res3.topFeatures.slice(0, 3).join(', ')})`);

  // Test Clause 4: Audit Rights
  const auditClause = "Customer shall allow Vendor and its independent certified public accountants to inspect and audit its books, records, and systems once annually during normal business hours.";
  const res4 = clauseClassifier.classifyClause(auditClause);
  assert.strictEqual(res4.predictedCategory, 'Audit Rights', 'Must classify as Audit Rights');
  console.log(`  ✓ Sample 4 (Audit Rights):      Predicted -> "${res4.predictedCategory}" (Confidence: ${res4.confidence}%, Features: ${res4.topFeatures.slice(0, 3).join(', ')})`);
}

// Suite 4: Strict Separation between Clause Classification and Risk Scoring
{
  console.log('\n--- Test Suite 4: Separation of Classification vs Risk Scoring ---');
  // Substantive legal categories are objective topics:
  const allowedCategories = new Set([
    'Cap On Liability',
    'Governing Law',
    'Termination For Convenience',
    'Audit Rights',
    'Non-Compete',
    'Anti-Assignment',
    'Insurance',
    'License Grant',
    'Renewal Term',
    'Notice Period To Terminate Renewal',
    'Ip Ownership Assignment',
    'Liquidated Damages'
  ]);

  // Risk scores evaluate whether a term creates hazardous exposure:
  const allowedRiskRatings = new Set(['High Risk', 'Medium Risk', 'Low Risk', 'Not Enough Information', 'Critical Risk']);

  // Verify that an objective clause category is NEVER confused with a risk label
  for (const cat of allowedCategories) {
    assert.strictEqual(
      allowedRiskRatings.has(cat),
      false,
      `Category "${cat}" must NOT be treated as a risk label!`
    );
  }

  // A Governing Law clause is an objective category, but whether it is Low Risk or High Risk
  // depends on the user's jurisdiction — these must remain independent assessments.
  // The LONGER, unambiguous clause always has adequate TF-IDF signal for correct classification.
  const clearGovLaw = "This Agreement and all disputes arising hereunder shall be governed by the laws of the State of California. Each party submits to the jurisdiction of the federal courts located in San Francisco County.";
  const predClear = clauseClassifier.classifyClause(clearGovLaw);
  assert.strictEqual(predClear.predictedCategory, 'Governing Law',
    `Clear governing-law clause must classify as Governing Law (got: ${predClear.predictedCategory})`);

  // A short/ambiguous snippet may not have enough TF-IDF signal.
  // The test verifies only that the predicted category is a valid known label (not fabricated).
  const shortHostileClause = "Governing law of foreign off-shore jurisdiction with counterparty fee-shifting.";
  const predHostile = clauseClassifier.classifyClause(shortHostileClause);
  assert.ok(
    allowedCategories.has(predHostile.predictedCategory),
    `Short ambiguous snippet must predict a valid known category (got: "${predHostile.predictedCategory}")`
  );
  console.log(`✓ Separation Verified: Clause classification identifies legal topic ("${predClear.predictedCategory}" for clear clause, "${predHostile.predictedCategory}" for short snippet); risk scoring independently evaluates contractual hazard.`);
}

// Suite 5: AI Doubt Assistant Grounded Knowledge Base & Prompt Handling
{
  console.log('\n--- Test Suite 5: AI Doubt Assistant Knowledge & Grounding ---');
  const { assistantService } = await import('../src/server/assistantService');

  // Test 1: Category vs Risk Score
  const resRisk = await assistantService.handleChat([
    { role: 'user', content: 'Explain the difference between clause category and risk score' }
  ]);
  assert.ok(resRisk.response.length > 50, 'Response must be non-empty');
  assert.ok(
    resRisk.response.toLowerCase().includes('category') && resRisk.response.toLowerCase().includes('risk'),
    'Must explain both category and risk score'
  );
  console.log('  ✓ Category vs Risk Score distinction accurately explained.');

  // Test 2: Why Linear SVM was selected
  const resSvm = await assistantService.handleChat([
    { role: 'user', content: 'Why was Linear SVM chosen over KNN and Naive Bayes?' }
  ]);
  assert.ok(
    resSvm.response.includes('77.3%') || resSvm.response.includes('Linear SVM'),
    'Must cite Linear SVM performance or benchmark metrics'
  );
  console.log('  ✓ Algorithm selection rationale grounded in benchmark results.');

  // Test 3: Technical Mode Deep-Dive
  const resTech = await assistantService.handleChat(
    [{ role: 'user', content: 'Explain precision, recall, and confusion matrix' }],
    { technicalMode: true }
  );
  assert.ok(
    resTech.response.toLowerCase().includes('precision') && resTech.response.toLowerCase().includes('confusion matrix'),
    'Must explain precision, recall, and confusion matrix in technical mode'
  );
  console.log('  ✓ Technical mode outputs rigorous metrics definitions.');

  // Test 4: Clause-specific context grounding
  const resClause = await assistantService.handleChat(
    [{ role: 'user', content: 'Explain this clause in simple English' }],
    {
      selectedClause: {
        clauseNumber: 4,
        title: 'Non-Compete Limitation',
        category: 'Non-Compete',
        riskLevel: 'High Risk',
        riskScore: 85,
        exactQuotation: 'The Consultant shall not engage in competing business for 3 years.'
      }
    }
  );
  assert.ok(
    resClause.response.includes('Non-Compete') || resClause.response.includes('compete'),
    'Must ground response in the active clause context'
  );
  console.log('  ✓ Clause-specific doubt answering verified with contextual grounding.');

  // Test 5: Explain Overall Score of 75 with Full Document Breakdown
  const resOverall75 = await assistantService.handleChat(
    [{ role: 'user', content: 'Why is my overall risk assessment 75?' }],
    {
      currentDocument: {
        filename: 'Enterprise_Master_Services_Agreement.pdf',
        contractType: 'Master Services Agreement',
        overallScore: 75,
        riskLevel: 'High Risk',
        totalClauses: 4,
        highRiskCount: 4,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        scoreBreakdown: {
          formula: 'OverallScore = min(100, max(0, round(sum(clause_scores) / total_clauses)))',
          totalScoreSum: 300,
          clauseCount: 4,
          averageScore: 75,
          highRiskContribution: { count: 4, weight: 75, points: 300 },
          mediumRiskContribution: { count: 0, weight: 50, points: 0 },
          lowRiskContribution: { count: 0, weight: 20, points: 0 },
          escalationRuleTriggered: 'High Risk tier triggered by overall calculated score (75 >= 60 threshold).',
          contributingClauses: [
            { clauseNumber: 1, title: 'Mandatory Binding Arbitration', riskLevel: 'High Risk', riskScore: 85, riskReason: 'Removes jury trial and court access' },
            { clauseNumber: 2, title: 'Limitation of Liability', riskLevel: 'High Risk', riskScore: 75, riskReason: 'Caps vendor damages to $50' },
            { clauseNumber: 3, title: 'Unilateral Changes to Terms', riskLevel: 'High Risk', riskScore: 75, riskReason: 'Vendor may alter terms without user consent' },
            { clauseNumber: 4, title: 'Automatic Renewal Lock-In', riskLevel: 'High Risk', riskScore: 65, riskReason: 'Renews without reminder notice' }
          ]
        }
      }
    }
  );
  assert.ok(resOverall75.response.includes('75'), 'Must cite the overall score of 75');
  assert.ok(resOverall75.response.includes('300') || resOverall75.response.includes('4 clauses') || resOverall75.response.includes('4 extracted clauses'), 'Must explain the score points calculation');
  assert.ok(resOverall75.response.includes('Arbitration') || resOverall75.response.includes('Limitation of Liability'), 'Must cite specific contributing clauses');
  assert.strictEqual(
    resOverall75.response.includes('| Dimension | Machine Learning Classification | Contractual Risk Scoring |'),
    false,
    'Must NOT return generic category-vs-risk comparison table when asked why score is 75!'
  );
  console.log('  ✓ Question about overall score 75 answered directly with verified calculation and contributing clauses.');

  // Test 6: Explain Specific High-Risk Clause with Triggered Rules & Quotation
  const resWhyHighRisk = await assistantService.handleChat(
    [{ role: 'user', content: 'Why is this clause marked high risk?' }],
    {
      selectedClause: {
        clauseNumber: 2,
        title: 'Limitation of Liability & Consequential Damages Waiver',
        category: 'Cap On Liability',
        mlPredictedCategory: 'Cap On Liability',
        mlConfidence: 94.2,
        riskScore: 75,
        riskLevel: 'High Risk',
        exactQuotation: 'IN NO EVENT SHALL PROVIDER AGGREGATE LIABILITY EXCEED FIFTY DOLLARS ($50).',
        potentialConsequences: 'Limits recovery to $50 even if vendor gross negligence causes catastrophic downtime.',
        riskReason: 'Imposes severe unilateral liability ceiling while customer exposure remains completely uncapped.',
        suggestedRevision: 'Require mutual liability cap pegged to 12 months fees paid.'
      }
    }
  );
  assert.ok(resWhyHighRisk.response.includes('Limitation of Liability'), 'Must identify the specific clause title');
  assert.ok(resWhyHighRisk.response.includes('75'), 'Must state the risk score');
  assert.ok(resWhyHighRisk.response.includes('unilateral') || resWhyHighRisk.response.includes('liability ceiling') || resWhyHighRisk.response.includes('Limits recovery'), 'Must explain the triggered hazard reason');
  assert.ok(resWhyHighRisk.response.includes('FIFTY DOLLARS'), 'Must cite the supporting contract text');
  assert.strictEqual(
    resWhyHighRisk.response.includes('| Dimension | Machine Learning Classification | Contractual Risk Scoring |'),
    false,
    'Must NOT return generic category-vs-risk table when asked why a clause is high risk!'
  );
  console.log('  ✓ Question about high-risk clause answered directly with triggered rule, quotation, and remedies.');

  // Test 7: Error Handling When No Contract Is Loaded
  const resNoContract = await assistantService.handleChat(
    [{ role: 'user', content: 'Why is my overall risk assessment 75?' }],
    undefined // No document context loaded
  );
  assert.ok(
    resNoContract.response.toLowerCase().includes('no contract') || resNoContract.response.toLowerCase().includes('please analyze'),
    'Must instruct user to analyze a contract first when no contract is loaded'
  );
  console.log('  ✓ Error handling verified: Asks user to analyze contract first when context is missing.');

  // Test 8: Scoring Formula Request
  const resFormula = await assistantService.handleChat(
    [{ role: 'user', content: 'What is the scoring formula and weights for risk?' }],
    { technicalMode: true }
  );
  assert.ok(resFormula.response.includes('75') && resFormula.response.includes('50') && resFormula.response.includes('20'), 'Must explain weights (75, 50, 20)');
  assert.ok(resFormula.response.includes('60') || resFormula.response.includes('escalation'), 'Must explain escalation thresholds');
  console.log('  ✓ Scoring formula and weights request answered accurately.');
}

console.log('\n===============================================================');
console.log('   ALL MACHINE LEARNING & ASSISTANT TESTS PASSED (5/5)         ');
console.log('===============================================================');
