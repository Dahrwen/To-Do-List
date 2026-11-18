/**
 * ============================================================================
 * VERCEL SERVERLESS FUNCTION: /api/gemini-announcement
 * FILE: api/gemini-announcement.js
 * ============================================================================
 * PURPOSE:
 *   Production serverless entrypoint on Vercel for the AI announcement parser.
 *   Delegates to `processAnnouncementRequest` in `src/server/geminiAnnouncementHandler.js`
 *   so `GEMINI_API_KEY` stays strictly on the server side (`process.env.GEMINI_API_KEY`).
 * ============================================================================
 */

import { processAnnouncementRequest } from '../src/server/geminiAnnouncementHandler.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      body = body ? JSON.parse(body) : {};
    } else if (!body) {
      const rawBody = await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
      });
      body = rawBody ? JSON.parse(rawBody) : {};
    }

    const result = await processAnnouncementRequest(
      body,
      process.env.GEMINI_API_KEY
    );

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
}
