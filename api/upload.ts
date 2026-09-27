import type { IncomingMessage, ServerResponse } from 'http';

const MAX_INLINE_BYTES = 4.2 * 1024 * 1024; // 4.2 MB safe Vercel serverless limit

function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,PATCH,DELETE');
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

export default async function handler(req: IncomingMessage & { query?: Record<string, string | string[]>; body?: any }, res: ServerResponse) {
  setCorsHeaders(res);

  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // 2. Reject unsupported HTTP methods with explicit Allow header
  if (req.method !== 'POST' && req.method !== 'PUT') {
    res.setHeader('Allow', 'POST, PUT, OPTIONS');
    return sendJson(res, 405, {
      success: false,
      error: `Method ${req.method || 'UNKNOWN'} is not allowed on /api/upload. Use POST.`,
    });
  }

  try {
    const parsedUrl = new URL(req.url || '/api/upload', 'http://localhost');
    const id = parsedUrl.searchParams.get('id') || `mem-${Date.now()}`;
    const rawFileName = parsedUrl.searchParams.get('name') || 'file';
    const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const headerContentType = (req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim();

    // Collect raw binary chunks if body was not pre-parsed as a Buffer
    let fileBuffer: Buffer;

    if (Buffer.isBuffer(req.body)) {
      fileBuffer = req.body;
    } else if (typeof req.body === 'string') {
      fileBuffer = Buffer.from(req.body, 'binary');
    } else if (req.body && typeof req.body === 'object' && typeof req.body.dataUrl === 'string') {
      return sendJson(res, 200, {
        success: true,
        mediaUrl: req.body.dataUrl,
        storagePath: `vercel-inline/${id}/${cleanFileName}`,
        fileName: cleanFileName,
      });
    } else {
      const chunks: Buffer[] = [];
      let totalLength = 0;

      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalLength += buf.length;
        if (totalLength > MAX_INLINE_BYTES) {
          return sendJson(res, 413, {
            success: false,
            error: 'File exceeds serverless direct payload limit (4.2MB). Use direct cloud storage upload.',
          });
        }
        chunks.push(buf);
      }
      fileBuffer = Buffer.concat(chunks);
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return sendJson(res, 400, {
        success: false,
        error: 'Uploaded file is empty (0 bytes). Please choose a valid photo or video.',
      });
    }

    const base64Data = fileBuffer.toString('base64');
    const mediaUrl = `data:${headerContentType};base64,${base64Data}`;

    return sendJson(res, 200, {
      success: true,
      mediaUrl,
      storagePath: `vercel-inline/${id}/${cleanFileName}`,
      fileName: cleanFileName,
      size: fileBuffer.length,
    });
  } catch (err: any) {
    console.error('[/api/upload] Serverless upload error:', err);
    return sendJson(res, 500, {
      success: false,
      error: err?.message || 'Unexpected server error while processing upload.',
    });
  }
}
