/**
 * ============================================================================
 * FILE: src/server/geminiAnnouncementHandler.js
 * ============================================================================
 * PURPOSE:
 *   Server-side Node handler for parsing unstructured school announcements via
 *   the Google Gemini Interactions API (`gemini-4-hydrogen`) with strict JSON
 *   schema enforcement. Keeps `GEMINI_API_KEY` strictly on the server side.
 *
 * SECURITY INVARIANTS:
 *   - Reads `process.env.GEMINI_API_KEY` exclusively (never `VITE_` client env).
 *   - Never echoes API keys in responses, errors, or logs.
 *   - Enforces request body size limit and validates all structured output
 *     fields before returning to the client.
 * ============================================================================
 */

const GEMINI_INTERACTIONS_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_MODEL = 'gemini-4-hydrogen';
const MAX_BODY_BYTES = 64 * 1024; // 64 KB cap for pasted announcements

const ANNOUNCEMENT_RESPONSE_FORMAT = {
  type: 'text',
  mime_type: 'application/json',
  schema: {
    type: 'object',
    properties: {
      isAnnouncement: { type: 'boolean' },
      reply: { type: 'string' },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            category: { type: 'string' },
            categories: {
              type: 'array',
              items: { type: 'string' },
            },
            deadline: { type: ['string', 'null'] },
            deadlineTime: { type: ['string', 'null'] },
            description: { type: 'string' },
            source: { type: 'string' },
          },
          required: ['title', 'category', 'deadline', 'description', 'source'],
        },
      },
    },
    required: ['isAnnouncement', 'reply', 'tasks'],
  },
};

const VALID_APP_CATEGORIES = new Set([
  'Personal',
  'Urgent',
  'Growth',
  'Academics',
  'Interactive',
  'Social',
]);

/**
 * Extracts raw text output cleanly across Gemini Interactions response formats
 * (`output_text`, `steps` array, or legacy `outputs` array).
 */
export function extractTextFromInteraction(payload) {
  if (!payload || typeof payload !== 'object') return '';

  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload.steps)) {
    const chunks = [];
    for (const step of payload.steps) {
      if (step?.type === 'model_output' && Array.isArray(step.content)) {
        for (const part of step.content) {
          if (part?.type === 'text' && typeof part.text === 'string') {
            chunks.push(part.text);
          }
        }
      }
    }
    if (chunks.length > 0) return chunks.join('').trim();
  }

  if (Array.isArray(payload.outputs)) {
    const chunks = [];
    for (const out of payload.outputs) {
      if (out?.type === 'text' && typeof out.text === 'string') {
        chunks.push(out.text);
      }
    }
    if (chunks.length > 0) return chunks.join('').trim();
  }

  return '';
}

/**
 * Strips accidental markdown code fences if present before JSON parsing.
 */
function parseStructuredJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response received from Gemini API.');
  }
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

/**
 * Sanitizes and normalizes parsed Gemini tasks against strict invariants.
 */
export function sanitizeParsedAnnouncement(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Malformed structured response from Gemini.');
  }

  const isAnnouncement = Boolean(parsed.isAnnouncement);
  const reply =
    typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : isAnnouncement
      ? 'I parsed your announcement.'
      : 'How can I help you with your schedule today?';

  const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const tasks = rawTasks
    .filter((t) => t && typeof t.title === 'string' && t.title.trim())
    .map((t) => {
      const deadlineStr =
        typeof t.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.deadline.trim())
          ? t.deadline.trim()
          : null;

      const timeStr =
        typeof t.deadlineTime === 'string' &&
        /^\d{2}:\d{2}$/.test(t.deadlineTime.trim())
          ? t.deadlineTime.trim()
          : null;

      const rawCategories = Array.isArray(t.categories) ? t.categories : [];
      const mappedCategories = rawCategories
        .map((c) => String(c || '').trim())
        .filter((c) => VALID_APP_CATEGORIES.has(c));

      if (!mappedCategories.includes('Academics') && isAnnouncement) {
        mappedCategories.push('Academics');
      }

      return {
        title: t.title.trim().slice(0, 160),
        category:
          typeof t.category === 'string' && t.category.trim()
            ? t.category.trim().slice(0, 60)
            : 'Academics',
        categories: mappedCategories.length > 0 ? mappedCategories : ['Academics'],
        deadline: deadlineStr,
        deadlineTime: timeStr,
        description:
          typeof t.description === 'string' ? t.description.trim().slice(0, 2000) : '',
        source: 'gemini_announcement',
      };
    });

  return { isAnnouncement, reply, tasks };
}

/**
 * Builds the date-aware system instruction for academic announcement parsing.
 */
