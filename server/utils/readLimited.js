// Bound allocation while reading, including responses without Content-Length.
export async function readLimited(body, maxBytes) {
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of body) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > maxBytes) throw new Error('File exceeds the allowed size');
      chunks.push(bytes);
    }
    return Buffer.concat(chunks, size);
  } catch (err) {
    body.destroy?.();
    throw err;
  }
}
