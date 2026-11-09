import { createHash } from "crypto";

const DEFAULT_FOLDER = "mobile-cod-estore/products";

export type SignedUpload = {
  cloud_name: string;
  api_key: string;
  timestamp: string;
  signature: string;
  folder: string;
  upload_url: string;
};

function cfg() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || "";
  const key = process.env.CLOUDINARY_API_KEY || "";
  const secret = process.env.CLOUDINARY_API_SECRET || "";
  return { cloud, key, secret };
}

export function cloudinaryEnabled() {
  const { cloud, key, secret } = cfg();
  return Boolean(cloud && key && secret);
}

export function presign(folder = DEFAULT_FOLDER): SignedUpload {
  const { cloud, key, secret } = cfg();
  if (!cloud || !key || !secret) throw new Error("cloudinary not configured");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params: Record<string, string> = { folder, timestamp };
  const toSign =
    Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&") + secret;
  const signature = createHash("sha1").update(toSign).digest("hex");
  return {
    cloud_name: cloud,
    api_key: key,
    timestamp,
    signature,
    folder,
    upload_url: `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
  };
}

export async function uploadImage(filename: string, bytes: ArrayBuffer | Buffer): Promise<string> {
  const sign = presign();
  const fd = new FormData();
  fd.append("api_key", sign.api_key);
  fd.append("timestamp", sign.timestamp);
  fd.append("signature", sign.signature);
  fd.append("folder", sign.folder);
  const blob =
    bytes instanceof Buffer
      ? new Blob([new Uint8Array(bytes)])
      : new Blob([bytes instanceof ArrayBuffer ? bytes : new Uint8Array(bytes)]);
  fd.append("file", blob, filename || "upload.jpg");
  const res = await fetch(sign.upload_url, { method: "POST", body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`cloudinary ${res.status}: ${JSON.stringify(body)}`);
  }
  const url = body.secure_url as string | undefined;
  if (!url) throw new Error("cloudinary empty url");
  return url;
}
