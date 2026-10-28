import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import mammoth from 'mammoth';
import * as pdfParseModule from 'pdf-parse';
import { aokService } from './src/server/aokDatasetService';
import { clauseClassifier } from './src/ml/clauseClassifier';
import { assistantService } from './src/server/assistantService';
import { calculateRiskScoreBreakdown } from './src/server/riskScoringService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));
app.use(express.static(path.resolve(__dirname, 'public')));

const rawApiKey = process.env.GEMINI_API_KEY;
const isPlaceholder = !rawApiKey || rawApiKey === 'MY_GEMINI_API_KEY' || rawApiKey.includes('MY_GEMINI') || rawApiKey.trim() === '';
const apiKey = isPlaceholder ? null : rawApiKey;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Endpoint: Extract text from actual uploaded document (PDF, DOCX, TXT)
app.post('/api/extract-text', async (req, res) => {
  try {
    const { base64Data, filename, fileType } = req.body;
    if (typeof base64Data !== 'string' || !base64Data.trim()) {
      return res.status(400).json({ error: 'No document data provided' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(413).json({
        error: 'Document exceeds the 25MB limit. Please upload a smaller file.'
      });
    }

    let extractedText = '';
    const lowerName = typeof filename === 'string' ? filename.toLowerCase() : '';
    const isPdf = lowerName.endsWith('.pdf') || fileType === 'application/pdf';
    const isDocx = lowerName.endsWith('.docx')
      || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isText = lowerName.endsWith('.txt')
      || lowerName.endsWith('.md')
      || (typeof fileType === 'string' && fileType.startsWith('text/'));

    if (!isPdf && !isDocx && !isText) {
      return res.status(415).json({
        error: 'Unsupported document type. Please upload a PDF, DOCX, TXT, or Markdown file.'
      });
    }

    // 1. PDF parsing
    if (isPdf) {
      try {
        const uint8 = new Uint8Array(buffer);
        let pdfText = '';

        if (pdfParseModule.PDFParse) {
          const parser = new pdfParseModule.PDFParse({ data: uint8 });
          const textResult = await parser.getText();
          pdfText = textResult?.text || '';
        } else if (typeof (pdfParseModule as any).default === 'function') {
          const parsed = await (pdfParseModule as any).default(buffer);
          pdfText = parsed?.text || '';
        }

        if (!pdfText || !pdfText.trim()) {
          return res.json({
            text: '',
            isScanned: true,
            warning: 'This PDF appears to be a scanned image or non-selectable raster document with no digital text layer. LexiGuard requires selectable text. Please upload a searchable PDF or convert it with OCR.'
          });
        }
        extractedText = pdfText;
      } catch (pdfErr: any) {
        console.error('PDF parsing error:', pdfErr);
        return res.status(422).json({
          error: 'Failed to extract text from this PDF file. It may be corrupted, encrypted, or password protected: ' + (pdfErr.message || '')
        });
      }
    }
    // 2. DOCX parsing
    else if (isDocx) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || '';
        if (!extractedText.trim()) {
          return res.status(422).json({
            error: 'No readable text found in this Word document. Please ensure the document is not empty.'
          });
        }
      } catch (docxErr: any) {
        console.error('DOCX parsing error:', docxErr);
        return res.status(422).json({
          error: 'Failed to parse Word document: ' + (docxErr.message || 'Corrupted DOCX')
        });
      }
    }
    // 3. Plain Text / Markdown
    else {
      extractedText = buffer.toString('utf-8');
      if (!extractedText.trim()) {
        return res.status(422).json({ error: 'The uploaded text file is empty.' });
      }
    }

    const charCount = extractedText.length;
    const wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;

    return res.json({
      text: extractedText,
      charCount,
      wordCount,
      filename,
      fileType: fileType || 'text/plain'
    });
  } catch (error: any) {
    console.error('Extraction error:', error);
    return res.status(500).json({ error: error.message || 'Internal error extracting document' });
  }
});

// AOK Beta Dataset Endpoints
app.get('/api/dataset/status', (_req, res) => {
  res.json(aokService.getStatus());
});

app.get('/api/dataset/categories', (_req, res) => {
  res.json(aokService.getAllCategories());
});

app.get('/api/dataset/search', (req, res) => {
  const query = (req.query.q as string) || '';
  const category = (req.query.category as string) || '';
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 8));
  res.json(aokService.searchClauses(query, category, limit));
});

app.get('/api/dataset/evaluation', (_req, res) => {
  res.json(aokService.evaluateModel());
});

// Comprehensive Dataset Explorer Endpoint (Schema, Dimensions, Sample Records, Audit)
app.get('/api/dataset/explorer', (_req, res) => {
  try {
    const explorerData = aokService.getDatasetExplorerData();
    res.json(explorerData);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch dataset explorer data' });
  }
});

// Downloadable Formal ML Project Report PDF Endpoint
app.get('/api/ml/download-report', (_req, res) => {
  const pdfPath = path.resolve(__dirname, 'public', 'LexiGuard_ML_Project_Report.pdf');
  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({
      error: 'Project report PDF has not been generated yet. Run npm run report:pdf to build it.'
    });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="LexiGuard_ML_Project_Report.pdf"');
  res.sendFile(pdfPath);
});

// Machine Learning Evaluation Metrics & Benchmark Endpoint
app.get('/api/ml/evaluation', (_req, res) => {
  try {
    const resultsPath = path.resolve(__dirname, 'data', 'traditional_ml_results.json');
    if (!fs.existsSync(resultsPath)) {
      return res.status(404).json({ error: 'Traditional ML evaluation results not found.' });
    }
    const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to read ML evaluation results' });
  }
});

// Machine Learning Real-Time Clause Classification Endpoint
app.post('/api/ml/classify', (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Please provide a clause string in the "text" field.' });
    }
    const result = clauseClassifier.classifyClause(text);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to classify clause text' });
  }
});

