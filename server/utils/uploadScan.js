import net from 'node:net';

const unavailable = () => Object.assign(new Error('File safety checking is temporarily unavailable. Please try uploading again shortly.'), { statusCode: 503, code: 'UPLOAD_SCAN_UNAVAILABLE' });
const rejected = () => Object.assign(new Error('This file did not pass the safety check. Please send a different file.'), { statusCode: 422, code: 'UPLOAD_SCAN_REJECTED' });
let active = 0;

// Only an explicit complete ClamAV OK verdict releases the original bytes.
// No shell commands, filenames, or user-controlled hostnames are involved.
export async function scanUpload(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length > 20 * 1024 * 1024) throw rejected();
  if (active >= 4) throw unavailable();
  const host = options.host || process.env.CLAMAV_HOST || '127.0.0.1';
  const port = Number(options.port || process.env.CLAMAV_PORT || 3310);
  const timeoutMs = options.timeoutMs || 15000;
  active++;
  try {
    await new Promise((resolve, reject) => {
      let done = false, response = Buffer.alloc(0);
      const socket = net.createConnection({ host, port });
      const finish = error => {
        if (done) return;
        done = true; clearTimeout(timer); socket.destroy();
        if (error) reject(error); else resolve();
      };
      const timer = setTimeout(() => finish(unavailable()), timeoutMs);
      socket.on('error', () => finish(unavailable()));
      socket.on('end', () => { if (!done) finish(unavailable()); });
      socket.on('close', () => { if (!done) finish(unavailable()); });
      socket.on('data', chunk => {
        if (response.length + chunk.length > 4096) return finish(unavailable());
        response = Buffer.concat([response, chunk]);
        const end = response.indexOf(0);
        if (end < 0) return;
        const verdict = response.subarray(0, end).toString('utf8');
        if (verdict === 'stream: OK') finish();
        else if (/^stream: .+ FOUND$/.test(verdict)) finish(rejected());
        else finish(unavailable());
      });
      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        let offset = 0;
        const send = () => {
          while (!done && offset < buffer.length) {
            const chunk = buffer.subarray(offset, offset + 65536);
            const frame = Buffer.allocUnsafe(4 + chunk.length);
            frame.writeUInt32BE(chunk.length); chunk.copy(frame, 4);
            offset += chunk.length;
            if (!socket.write(frame)) { socket.once('drain', send); return; }
          }
          if (!done) socket.write(Buffer.alloc(4));
        };
        send();
      });
    });
  } finally { active--; }
}

// Run after authorization and bounded in-memory multipart parsing, before ANY
// persistence. One infected attachment rejects the whole submission.
export function scanSharedSubmission(scan = scanUpload) {
  return async (req, res, next) => {
    try {
      const files = Object.values(req.files || {}).flat();
      for (const file of files) await scan(file.buffer);
      next();
    } catch (error) {
      const known = ['UPLOAD_SCAN_REJECTED', 'UPLOAD_SCAN_UNAVAILABLE'].includes(error.code);
      const safe = known ? error : unavailable();
      res.status(safe.statusCode).json({ success: false, message: safe.message, code: safe.code });
    }
  };
}
