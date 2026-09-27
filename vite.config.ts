import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';

const ADMIN_PIN = process.env.ADMIN_PIN || '120825';
const SESSION_SECRET = process.env.SESSION_SECRET || 'baby-boy-memory-album-sec-key-2026';

function signToken(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyToken(token: string): boolean {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return false;
    const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    if (signature !== expectedSignature) return false;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) return false;
    return payload.admin === true;
  } catch {
    return false;
  }
}

function adminApiPlugin(): Plugin {
  return {
    name: 'admin-api-endpoints',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        if (url.startsWith('/api/admin/verify-pin') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const { pin } = JSON.parse(body || '{}');
              if (pin && String(pin).trim() === ADMIN_PIN) {
                const token = signToken({
                  admin: true,
                  role: 'family_admin',
                  iat: Date.now(),
                  exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, token, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
              } else {
                setTimeout(() => {
                  res.writeHead(401, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, error: 'Incorrect PIN. Access denied.' }));
                }, 400);
              }
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Invalid request payload' }));
            }
          });
          return;
        }

        if (url.startsWith('/api/admin/check-session') && req.method === 'GET') {
          const authHeader = req.headers['authorization'] || '';
          const token = authHeader.replace(/^Bearer\s+/, '');
          const isValid = verifyToken(token);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ valid: isValid }));
          return;
        }

        if (url.startsWith('/api/health')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'SUPABASE_'],
    plugins: [react(), tailwindcss(), adminApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
