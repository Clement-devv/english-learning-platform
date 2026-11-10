// server/utils/s3.js — shared S3 client and helpers
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from 'node:crypto';
import { readLimited } from './readLimited.js';

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || "ap-southeast-1";

export const s3 = BUCKET ? new S3Client({ region: REGION }) : null;

export const s3Enabled = () => !!s3;

// Public base URL for objects that are publicly readable (photos, branding)
export const s3PublicUrl = (key) =>
  `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

// Upload a Buffer to S3. Returns the S3 key.
export async function uploadToS3(buffer, key, contentType) {
  if (!s3) throw new Error("S3 not configured");
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
  return key;
}

// Delete an object by key. Silently ignores missing objects.
export async function deleteFromS3(key) {
  if (!s3 || !key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (_) {}
}

// Check if an object exists in S3.
export async function s3ObjectExists(key) {
  if (!s3) return false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function getObjectMetadata(key) {
  if (!s3) throw new Error('S3 not configured');
  return s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
}

// Copy a validated upload to a key that was never exposed in a signed PUT.
// The ETag condition prevents replacing the staging bytes between HEAD and COPY.
export async function sealS3Upload(key, metadata) {
  if (!s3) throw new Error('S3 not configured');
  const sealed = `${key}.ready-${randomUUID()}`;
  await s3.send(new CopyObjectCommand({
    Bucket: BUCKET, Key: sealed,
    CopySource: `${BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`,
    CopySourceIfMatch: metadata.ETag,
  }));
  return sealed;
}

// Generate a presigned GET URL valid for `expiresIn` seconds (default 1 hour).
// `response` can set ResponseContentDisposition / ResponseContentType (e.g. download file name).
export async function getPresignedUrl(key, expiresIn = 3600, response = {}) {
  if (!s3) return null;
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key, ...response });
  return getSignedUrl(s3, cmd, { expiresIn });
}

// Presigned PUT so the browser uploads straight to S3 (the file never passes
// through Express). The key stays private.
export async function getPresignedPutUrl(key, contentType, expiresIn = 600, size) {
  if (!s3) return null;
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType,
    ...(size === undefined ? {} : { ContentLength: size }),
  });
  return getSignedUrl(s3, cmd, { expiresIn, signableHeaders: new Set(['content-length', 'content-type']) });
}

// Read a (small) private object into memory — e.g. pages to send to the AI.
export async function getObjectBuffer(key, maxBytes = 15 * 1024 * 1024) {
  if (!s3) throw new Error("S3 not configured");
  const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (out.ContentLength > maxBytes) {
    out.Body.destroy?.();
    throw new Error('File exceeds the allowed size');
  }
  return readLimited(out.Body, maxBytes);
}

// Extract the S3 key from a stored URL or key string.
// Stored public URLs look like: https://bucket.s3.region.amazonaws.com/key
// Stored keys look like: centers/slug/...
export function keyFromValue(value) {
  if (!value) return null;
  if (value.startsWith("https://") && value.includes(".amazonaws.com/")) {
    return value.split(".amazonaws.com/")[1];
  }
  if (value.startsWith("/uploads/")) return null; // legacy disk file
  return value;
}

// Is this a legacy local file path?
export const isLegacyPath = (value) => value?.startsWith("/uploads/");
