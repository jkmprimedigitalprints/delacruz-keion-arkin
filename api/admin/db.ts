import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

const memoryStore: {
  memories: Record<string, Record<string, any>>;
  albums: Record<string, Record<string, any>>;
  baby_settings: Record<string, any> | null;
} = {
  memories: {},
  albums: {},
  baby_settings: null,
};

function getDbFilePath(): string {
  return path.join(os.tmpdir(), 'keion-supabase-fallback-db.json');
}

function readDb() {
  try {
    const file = getDbFilePath();
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return {
        memories: { ...memoryStore.memories, ...(parsed.memories || {}) },
        albums: { ...memoryStore.albums, ...(parsed.albums || {}) },
        baby_settings: parsed.baby_settings || memoryStore.baby_settings || null,
      };
    }
  } catch {}
  return memoryStore;
}

function writeDb(data: typeof memoryStore) {
  memoryStore.memories = data.memories || {};
  memoryStore.albums = data.albums || {};
  memoryStore.baby_settings = data.baby_settings || null;
  try {
    fs.writeFileSync(getDbFilePath(), JSON.stringify(memoryStore), 'utf-8');
  } catch {}
}

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(readDb()));
    return;
  }

  if (req.method === 'POST') {
    try {
      let payload: any = req.body;
      if (!payload || typeof payload === 'string') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const raw = Buffer.concat(chunks).toString('utf-8');
        payload = JSON.parse(raw || '{}');
      }

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
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true }));
      return;
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false }));
      return;
    }
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ error: 'Method not allowed' }));
}
