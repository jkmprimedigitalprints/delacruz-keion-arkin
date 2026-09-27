import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || 'baby-boy-memory-album-sec-key-2026';

function verifyToken(token: string): boolean {
  if (!token) return false;
  // Support both HMAC-signed server tokens and base64 client tokens
  try {
    if (token.includes('.')) {
      const [data, signature] = token.split('.');
      if (!data || !signature) return false;
      const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
      if (signature !== expectedSignature) return false;
      const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
      if (payload.exp && Date.now() > payload.exp) return false;
      return payload.admin === true;
    } else {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
      if (payload.exp && Date.now() > payload.exp) return false;
      return payload.admin === true;
    }
  } catch {
    return false;
  }
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ valid: false, error: 'Method not allowed' }));
    return;
  }

  const authHeader = req.headers['authorization'] || '';
  const token = String(authHeader).replace(/^Bearer\s+/i, '').trim();
  const isValid = verifyToken(token);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ valid: isValid }));
}
