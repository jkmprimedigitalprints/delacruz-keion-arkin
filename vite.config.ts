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

        if (url.startsWith('/api/upload') && req.method === 'POST') {
          const parsedUrl = new URL(url, 'http://localhost');
          const id = parsedUrl.searchParams.get('id') || Date.now().toString();
          const rawFileName = parsedUrl.searchParams.get('name') || 'file';
          const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

          const uploadDir = path.join(process.cwd(), 'public', 'uploads', id);
          fs.mkdirSync(uploadDir, { recursive: true });

          const filePath = path.join(uploadDir, cleanFileName);
          const writeStream = fs.createWriteStream(filePath);

          req.pipe(writeStream);

          writeStream.on('finish', () => {
            const mediaUrl = `/uploads/${id}/${cleanFileName}`;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                mediaUrl,
                storagePath: `uploads/${id}/${cleanFileName}`,
                fileName: cleanFileName,
              })
            );
          });

          writeStream.on('error', (err) => {
            console.error('Server file write error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'File upload write error' }));
          });

          return;
        }

        if (url.startsWith('/uploads/') && req.method === 'GET') {
          const cleanPath = url.split('?')[0];
          const filePath = path.join(process.cwd(), 'public', cleanPath);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.webp': 'image/webp',
              '.gif': 'image/gif',
              '.mp4': 'video/mp4',
              '.webm': 'video/webm',
              '.mov': 'video/quicktime',
            };
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.writeHead(200, {
              'Content-Type': contentType,
              'Content-Length': fs.statSync(filePath).size,
              'Cache-Control': 'public, max-age=31536000',
            });
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }

        if (url.startsWith('/api/health')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
          return;
        }

        if (url.startsWith('/api/db')) {
          const dbDir = path.join(process.cwd(), 'public', 'uploads');
          const dbFile = path.join(dbDir, 'supabase-fallback-db.json');

          const readDb = () => {
            try {
              if (fs.existsSync(dbFile)) {
                return JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
              }
            } catch {}
            return { memories: {}, albums: {}, baby_settings: null };
          };

          const writeDb = (data: any) => {
            try {
              fs.mkdirSync(dbDir, { recursive: true });
              fs.writeFileSync(dbFile, JSON.stringify(data), 'utf-8');
            } catch {}
          };

          if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(readDb()));
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}');
                const current = readDb();
                if (payload.table === 'memories') {
                  if (payload.action === 'delete' && payload.id) {
                    delete current.memories[payload.id];
                  } else if (payload.row && payload.row.id) {
                    current.memories[payload.row.id] = {
                      ...(current.memories[payload.row.id] || {}),
                      ...payload.row,
                    };
                  }
                } else if (payload.table === 'albums') {
                  if (payload.action === 'delete' && payload.id) {
                    delete current.albums[payload.id];
                  } else if (payload.row && payload.row.id) {
                    current.albums[payload.row.id] = {
                      ...(current.albums[payload.row.id] || {}),
                      ...payload.row,
                    };
                  }
                } else if (payload.table === 'baby_settings' && payload.row) {
                  current.baby_settings = {
                    ...(current.baby_settings || {}),
                    ...payload.row,
                  };
                }
                writeDb(current);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
              }
            });
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
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
