import assert from 'assert';
import { GoogleGenAI } from '@google/genai';
import {
  AssistantService,
  AssistantMessage,
} from '../src/server/assistantService';

const service = new AssistantService();
const messages: AssistantMessage[] = [
  { role: 'user', content: 'What is the difference between category and risk score?' },
];

console.log('--- Assistant fallback tests (no external API calls) ---');

{
  const result = await service.handleChat(messages, undefined, null);
  assert.strictEqual(result.isAiPowered, false);
  assert.match(result.response, /clause category|risk score/i);
}

{
  const unavailableClient = {
    models: {
      generateContent: async () => {
        throw new Error('mocked provider unavailable');
      },
    },
  } as unknown as GoogleGenAI;
  const result = await service.handleChat(messages, undefined, unavailableClient);
  assert.strictEqual(result.isAiPowered, false);
  assert.match(result.response, /clause category|risk score/i);
}

{
  const timedOutClient = {
    models: {
      generateContent: () => new Promise<never>(() => {}),
    },
  } as unknown as GoogleGenAI;
  const result = await service.handleChat(messages, undefined, timedOutClient);
  assert.strictEqual(result.isAiPowered, false);
  assert.match(result.response, /clause category|risk score/i);
}

console.log('✓ Disabled, unavailable, and timed-out assistant paths use grounded fallback.');
