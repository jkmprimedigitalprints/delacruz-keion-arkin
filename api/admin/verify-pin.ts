import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

const ADMIN_PIN = process.env.ADMIN_PIN || '120825';
const SESSION_SECRET = process.env.SESSION_SECRET || 'baby-boy-memory-album-sec-key-2026';

function signToken(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

function sendJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return sendJson(res, 405, {
      success: false,
      error: `Method ${req.method || 'UNKNOWN'} not allowed. Use POST.`,
    });
  }

  try {
    let bodyObj: Record<string, any> = {};
    if (req.body && typeof req.body === 'object') {
      bodyObj = req.body;
    } else if (typeof req.body === 'string' && req.body.trim()) {
      bodyObj = JSON.parse(req.body);
    } else {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk.toString();
      }
      if (raw.trim()) {
        bodyObj = JSON.parse(raw);
      }
    }

    const pin = bodyObj?.pin;
    if (pin && String(pin).trim() === ADMIN_PIN) {
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const token = signToken({
        admin: true,
        role: 'family_admin',
        iat: Date.now(),
        exp: expiresAt,
      });
      return sendJson(res, 200, {
        success: true,
        token,
        expiresAt,
      });
    }

    return sendJson(res, 401, {
      success: false,
      error: 'Incorrect PIN. Access denied.',
    });
  } catch (err) {
    return sendJson(res, 400, {
      success: false,
      error: 'Invalid request payload.',
    });
  }
}
