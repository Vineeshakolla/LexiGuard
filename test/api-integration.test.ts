import assert from 'assert';
import { spawn, ChildProcess } from 'child_process';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';

const ROOT = process.cwd();

async function findAvailablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not allocate an integration-test port.');
  }
  const { port } = address;
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  return port;
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  return new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function waitForServer(
  child: ChildProcess,
  baseUrl: string,
  logs: () => string,
): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) {
      throw new Error(`Test server exited during startup:\n${logs()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/dataset/status`);
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Timed out waiting for the integration test server:\n${logs()}`);
}

function createDocumentFixtures(directory: string): {
  docxPath: string;
  pdfPath: string;
  imagePdfPath: string;
} {
  const docxPath = path.join(directory, 'sample.docx');
  const pdfPath = path.join(directory, 'sample.pdf');
  const imagePdfPath = path.join(directory, 'image-only.pdf');
  const python = String.raw`
import sys, zipfile
from reportlab.pdfgen import canvas
docx_path, pdf_path, image_pdf_path = sys.argv[1:4]
entries = {
    '[Content_Types].xml': b'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>''',
    '_rels/.rels': b'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>''',
    'word/document.xml': b'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>Valid DOCX extraction fixture.</w:t></w:r></w:p>
<w:sectPr/></w:body></w:document>''',
}
with zipfile.ZipFile(docx_path, 'w', zipfile.ZIP_DEFLATED) as docx:
    for name, content in entries.items():
        docx.writestr(name, content)
pdf = canvas.Canvas(pdf_path)
pdf.drawString(72, 720, 'Valid searchable PDF extraction fixture.')
pdf.save()
canvas.Canvas(image_pdf_path).save()
`;
  execFileSync(
    process.env.PYTHON || 'python',
    ['-c', python, docxPath, pdfPath, imagePdfPath],
    { cwd: ROOT, stdio: 'pipe' },
  );
  return { docxPath, pdfPath, imagePdfPath };
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function extractFile(
  baseUrl: string,
  filename: string,
  fileType: string,
  bytes: Buffer,
): Promise<Response> {
  return postJson(`${baseUrl}/api/extract-text`, {
    filename,
    fileType,
    base64Data: bytes.toString('base64'),
  });
}

async function main(): Promise<void> {
  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'server.ts'],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        GEMINI_API_KEY: 'MY_GEMINI_API_KEY',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let serverLogs = '';
  child.stdout?.on('data', chunk => {
    serverLogs = (serverLogs + chunk.toString()).slice(-5000);
  });
  child.stderr?.on('data', chunk => {
    serverLogs = (serverLogs + chunk.toString()).slice(-5000);
  });
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'lexiguard-api-test-'),
  );

  try {
    await waitForServer(child, baseUrl, () => serverLogs);
    const fixtures = createDocumentFixtures(temporaryDirectory);

    const plainText = await extractFile(
      baseUrl, 'plain.txt', 'text/plain', Buffer.from('Plain text fixture.'),
    );
    assert.strictEqual(plainText.status, 200);
    assert.strictEqual((await plainText.json()).text, 'Plain text fixture.');

    const docx = await extractFile(
      baseUrl,
      'sample.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fs.readFileSync(fixtures.docxPath),
    );
    assert.strictEqual(docx.status, 200);
    assert.match((await docx.json()).text, /Valid DOCX extraction fixture/);

    const pdf = await extractFile(
      baseUrl, 'sample.pdf', 'application/pdf', fs.readFileSync(fixtures.pdfPath),
    );
    assert.strictEqual(pdf.status, 200);
    assert.match((await pdf.json()).text, /Valid searchable PDF extraction fixture/);

    const scannedPdf = await extractFile(
      baseUrl,
      'image-only.pdf',
      'application/pdf',
      fs.readFileSync(fixtures.imagePdfPath),
    );
    assert.strictEqual(scannedPdf.status, 200);
    assert.strictEqual((await scannedPdf.json()).isScanned, true);

    const emptyText = await extractFile(
      baseUrl, 'empty.txt', 'text/plain', Buffer.from(''),
    );
    assert.strictEqual(emptyText.status, 400);
    const whitespaceText = await extractFile(
      baseUrl, 'whitespace.txt', 'text/plain', Buffer.from('   \n\t  '),
    );
    assert.strictEqual(whitespaceText.status, 422);
    const unsupported = await extractFile(
      baseUrl, 'unsupported.bin', 'application/octet-stream', Buffer.from([1, 2, 3]),
    );
    assert.strictEqual(unsupported.status, 415);
    const malformedDocx = await extractFile(
      baseUrl, 'broken.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      Buffer.from('not a DOCX'),
    );
    assert.strictEqual(malformedDocx.status, 422);
    const corruptPdf = await extractFile(
      baseUrl, 'broken.pdf', 'application/pdf', Buffer.from('not a PDF'),
    );
    assert.strictEqual(corruptPdf.status, 422);

    const oversizedText = Buffer.alloc(25 * 1024 * 1024 + 1, 0x61);
    const oversized = await extractFile(
      baseUrl, 'oversized.txt', 'text/plain', oversizedText,
    );
    assert.strictEqual(oversized.status, 413);

    const invalidClassification = await postJson(
      `${baseUrl}/api/ml/classify`, {},
    );
    assert.strictEqual(invalidClassification.status, 400);
    const classification = await postJson(`${baseUrl}/api/ml/classify`, {
      text: 'This Agreement is governed by the laws of New York.',
    });
    assert.strictEqual(classification.status, 200);
    const classificationResult = await classification.json();
    assert.ok(
      [
        'Cap On Liability', 'Governing Law', 'Termination For Convenience',
        'Audit Rights', 'Non-Compete', 'Anti-Assignment', 'Insurance',
        'License Grant', 'Renewal Term', 'Notice Period To Terminate Renewal',
        'Ip Ownership Assignment', 'Liquidated Damages',
      ].includes(classificationResult.predictedCategory),
    );
    assert.ok(Number.isFinite(classificationResult.confidence));
    assert.ok(Array.isArray(classificationResult.probabilities));

    const invalidAnalysis = await postJson(`${baseUrl}/api/analyze`, { text: '  ' });
    assert.strictEqual(invalidAnalysis.status, 400);
    const analysis = await postJson(`${baseUrl}/api/analyze`, {
      text: 'Either party may terminate this service agreement with thirty days written notice.',
      inputSource: 'direct_text',
    });
    assert.strictEqual(analysis.status, 200);
    assert.ok(Array.isArray((await analysis.json()).clauses));

    const assistant = await postJson(`${baseUrl}/api/assistant/chat`, {
      messages: [
        { role: 'user', content: 'What is the difference between category and risk score?' },
      ],
    });
    assert.strictEqual(assistant.status, 200);
    assert.strictEqual((await assistant.json()).isAiPowered, false);

    const report = await fetch(`${baseUrl}/api/ml/download-report`);
    assert.strictEqual(report.status, 200);
    assert.match(report.headers.get('content-type') || '', /application\/pdf/);
    assert.ok((await report.arrayBuffer()).byteLength > 1000);

    console.log(
      '✓ API integration passed: TXT/DOCX/searchable PDF, scanned/corrupt files, '
      + 'type/size/empty guards, classification, analysis, assistant fallback, and PDF download.',
    );
  } finally {
    child.kill();
    await waitForExit(child, 3000);
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
