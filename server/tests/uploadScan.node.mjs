import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { scanUpload, scanSharedSubmission } from '../utils/uploadScan.js';

async function daemon(t, reply) {
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    let bytes = Buffer.alloc(0), command = false, payload = Buffer.alloc(0);
    socket.on('data', chunk => {
      bytes = Buffer.concat([bytes, chunk]);
      if (!command) {
        const end = bytes.indexOf(0); if (end < 0) return;
        assert.equal(bytes.subarray(0, end).toString(), 'zINSTREAM');
        bytes = bytes.subarray(end + 1); command = true;
      }
      while (bytes.length >= 4) {
        const length = bytes.readUInt32BE(0);
        if (bytes.length < 4 + length) return;
        payload = Buffer.concat([payload, bytes.subarray(4, 4 + length)]);
        bytes = bytes.subarray(4 + length);
        if (!length) { reply(socket, payload); return; }
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); });
  return { host: '127.0.0.1', port: server.address().port, timeoutMs: 1000 };
}

test('streams every original byte and accepts a fragmented clean verdict', async t => {
  const original = Buffer.alloc(150000, 42);
  const options = await daemon(t, (socket, data) => {
    assert.deepEqual(data, original);
    socket.write('stream: '); setTimeout(() => socket.end('OK\0'), 5);
  });
  await scanUpload(original, options);
});
test('rejects malware verdicts', async t => {
  const options = await daemon(t, socket => socket.end('stream: Test-Signature FOUND\0'));
  await assert.rejects(scanUpload(Buffer.from('fixture'), options), { code: 'UPLOAD_SCAN_REJECTED' });
});
test('errors, incomplete responses and misleading OK text fail closed', async t => {
  for (const reply of ['stream: size limit exceeded ERROR\0', 'stream: OK', 'garbage OK\0']) {
    const options = await daemon(t, socket => socket.end(reply));
    await assert.rejects(scanUpload(Buffer.from('fixture'), options), { code: 'UPLOAD_SCAN_UNAVAILABLE' });
  }
});
test('a stalled scanner times out', async t => {
  const options = await daemon(t, () => {});
  await assert.rejects(scanUpload(Buffer.from('fixture'), { ...options, timeoutMs: 30 }), { code: 'UPLOAD_SCAN_UNAVAILABLE' });
});
test('a disconnected scanner rejects uploads', async t => {
  const options = await daemon(t, socket => socket.destroy());
  await assert.rejects(scanUpload(Buffer.from('fixture'), options), { code: 'UPLOAD_SCAN_UNAVAILABLE' });
});
test('infected voice attachment prevents the entire submission reaching storage', async () => {
  let saved = false, count = 0, status, body;
  const middleware = scanSharedSubmission(async () => {
    if (++count === 2) throw Object.assign(new Error('Unsafe file'), { code: 'UPLOAD_SCAN_REJECTED', statusCode: 422 });
  });
  const res = { status(value) { status = value; return this; }, json(value) { body = value; } };
  await middleware({ files: { files: [{ buffer: Buffer.from('photo') }], audio: [{ buffer: Buffer.from('voice') }] } }, res, () => { saved = true; });
  assert.equal(saved, false); assert.equal(status, 422); assert.equal(body.code, 'UPLOAD_SCAN_REJECTED');
});
test('text-only submissions need no scanner and clean files continue', async () => {
  let scans = 0, saved = 0;
  const middleware = scanSharedSubmission(async () => { scans++; });
  await middleware({}, {}, () => saved++);
  await middleware({ files: { files: [{ buffer: Buffer.from('photo') }] } }, {}, () => saved++);
  assert.equal(saved, 2); assert.equal(scans, 1);
});
