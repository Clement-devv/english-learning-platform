// server/utils/s3.js — shared S3 client and helpers
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

// Generate a presigned GET URL valid for `expiresIn` seconds (default 1 hour).
export async function getPresignedUrl(key, expiresIn = 3600) {
  if (!s3) return null;
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
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
