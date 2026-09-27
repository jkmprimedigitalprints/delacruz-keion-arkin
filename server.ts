import express from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '120825';
const SESSION_SECRET = process.env.SESSION_SECRET || 'baby-boy-memory-album-sec-key-2026';

app.use(express.json({ limit: '25mb' }));

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

// API Routes
app.post('/api/admin/verify-pin', (req, res) => {
  const { pin } = req.body || {};
  if (pin && String(pin).trim() === ADMIN_PIN) {
    const token = signToken({
      admin: true,
      role: 'family_admin',
      iat: Date.now(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    return res.json({ success: true, token, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  }

  setTimeout(() => {
    return res.status(401).json({ success: false, error: 'Incorrect PIN. Access denied.' });
  }, 400);
});

app.get('/api/admin/check-session', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/, '');
  const isValid = verifyToken(token);
  return res.json({ valid: isValid });
});

// High-speed stream upload endpoint
app.post('/api/upload', (req, res) => {
  const id = (req.query.id as string) || Date.now().toString();
  const rawFileName = (req.query.name as string) || 'file';
  const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', id);
  fs.mkdirSync(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, cleanFileName);
  const writeStream = fs.createWriteStream(filePath);

  req.pipe(writeStream);

  writeStream.on('finish', () => {
    const mediaUrl = `/uploads/${id}/${cleanFileName}`;
    res.json({
      success: true,
      mediaUrl,
      storagePath: `uploads/${id}/${cleanFileName}`,
      fileName: cleanFileName,
    });
  });

  writeStream.on('error', (err) => {
    console.error('Server upload write error:', err);
    res.status(500).json({ success: false, error: 'File upload write error' });
  });
});

app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok', time: new Date().toISOString() });
});

app.all('/api/db', (req, res) => {
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
    return res.json(readDb());
  }

  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
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
      return res.json({ success: true });
    } catch {
      return res.status(400).json({ success: false });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

// Uploaded static media files
const publicUploadsPath = path.resolve(process.cwd(), 'public', 'uploads');
app.use('/uploads', express.static(publicUploadsPath));

// Static assets
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

// SPA fallback for HTML5 history API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