// AI Doubt Assistant Endpoint (Server-Side Gemini with Grounded Fallback)
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of messages with role and content.' });
    }
    const result = await assistantService.handleChat(messages, context, ai);
    res.json(result);
  } catch (err: any) {
    console.error('Assistant endpoint error:', err);
    res.status(500).json({ error: err.message || 'Assistant request failed' });
  }
});

app.post('/api/dataset/upload', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
  try {
    const rawBuffer = req.body;
    if (!rawBuffer || rawBuffer.length < 100) {
      return res.status(400).json({ error: 'Uploaded file is empty.' });
    }
    const destPath = path.resolve(__dirname, 'data', 'aok_dataset', 'master_clauses.csv');
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, rawBuffer);
    const success = aokService.init();
    return res.json({
      success,
      message: success ? 'Dataset imported and indexed successfully.' : 'Failed to parse dataset format.',
      status: aokService.getStatus()
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update dataset file' });
  }
});

// Grounded fallback analyzer when Gemini API is unavailable or times out
function analyzeWithGroundedHeuristics(docText: string, filename: string, contractTypeHint?: string) {
  const paragraphs = docText
    .split(/\n{2,}|\r\n\r\n/)
    .map(p => p.trim())
    .filter(p => p.length > 25);

  const lowerDoc = docText.toLowerCase();

  // Infer or use contract type
  let contractType = contractTypeHint || 'General Commercial Agreement';
  if (!contractTypeHint) {
    if (lowerDoc.includes('terms of service') || lowerDoc.includes('terms of use')) contractType = 'Terms of Service (ToS)';
    else if (lowerDoc.includes('privacy policy') || lowerDoc.includes('privacy notice')) contractType = 'Privacy Policy';
    else if (lowerDoc.includes('end user license') || lowerDoc.includes('eula')) contractType = 'End User License Agreement (EULA)';
    else if (lowerDoc.includes('subscription agreement') || lowerDoc.includes('subscriber agreement')) contractType = 'Subscription & Billing Agreement';
    else if (lowerDoc.includes('non-disclosure') || lowerDoc.includes('confidentiality agreement')) contractType = 'Non-Disclosure Agreement (NDA)';
    else if (lowerDoc.includes('employment agreement') || lowerDoc.includes('independent contractor')) contractType = 'Employment & Contractor Agreement';
  }

  const clauses: any[] = [];
  let clauseNumber = 1;

  // Pattern library for extracting actual matching text in simple, everyday English
  const patterns = [
    {
      category: 'Dispute Resolution & Court Access',
      keywords: ['arbitration', 'dispute resolution', 'class action waiver', 'waive jury trial', 'american arbitration association'],
      risk: 'High' as const,
      riskScore: 85,
      title: 'Mandatory Arbitration and No Court Rights',
      whatDoesThisMean: 'If you have a disagreement with the company, you cannot take them to regular court or join a group lawsuit with other customers. You must hire an independent arbitrator to decide the case privately.',
      howCouldThisAffectYou: 'You lose your right to a judge or jury trial. Hiring an arbitrator can be expensive, and arbitration decisions are almost impossible to appeal.',
      potentialRiskLabel: 'High Risk' as const,
      riskReason: 'This clause could create a serious problem or significant financial or legal responsibility. It removes your normal constitutional right to go to court.',
      whatShouldYouDo: 'Check if you can opt out in writing within 30 days of signing up, or ask to keep the right to use your local small-claims court.',
      exampleIllustration: 'Imagine the company charges you an unauthorized $300 fee. Under this clause, you cannot file a claim in your town’s small claims court or join other affected users; you must pay an arbitrator to review your individual case.',
      suggestedRevision: 'Ask to add: "Either party may bring an individual claim in small claims court, or opt out of arbitration within thirty (30) days in writing."',
      lawyerQuestions: [
        'Does the agreement specify who pays the arbitration costs?',
        'Can I opt out in writing within thirty days?'
      ]
    },
    {
      category: 'Subscription & Renewal',
      keywords: ['auto-renew', 'automatically renew', 'recurring payment', 'billing cycle', 'continuous subscription', 'prior to the end of the current'],
      risk: 'High' as const,
      riskScore: 78,
      title: 'Automatic Renewal and Continuous Billing',
      whatDoesThisMean: 'Your agreement will renew automatically when it expires. You might need to cancel it before a deadline if you do not want to continue paying.',
      howCouldThisAffectYou: 'Your credit card or bank account will keep being charged without asking you each time. If you forget to cancel before the deadline, you might not get a refund.',
      potentialRiskLabel: 'High Risk' as const,
      riskReason: 'This clause could create unexpected recurring charges and financial responsibility if you miss the cancellation window.',
      whatShouldYouDo: 'Set a reminder in your calendar at least a week before the cancellation deadline, and check how many days in advance you are required to cancel.',
      exampleIllustration: 'Imagine you sign up for a one-year subscription with a 48-hour cancellation rule. If you cancel 24 hours before the year ends, the company will still charge you for another full year with no refund.',
      suggestedRevision: 'Request that the company send an email reminder 14 days before each renewal and offer a simple one-click cancellation button.',
      lawyerQuestions: [
        'How many days before renewal must I submit my cancellation?',
        'Am I entitled to a pro-rated refund if I cancel shortly after a renewal charge?'
      ]
    },
    {
      category: 'Company Liability Caps',
      keywords: ['limitation of liability', 'in no event shall', 'consequential damages', 'total aggregate liability', 'as is and as available'],
      risk: 'High' as const,
      riskScore: 75,
      title: 'Limits on What the Company Will Pay You',
      whatDoesThisMean: 'If something goes wrong and you lose money or data, the company limits the maximum amount they will pay you, often to a very small dollar amount.',
      howCouldThisAffectYou: 'Even if the company makes a serious mistake or their system fails, you probably cannot recover the real costs or financial damage you suffered.',
      potentialRiskLabel: 'High Risk' as const,
      riskReason: 'This clause places almost all financial risk on you while protecting the company from paying for its own mistakes.',
      whatShouldYouDo: 'Negotiate a fair liability cap, or check whether your business or personal insurance covers losses that the company refuses to pay for.',
      exampleIllustration: 'Imagine a software glitch wipes out your files or causes you to miss a $2,000 work contract. Under this clause, the company might only refund you $50 or one month of subscription fees.',
      suggestedRevision: 'Add standard exceptions so the cap does not apply if the company commits gross negligence, loses your confidential data, or breaks privacy laws.',
      lawyerQuestions: [
        'Is this liability cap enforceable in our jurisdiction?',
        'Can we make the liability limit mutual so both sides have equal protection?'
      ]
    },
    {
      category: 'Data & Privacy',
      keywords: ['share your information', 'third-party partners', 'marketing partners', 'sell your personal information', 'commercial partners', 'advertising networks'],
      risk: 'Medium' as const,
      riskScore: 68,
      title: 'Sharing Your Personal Information With Other Companies',
      whatDoesThisMean: 'The company may share or sell details about you, your account, or how you use the service to marketing partners and advertising companies.',
      howCouldThisAffectYou: 'You may receive targeted marketing or unsolicited emails, and your personal data will be stored on other companies’ servers where you cannot control it.',
      potentialRiskLabel: 'Medium Risk' as const,
      riskReason: 'This clause could cause privacy problems or confusion about who has access to your personal information.',
      whatShouldYouDo: 'Check the privacy settings on your account, turn off third-party data sharing if available, or ask the company not to share your information for marketing.',
      exampleIllustration: 'Imagine you sign up using your email and phone number. Under this clause, their advertising partners may contact you with promotional offers based on what you view in the app.',
      suggestedRevision: 'Request language specifying that your personal data will only be used to provide the service and never sold or shared for advertising.',
      lawyerQuestions: [
        'How can I submit an official request to delete my data from partner databases?',
        'Does the company encrypt our data while stored and during transfers?'
      ]
    },
    {
      category: 'Changes to Agreement',
      keywords: ['modify these terms', 'right to change', 'at our sole discretion', 'continued use constitutes acceptance', 'update this agreement'],
      risk: 'Medium' as const,
      riskScore: 60,
      title: 'The Company Changing the Rules Without Your Agreement',
      whatDoesThisMean: 'The company can change the agreement, rules, or prices at any time. Continuing to use the service means you automatically agree to the new terms.',
      howCouldThisAffectYou: 'Prices could go up or rules could change without you noticing, and you will be held to the new terms just by logging in or keeping your account open.',
      potentialRiskLabel: 'Medium Risk' as const,
      riskReason: 'This clause allows the other party to alter your deal without requiring your direct, written agreement.',
      whatShouldYouDo: 'Ask for written notice by email at least 30 days before any major changes, and confirm that you can cancel penalty-free if you dislike the new rules.',
      exampleIllustration: 'Imagine the company decides to charge extra for features that used to be free. Under this clause, they can simply post the update on their website and start charging next month.',
      suggestedRevision: 'Add: "Provider will send 30 days advance written notice of any material price or terms changes. If Customer disagrees, Customer may cancel with a pro-rated refund."',
      lawyerQuestions: [
        'Does the law in our area require individual notice before price hikes?',
        'Can continuing to use an app count as agreeing to brand-new terms?'
      ]
    },
    {
      category: 'Ending the Agreement',
      keywords: ['terminate your account', 'suspend or terminate', 'at any time for any reason', 'without notice or liability', 'immediate termination'],
      risk: 'Medium' as const,
      riskScore: 58,
      title: 'Ending Your Account Without Prior Warning',
      whatDoesThisMean: 'The other party may be able to end the agreement or shut down your account without your approval and without advance notice.',
      howCouldThisAffectYou: 'You could suddenly lose access to your account, services, or stored information without time to save or back up your files.',
      potentialRiskLabel: 'Medium Risk' as const,
      riskReason: 'This clause could cause sudden disruption if the other party cuts off your service without a grace period.',
      whatShouldYouDo: 'Regularly download copies of your important data, and ask for at least 14 days advance written notice before any non-urgent account closure.',
      exampleIllustration: 'Imagine you store work documents in the service. Under this clause, the company could suspend your account tomorrow, leaving you unable to retrieve your files for an important deadline.',
      suggestedRevision: 'Add: "Provider will provide at least fourteen (14) days prior notice and a window to export customer data before terminating any non-breaching account."',
      lawyerQuestions: [
        'Can I retrieve my files if my account is closed?',
        'Is there a formal process to appeal an accidental account suspension?'
      ]
    },
    {
      category: 'Ownership & Content',
      keywords: ['grant us a license', 'royalty-free', 'perpetual, worldwide', 'irrevocable license', 'user content', 'sub-license'],
      risk: 'Medium' as const,
      riskScore: 55,
      title: 'Permission to Use Your Work and Files',
      whatDoesThisMean: 'While you still own your work, you give the company broad permission to copy, display, share, or use your files and ideas without paying you.',
      howCouldThisAffectYou: 'The company might use your feedback, images, or documents for marketing or to train computer models without asking for your permission again.',
      potentialRiskLabel: 'Medium Risk' as const,
      riskReason: 'This clause grants wide permissions over things you create, which may go beyond what is strictly necessary to run the service.',
      whatShouldYouDo: 'Make sure the permission is limited only to running the service for you, and not for public marketing or artificial intelligence training.',
      exampleIllustration: 'Imagine you upload a design or business plan. Under this clause, the service provider might have permission to showcase your design on their homepage or use it to test their algorithms.',
      suggestedRevision: 'Add: "Provider may only use User Content as strictly necessary to deliver the service to Customer."',
      lawyerQuestions: [
        'Does the company claim the right to train artificial intelligence models on my content?',
        'Does their permission to use my files end when I delete my account?'
      ]
    }
  ];

  // Match actual paragraphs from the uploaded document
  const foundTitles = new Set<string>();

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const paraLower = para.toLowerCase();

    for (const pat of patterns) {
      if (foundTitles.has(pat.title)) continue;
      const matchedKw = pat.keywords.find(kw => paraLower.includes(kw));
      if (matchedKw) {
        foundTitles.add(pat.title);
        const mlClass = clauseClassifier.classifyClause(para);
        clauses.push({
          id: `clause-${clauseNumber}`,
          clauseNumber: clauseNumber++,
          title: pat.title,
          category: pat.category,
          mlPredictedCategory: mlClass.predictedCategory,
          mlConfidence: mlClass.confidence,
          mlModelUsed: mlClass.modelUsed,
          mlProbabilities: mlClass.probabilities,
          mlTopFeatures: mlClass.topFeatures,
          riskLevel: pat.potentialRiskLabel,
          riskScore: pat.riskScore,
          whatDoesItSay: para, // EXACT sentence/paragraph quoted from user's document
          exactQuotation: para,
          whatDoesThisMean: pat.whatDoesThisMean,
          plainEnglish: pat.whatDoesThisMean,
          howCouldThisAffectYou: pat.howCouldThisAffectYou,
          potentialConsequences: pat.howCouldThisAffectYou,
          potentialRiskLabel: pat.potentialRiskLabel,
          riskReason: pat.riskReason,
          whatShouldYouDo: pat.whatShouldYouDo,
          suggestedRevision: pat.suggestedRevision,
          exampleIllustration: pat.exampleIllustration,
          questionsForLawyer: pat.lawyerQuestions,
          sourceLocation: `Paragraph ${i + 1}`,
          highlightedTerms: [matchedKw]
        });
        break;
      }
    }
  }

  // If no high-risk patterns detected, segment first notable paragraphs as standard operational clauses
  if (clauses.length === 0) {
    paragraphs.slice(0, 3).forEach((p, idx) => {
      const mlClass = clauseClassifier.classifyClause(p);
      clauses.push({
        id: `clause-${clauseNumber}`,
        clauseNumber: clauseNumber++,
        title: `Agreement Term ${idx + 1}`,
        category: mlClass.predictedCategory || 'General Terms',
        mlPredictedCategory: mlClass.predictedCategory,
        mlConfidence: mlClass.confidence,
        mlModelUsed: mlClass.modelUsed,
        mlProbabilities: mlClass.probabilities,
        mlTopFeatures: mlClass.topFeatures,
        riskLevel: 'Low Risk',
        riskScore: 20,
        whatDoesItSay: p,
        exactQuotation: p,
        whatDoesThisMean: 'This is a standard term setting general rules for using the service and fulfilling basic obligations.',
        plainEnglish: 'This is a standard term setting general rules for using the service and fulfilling basic obligations.',
        howCouldThisAffectYou: 'Sets normal expectations; no unusual financial or legal burden was identified from this text.',
        potentialConsequences: 'Sets normal expectations; no unusual financial or legal burden was identified from this text.',
        potentialRiskLabel: 'Low Risk',
        riskReason: 'No major concern was identified from the available text, but you should still understand the clause.',
        whatShouldYouDo: 'Read through to make sure the stated rules match how you plan to use the service.',
        suggestedRevision: 'Ensure alignment with your personal or business workflow.',
        exampleIllustration: 'Imagine you are setting up your profile. This clause reminds you to provide accurate contact information.',
        questionsForLawyer: ['Are there any unusual requirements in this general section?'],
        sourceLocation: `Paragraph ${idx + 1}`,
        highlightedTerms: []
      });
    });
  }

  // Check for Missing or Unclear Clauses in the uploaded document
  const missingOrUnclearClauses = [
    {
      id: 'missing-1',
      title: 'Security Incident & Data Breach Notification',
      severity: 'High' as const,
      status: (!lowerDoc.includes('breach notification') && !lowerDoc.includes('security incident within'))
        ? ('Not found in the provided text' as const)
        : ('Vague or ambiguous in document' as const),
      description: 'The agreement lacks a binding timeline (e.g. 48–72 hours) requiring the provider to notify you if your confidential data or personal information is compromised.',
      potentialRisk: 'In the event of a ransomware or credential breach, your organization may suffer prolonged exposure without legal notification.',
      suggestedAddition: 'Add: "In the event of any confirmed or suspected unauthorized access to customer data, Provider shall notify Customer in writing within 48 hours and furnish full forensic remediation details."'
    },
    {
      id: 'missing-2',
      title: 'Mutual Termination for Convenience & Grace Period',
      severity: 'Medium' as const,
      status: (!lowerDoc.includes('termination for convenience') && !lowerDoc.includes('thirty (30) days notice to terminate'))
        ? ('Not found in the provided text' as const)
        : ('Vague or ambiguous in document' as const),
      description: 'The agreement does not grant the user a balanced right to exit the contract on 30 days notice without financial penalties.',
      potentialRisk: 'Locks the customer into paying the full remaining balance even if the service quality deteriorates or business requirements change.',
      suggestedAddition: 'Add: "Customer may terminate this Agreement without cause upon thirty (30) days prior written notice, subject only to pro-rated settlement of services rendered."'
    },
    {
      id: 'missing-3',
      title: 'Clear Data Deletion & Cryptographic Return Guarantee',
      severity: 'Medium' as const,
      status: (!lowerDoc.includes('permanent deletion') && !lowerDoc.includes('cryptographic erasure'))
        ? ('Not found in the provided text' as const)
        : ('Vague or ambiguous in document' as const),
      description: 'No explicit standard is defined for how customer records, files, or training data are permanently scrubbed from backup servers upon contract completion.',
      potentialRisk: 'Residual confidential data may linger indefinitely in vendor archival snapshots.',
      suggestedAddition: 'Add: "Within thirty (30) days following termination, Provider shall certify in writing the permanent cryptographic erasure of all Customer Confidential Information from active and backup storage."'
    }
  ];

  // Calculate scores and transparent breakdown using centralized scoring engine
  const assessment = calculateRiskScoreBreakdown(clauses);
  const {
    overallScore,
    riskLevel,
    scoreExplanation,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    criticalRiskCount,
    scoreBreakdown
  } = assessment;

  // 4 clear plain-English document summary fields
  const whatIsThisAbout = `This document is a ${contractType}. It sets out the rules, payment obligations, and responsibilities for using ${filename}.`;

  const whatAreYouAgreeingTo = [
    'Pay all subscription and recurring fees on time according to the billing schedule.',
    'Follow the rules for using the service and refrain from prohibited activities.',
    'Allow the provider to store and process necessary account data to deliver the service.'
  ];

  const whatToPayAttentionTo = highRiskCount > 0
    ? [
        'Automatic renewal charges that recur unless cancelled before the deadline.',
        'Restrictions on your right to go to regular court or join class lawsuits.',
        'Strict limits on what the company will pay you if something goes wrong.'
      ]
    : [
        'Deadlines and requirements for changing or cancelling your account.',
        'How your contact details and usage information are handled.',
        'Rules regarding service updates and modification notices.'
      ];

  const whatToDoBeforeSigning = [
    'Check the cancellation deadline and put a reminder in your calendar.',
    'Ask the other party to explain any terms or fees that are not completely clear.',
    'Confirm that you can export or retrieve your files if the service ends.',
    'Consult a qualified lawyer if the agreement involves significant money or legal commitments.'
  ];

  return {
    contractType,
    primaryPurpose: `Governs customer rights, billing rules, data processing practices, and legal dispute mechanisms for ${filename}.`,
    partiesOrScope: 'Agreement between the Service Provider and the purchasing or registering Customer.',
    executiveSummary: `Analyzed ${paragraphs.length} paragraphs in ${filename}. Extracted ${clauses.length} key operational and risk clauses, accompanied by ${missingOrUnclearClauses.length} critical missing clause checks.`,
    whatIsThisAbout,
    whatAreYouAgreeingTo,
    whatToPayAttentionTo,
    whatToDoBeforeSigning,
    overallScore,
    riskLevel,
    scoreExplanation,
    clauses,
    missingOrUnclearClauses,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    criticalRiskCount,
    scoreBreakdown
  };
}