function buildSystemInstruction(currentLocalDateString, timezone) {
  return [
    'You are an intelligent academic assistant embedded in a student To-Do List application.',
    `Today's local date is ${currentLocalDateString} (timezone: ${timezone || 'local'}).`,
    'Analyze the user message:',
    '1. If the message is a school announcement, syllabus note, class reminder, or mentions assignments, quizzes, exams, projects, lab activities, or readings:',
    '   - Set isAnnouncement = true.',
    '   - Extract EVERY distinct actionable task or deliverable into the tasks array (if multiple assignments are mentioned in one announcement, create a separate entry for each).',
    '   - Set "title" to a concise, actionable task name (e.g. "Submit CS101 Lab Report #3").',
    '   - Set "category" to the inferred subject/course name or topic (defaulting to "Academics" if unclear).',
    '   - Also populate "categories" using only applicable app tags from: ["Personal", "Urgent", "Growth", "Academics", "Interactive", "Social"] (include "Academics" by default, add "Urgent" if explicitly urgent/due within 2 days).',
    `   - Resolve relative deadlines (e.g., "tomorrow", "next Friday", "this Monday") strictly relative to today (${currentLocalDateString}) and format "deadline" as "YYYY-MM-DD". If no deadline is stated, set "deadline" to null.`,
    '   - If a specific time is stated (e.g., "5:00 PM", "11:59 PM"), format "deadlineTime" as 24-hour "HH:mm"; otherwise set "deadlineTime" to null.',
    '   - Summarize key instructions, room numbers, submission portals, or topics in "description".',
    '   - Always set "source" to "gemini_announcement".',
    '   - Write a helpful summary in "reply".',
    '2. If the message is an informational notice with NO actionable tasks or is general conversation/questions:',
    '   - Return tasks: [] (do not invent fake tasks) and answer helpfully in "reply".',
  ].join('\n');
}

/**
 * Core processor accepting parsed JSON body from an incoming HTTP request.
 */
export async function processAnnouncementRequest(body, apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey || !String(apiKey).trim()) {
    const err = new Error(
      'Gemini API key is not configured on the server. Add GEMINI_API_KEY to your .env.local file and restart the dev server.'
    );
    err.statusCode = 500;
    throw err;
  }

  const userMessage = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!userMessage) {
    const err = new Error('Please enter an announcement or question first.');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  const currentLocalDateString =
    typeof body?.currentLocalDateString === 'string' && body.currentLocalDateString.trim()
      ? body.currentLocalDateString.trim()
      : now.toISOString().slice(0, 10);
  const timezone = typeof body?.timezone === 'string' ? body.timezone.trim() : 'UTC';

  const geminiResponse = await fetch(GEMINI_INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': String(apiKey).trim(),
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      system_instruction: buildSystemInstruction(currentLocalDateString, timezone),
      input: userMessage,
      store: false,
      response_format: ANNOUNCEMENT_RESPONSE_FORMAT,
    }),
  });

  if (!geminiResponse.ok) {
    const errPayload = await geminiResponse.json().catch(() => ({}));
    const rawMsg = errPayload?.error?.message || `HTTP ${geminiResponse.status}`;

    if (geminiResponse.status === 429) {
      const rateErr = new Error(
        'Gemini free-tier rate limit reached. Please wait a few seconds and try again.'
      );
      rateErr.statusCode = 429;
      throw rateErr;
    }

    const upstreamErr = new Error(`Gemini API request failed: ${rawMsg}`);
    upstreamErr.statusCode = geminiResponse.status >= 400 ? geminiResponse.status : 502;
    throw upstreamErr;
  }

  const interactionPayload = await geminiResponse.json();
  const textOutput = extractTextFromInteraction(interactionPayload);
  const parsedJson = parseStructuredJson(textOutput);
  return sanitizeParsedAnnouncement(parsedJson);
}

/**
 * Node `http.IncomingMessage` / `http.ServerResponse` Connect middleware
 * used by Vite dev/preview servers (and compatible with Node serverless runtimes).
 */
export function createGeminiMiddleware(resolveApiKey) {
  return async (req, res, next) => {
    const reqUrl = (req.url || '').split('?')[0];
    if (reqUrl !== '/api/gemini-announcement') {
      return next();
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
      return;
    }

    try {
      const rawBody = await new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            reject(Object.assign(new Error('Request payload too large.'), { statusCode: 413 }));
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
      });

      const body = rawBody ? JSON.parse(rawBody) : {};
      const apiKey =
        (typeof resolveApiKey === 'function' ? resolveApiKey() : null) ||
        process.env.GEMINI_API_KEY;

      const result = await processAnnouncementRequest(body, apiKey);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err) {
      const status = err?.statusCode || (err instanceof SyntaxError ? 400 : 500);
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error:
            err?.message ||
            'An unexpected error occurred while processing the announcement.',
        })
      );
    }
  };
}