// Endpoint: AI-Powered Document Analysis using Gemini 3.8 Flash
app.post('/api/analyze', async (req, res) => {
  try {
    const { text, filename, fileType, fileSize, inputSource, contractTypeHint } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Submitted legal text is empty. Please upload a file or paste legal content.' });
    }

    const cleanText = text.trim();
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    const isDirectText = inputSource === 'direct_text';
    const computedName = filename || (isDirectText
      ? (contractTypeHint ? `${contractTypeHint} (Pasted Excerpt)` : 'Direct Legal Text')
      : 'Uploaded_Document.pdf');

    const formattedSize = fileSize
      ? (fileSize < 1024 * 1024 ? `${(fileSize / 1024).toFixed(1)} KB` : `${(fileSize / (1024 * 1024)).toFixed(2)} MB`)
      : `${Math.max(1, Math.round(Buffer.byteLength(cleanText, 'utf8') / 1024))} KB`;

    const documentMeta = {
      name: computedName,
      sizeBytes: fileSize || Buffer.byteLength(cleanText, 'utf8'),
      formattedSize,
      type: fileType || (isDirectText ? 'text/plain' : 'application/pdf'),
      wordCount,
      charCount: cleanText.length,
      uploadedAt: new Date().toISOString(),
      inputSource: (isDirectText ? 'direct_text' : 'file') as 'direct_text' | 'file',
      contractTypeHint: contractTypeHint || undefined,
    };

    // Step 4 of user workflow: Search imported Atticus Open Contract Dataset (AOK Beta) for relevant annotated reference examples
    const aokRetrieval = aokService.findBenchmarkReferencesForText(cleanText);
    const aokBenchmarkData = {
      datasetName: 'Atticus Open Contract Dataset (AOK Beta / CUAD v1)',
      totalBenchmarkContracts: 510,
      totalBenchmarkAnnotations: 13145,
      matchedCategories: aokRetrieval.matchedCategories
    };

    // If Gemini AI client is initialized, analyze the actual document
    if (ai) {
      try {
        const isShortSnippet = wordCount < 120;
        const systemPrompt = `You are LexiGuard, an automated legal clause and risk analyzer.
YOUR MAIN OBJECTIVE:
EVERY RESULT MUST BE WRITTEN IN SIMPLE, CLEAR, EVERYDAY ENGLISH THAT ANYONE CAN UNDERSTAND WITHOUT STUDYING LAW.
Assume the user has no legal knowledge. Explain everything as if you are helping an ordinary person understand an agreement before signing it.

STYLE AND TONE RULES:
1. Use short, clear sentences. Prefer common English words over legal terminology.
2. Avoid complicated legal expressions, technical jargon, and unnecessarily formal language.
3. Explain one idea at a time. Use bullet points for important information.
4. Explain what a clause means in practical, real-life situations. Avoid long paragraphs.
5. Do not use complicated words just to sound professional. Never sacrifice accuracy for simplicity.
   Examples of writing style:
   - Instead of: "The indemnification provision imposes potentially expansive financial liability on the indemnifying party."
     Write: "This clause may require you to pay for certain losses or legal costs caused by a problem. Depending on how it is written, you could end up paying a large amount."
   - Instead of: "The agreement contains an automatic renewal provision."
     Write: "Your agreement may renew automatically when it expires. You might need to cancel it before a deadline if you do not want to continue."
   - Instead of: "The termination provision grants unilateral discretion."
     Write: "The other party may be able to end the agreement without your approval."

6. RISK RATING LABELS AND DEFINITIONS:
   Use EXACTLY one of these four labels for each clause:
   - "High Risk": This clause could create a serious problem or significant financial or legal responsibility. Review it carefully before agreeing.
   - "Medium Risk": This clause could cause problems or confusion. Ask questions or consider requesting a change.
   - "Low Risk": No major concern was identified from the available text, but you should still understand the clause.
   - "Not Enough Information": There is not enough information to judge this clause reliably.
   Do not automatically label a clause risky just because it appears in a legal contract or in the dataset.

7. GROUNDING: Ground every finding strictly in the user's provided text. Quote exact sentences from the user's document for whatDoesItSay.

Output a valid JSON object matching the requested schema.`;

        const userPrompt = `Please analyze this submitted legal content using simple, everyday English:
Submission Method: ${isDirectText ? 'Direct Text Input (Pasted by user)' : 'Uploaded Document File'}
Document/Snippet Name: ${documentMeta.name}
${contractTypeHint ? `User-Selected Agreement Type: ${contractTypeHint}` : ''}
Word Count: ${wordCount.toLocaleString()} words (${cleanText.length.toLocaleString()} characters)

Submitted Legal Content:
"""
${cleanText.slice(0, 200000)}
"""

${aokRetrieval.benchmarkContext}`;

        const generatePromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                contractType: { type: Type.STRING, description: 'Specific type of contract in plain words (e.g., Software Subscription Agreement, Service Agreement, NDA)' },
                whatIsThisAbout: { type: Type.STRING, description: 'What is this document about? Explain its purpose in 2 or 3 simple sentences.' },
                whatAreYouAgreeingTo: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'What are you agreeing to? List 3-4 main responsibilities of each party in bullet points.'
                },
                whatToPayAttentionTo: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'What should you pay attention to? Highlight 3-4 most important concerns.'
                },
                whatToDoBeforeSigning: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'What should you do before signing? Give a short checklist of 3-4 practical actions.'
                },
                overallScore: { type: Type.INTEGER, description: 'Overall risk score from 0 (very safe) to 100 (high risk)' },
                riskLevel: { type: Type.STRING, description: 'One of: High Risk, Medium Risk, Low Risk' },
                scoreExplanation: { type: Type.STRING, description: 'Simple explanation of why this risk score was given' },
                clauses: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      clauseNumber: { type: Type.INTEGER },
                      title: { type: Type.STRING, description: 'Short plain-English title of the clause' },
                      category: { type: Type.STRING },
                      whatDoesItSay: { type: Type.STRING, description: 'Quote the exact relevant sentence verbatim from the user document.' },
                      whatDoesThisMean: { type: Type.STRING, description: 'Explain the clause in one to three short sentences using everyday English.' },
                      howCouldThisAffectYou: { type: Type.STRING, description: 'Describe a realistic consequence for the reader. If uncertain, say so.' },
                      potentialRiskLabel: { type: Type.STRING, description: 'Must be one of: High Risk, Medium Risk, Low Risk, Not Enough Information' },
                      riskReason: { type: Type.STRING, description: 'Explain the reason for the rating in simple language.' },
                      whatShouldYouDo: { type: Type.STRING, description: 'Give a practical next step (e.g. asking for clarification, checking a deadline, negotiating a change, or consulting a qualified lawyer).' },
                      exampleIllustration: { type: Type.STRING, description: 'A short relatable example explaining the clause, clearly understandable as an illustration.' },
                      questionsForLawyer: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: '2-3 practical questions the user could ask before agreeing.'
                      },
                      sourceLocation: { type: Type.STRING, description: 'e.g., Section 5, Paragraph 2, or Submitted Excerpt' }
                    },
                    required: ['clauseNumber', 'title', 'category', 'whatDoesItSay', 'whatDoesThisMean', 'howCouldThisAffectYou', 'potentialRiskLabel', 'riskReason', 'whatShouldYouDo', 'exampleIllustration']
                  }
                },
                missingOrUnclearClauses: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      severity: { type: Type.STRING, description: 'High, Medium, or Low' },
                      status: { type: Type.STRING, description: 'Not found in the provided text OR Vague or ambiguous in document' },
                      description: { type: Type.STRING, description: 'Why this protection is missing or unclear' },
                      potentialRisk: { type: Type.STRING, description: 'Risk of not having this term defined' },
                      suggestedAddition: { type: Type.STRING, description: 'Recommended protective text to add in plain language' }
                    },
                    required: ['title', 'severity', 'status', 'description', 'potentialRisk', 'suggestedAddition']
                  }
                },
                recommendations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      priority: { type: Type.INTEGER },
                      riskLevel: { type: Type.STRING },
                      relatedClauseTitle: { type: Type.STRING },
                      relatedClauseNumber: { type: Type.INTEGER },
                      reasonForPrioritization: { type: Type.STRING },
                      suggestedNextStep: { type: Type.STRING },
                      negotiationTip: { type: Type.STRING }
                    },
                    required: ['priority', 'riskLevel', 'relatedClauseTitle', 'reasonForPrioritization', 'suggestedNextStep']
                  }
                }
              },
              required: ['contractType', 'whatIsThisAbout', 'whatAreYouAgreeingTo', 'whatToPayAttentionTo', 'whatToDoBeforeSigning', 'overallScore', 'riskLevel', 'scoreExplanation', 'clauses']
            }
          }
        });

        // 45-second timeout gives Gemini ample time for comprehensive analysis
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI generation timed out')), 45000)
        );

        const response: any = await Promise.race([generatePromise, timeoutPromise]);
        const parsed = response.text ? JSON.parse(response.text) : null;

        if (parsed && Array.isArray(parsed.clauses) && parsed.clauses.length > 0) {
          let highCount = 0;
          let medCount = 0;
          let lowCount = 0;
          let unkCount = 0;

          const clauses = parsed.clauses.map((c: any, idx: number) => {
            const rawLvl = (c.potentialRiskLabel || c.riskLevel || 'Medium Risk').toLowerCase();
            let normLvl: 'High Risk' | 'Medium Risk' | 'Low Risk' | 'Not Enough Information' = 'Medium Risk';
            if (rawLvl.includes('not enough') || rawLvl.includes('insufficient')) {
              normLvl = 'Not Enough Information';
              unkCount++;
            } else if (rawLvl.includes('high') || rawLvl.includes('critical')) {
              normLvl = 'High Risk';
              highCount++;
            } else if (rawLvl.includes('low')) {
              normLvl = 'Low Risk';
              lowCount++;
            } else {
              normLvl = 'Medium Risk';
              medCount++;
            }

            const quote = c.whatDoesItSay || c.exactQuotation || cleanText.slice(0, 300);
            const simpleMeaning = c.whatDoesThisMean || c.plainEnglish || 'Standard operational terms.';
            const consequences = c.howCouldThisAffectYou || c.potentialConsequences || 'May affect your usage rights.';
            const action = c.whatShouldYouDo || c.suggestedRevision || 'Review with the other party or a qualified lawyer.';

            // Actual Machine Learning Classification (Strictly separated from risk rating)
            const mlClass = clauseClassifier.classifyClause(quote);

            return {
              id: `clause-${idx + 1}`,
              clauseNumber: c.clauseNumber || (idx + 1),
              title: c.title || `Clause ${idx + 1}`,
              category: c.category || mlClass.predictedCategory || 'General Contract Terms',
              mlPredictedCategory: mlClass.predictedCategory,
              mlConfidence: mlClass.confidence,
              mlModelUsed: mlClass.modelUsed,
              mlProbabilities: mlClass.probabilities,
              mlTopFeatures: mlClass.topFeatures,
              riskLevel: normLvl,
              potentialRiskLabel: normLvl,
              riskScore: Number(c.riskScore) || (normLvl === 'High Risk' ? 80 : normLvl === 'Medium Risk' ? 50 : 20),
              whatDoesItSay: quote,
              exactQuotation: quote,
              whatDoesThisMean: simpleMeaning,
              plainEnglish: simpleMeaning,
              howCouldThisAffectYou: consequences,
              potentialConsequences: consequences,
              riskReason: c.riskReason || (normLvl === 'High Risk'
                ? 'This clause could create a serious problem or significant financial or legal responsibility. Review it carefully before agreeing.'
                : normLvl === 'Medium Risk'
                ? 'This clause could cause problems or confusion. Ask questions or consider requesting a change.'
                : 'No major concern was identified from the available text, but you should still understand the clause.'),
              whatShouldYouDo: action,
              suggestedRevision: action,
              exampleIllustration: c.exampleIllustration || 'An illustration of how this clause applies in real life.',
              questionsForLawyer: Array.isArray(c.questionsForLawyer) && c.questionsForLawyer.length > 0
                ? c.questionsForLawyer
                : ['Can we ask for clarification or more balanced terms on this clause?'],
              sourceLocation: c.sourceLocation || (isShortSnippet ? 'Submitted Excerpt' : `Section ${idx + 1}`),
              highlightedTerms: []
            };
          });

          const missingOrUnclearClauses = (parsed.missingOrUnclearClauses || []).map((m: any, idx: number) => ({
            id: `missing-${idx + 1}`,
            title: m.title || 'Standard Legal Protection',
            severity: (m.severity === 'High' || m.severity === 'Low') ? m.severity : 'Medium',
            status: m.status || (isShortSnippet ? 'Not found in the provided text' : 'Not found in the provided text'),
            description: m.description || (isShortSnippet
              ? 'This standard agreement safeguard was not identified in the submitted excerpt.'
              : 'This protective clause was not identified in the uploaded document.'),
            potentialRisk: m.potentialRisk || 'Leaves you without explicit written protection in this area.',
            suggestedAddition: m.suggestedAddition || 'Consider requesting this protective clause be added before signing.'
          }));

          // Prioritized recommendations with improvements & negotiation tips
          const recommendations = (parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0)
            ? parsed.recommendations.map((r: any, idx: number) => ({
                id: `rec-${idx + 1}`,
                priority: r.priority || idx + 1,
                riskLevel: (r.riskLevel || 'High Risk') as any,
                relatedClauseNumber: r.relatedClauseNumber || (idx + 1),
                relatedClauseTitle: r.relatedClauseTitle || clauses[idx]?.title || 'Key Contract Term',
                reasonForPrioritization: r.reasonForPrioritization || 'Important term requiring your review.',
                suggestedNextStep: r.suggestedNextStep || clauses[idx]?.whatShouldYouDo || 'Propose balanced wording.',
                negotiationTip: r.negotiationTip || 'Ask the other party for 30 days notice or mutual rights.'
              }))
            : clauses
                .filter((c: any) => c.riskLevel === 'High Risk' || c.riskLevel === 'Medium Risk')
                .slice(0, 4)
                .map((c: any, idx: number) => ({
                  id: `rec-${idx + 1}`,
                  priority: idx + 1,
                  riskLevel: c.riskLevel,
                  relatedClauseNumber: c.clauseNumber,
                  relatedClauseTitle: c.title,
                  reasonForPrioritization: c.howCouldThisAffectYou || `Potential concern detected in ${c.title}.`,
                  suggestedNextStep: c.whatShouldYouDo || 'Ask for clear, mutual wording.',
                  negotiationTip: `Ask: "${c.questionsForLawyer?.[0] || 'Can we make this requirement mutual?'}"`
                }));

          const aiAssessment = calculateRiskScoreBreakdown(clauses);
          if (parsed.scoreExplanation) aiAssessment.scoreExplanation = parsed.scoreExplanation;
          if (parsed.riskLevel) aiAssessment.riskLevel = parsed.riskLevel;
          if (parsed.overallScore !== undefined && !isNaN(Number(parsed.overallScore))) {
            aiAssessment.overallScore = Math.min(100, Math.max(0, Number(parsed.overallScore)));
          }

          return res.json({
            id: 'analysis-' + Date.now(),
            documentMeta,
            documentSummary: {
              contractType: parsed.contractType || (contractTypeHint || 'Legal Agreement'),
              primaryPurpose: parsed.whatIsThisAbout || parsed.primaryPurpose || 'Commercial or personal legal agreement',
              partiesOrScope: Array.isArray(parsed.whatAreYouAgreeingTo) ? parsed.whatAreYouAgreeingTo.join(' ') : (parsed.partiesOrScope || 'Parties to the agreement'),
              executiveSummary: parsed.whatIsThisAbout || parsed.executiveSummary || parsed.scoreExplanation,
              whatIsThisAbout: parsed.whatIsThisAbout || `This document is a ${parsed.contractType || 'contract'}. It sets out the rules, payment terms, and responsibilities of the parties.`,
              whatAreYouAgreeingTo: Array.isArray(parsed.whatAreYouAgreeingTo) && parsed.whatAreYouAgreeingTo.length > 0
                ? parsed.whatAreYouAgreeingTo
                : ['Follow the terms stated in the agreement.', 'Pay agreed amounts on time.', 'Notify the other party before cancelling.'],
              whatToPayAttentionTo: Array.isArray(parsed.whatToPayAttentionTo) && parsed.whatToPayAttentionTo.length > 0
                ? parsed.whatToPayAttentionTo
                : ['Check auto-renewal deadlines.', 'Review dispute and refund rules.', 'Understand cancellation policies.'],
              whatToDoBeforeSigning: Array.isArray(parsed.whatToDoBeforeSigning) && parsed.whatToDoBeforeSigning.length > 0
                ? parsed.whatToDoBeforeSigning
                : ['Write down key deadlines.', 'Ask questions about unclear terms.', 'Consult a qualified lawyer if needed.']
            },
            overallAssessment: aiAssessment,
            clauses,
            missingOrUnclearClauses,
            recommendations,
            aokBenchmark: aokBenchmarkData,
            analyzedAt: new Date().toISOString(),
            isAiPowered: true,
            modelUsed: 'gemini-3.8-flash',
            statusMessage: 'AI Analysis Complete · Written in Simple Everyday English'
          });
        }
      } catch (geminiError: any) {
        console.warn('Gemini AI call timed out or failed, utilizing grounded heuristic analyzer:', geminiError?.message);
      }
    }

    // Grounded fallback analysis
    const heuristic = analyzeWithGroundedHeuristics(cleanText, computedName, contractTypeHint);

    return res.json({
      id: 'analysis-' + Date.now(),
      documentMeta,
      documentSummary: {
        contractType: heuristic.contractType,
        primaryPurpose: heuristic.primaryPurpose,
        partiesOrScope: heuristic.partiesOrScope,
        executiveSummary: heuristic.executiveSummary,
        whatIsThisAbout: heuristic.whatIsThisAbout,
        whatAreYouAgreeingTo: heuristic.whatAreYouAgreeingTo,
        whatToPayAttentionTo: heuristic.whatToPayAttentionTo,
        whatToDoBeforeSigning: heuristic.whatToDoBeforeSigning
      },
      overallAssessment: {
        overallScore: heuristic.overallScore,
        riskLevel: heuristic.riskLevel,
        scoreExplanation: heuristic.scoreExplanation,
        totalClauses: heuristic.clauses.length,
        highRiskCount: heuristic.highRiskCount,
        mediumRiskCount: heuristic.mediumRiskCount,
        lowRiskCount: heuristic.lowRiskCount,
        criticalRiskCount: heuristic.criticalRiskCount,
        scoreBreakdown: heuristic.scoreBreakdown
      },
      clauses: heuristic.clauses,
      missingOrUnclearClauses: heuristic.missingOrUnclearClauses,
      recommendations: heuristic.clauses
        .filter((c: any) => c.riskLevel === 'Critical' || c.riskLevel === 'High' || c.riskLevel === 'Medium')
        .slice(0, 4)
        .map((c: any, idx: number) => ({
          id: `rec-${idx + 1}`,
          priority: idx + 1,
          riskLevel: c.riskLevel,
          relatedClauseNumber: c.clauseNumber,
          relatedClauseTitle: c.title,
          reasonForPrioritization: c.potentialConsequences || 'Elevated contractual risk identified in user content.',
          suggestedNextStep: c.suggestedRevision || 'Propose mutual balanced wording.',
          negotiationTip: `Request that the counterparty match industry standards: "${c.questionsForLawyer?.[0] || 'Can we make this obligation mutual?'}"`
        })),
      aokBenchmark: aokBenchmarkData,
      analyzedAt: new Date().toISOString(),
      isAiPowered: false,
      modelUsed: 'Grounded Contract Heuristic Parser',
      statusMessage: !apiKey
        ? 'Analyzed with Local Legal Heuristics (Configure GEMINI_API_KEY in Secrets for Gemini AI)'
        : 'Heuristic clause analysis (Grounded in uploaded document)'
    });
  } catch (err: any) {
    console.error('Analysis error:', err);
    return res.status(500).json({ error: err.message || 'Failed to analyze uploaded document' });
  }
});

// Start Express server and Vite
async function startServer() {
  // Initialize and index Atticus Open Contract Dataset (AOK Beta)
  aokService.init();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LexiGuard server listening on port ${PORT}`);
  });
}

startServer();
