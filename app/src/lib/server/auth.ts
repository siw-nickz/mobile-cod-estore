import { SignJWT, jwtVerify } from "jose";

export const ROLE_SHOPPER = "shopper";
export const ROLE_ADMIN = "admin";

export type AuthClaims = {
  uid: number;
  role: string;
};

function secretKey() {
  const secret = process.env.JWT_SECRET || "dev-change-me";
  return new TextEncoder().encode(secret);
}

export async function issueToken(uid: number, role: string): Promise<string> {
  const hours = Number(process.env.JWT_EXPIRY_HOURS || "72");
  return new SignJWT({ uid, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${Number.isFinite(hours) && hours > 0 ? hours : 72}h`)
    .sign(secretKey());
}

export async function parseToken(token: string): Promise<AuthClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const uid = Number(payload.uid);
    const role = String(payload.role || "");
    if (!uid || !role) return null;
    return { uid, role };
  } catch {
    return null;
  }
}

export async function authFromRequest(req: Request): Promise<AuthClaims | null> {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  return parseToken(h.slice(7));
}

export async function requireAdmin(req: Request): Promise<AuthClaims | Response> {
  const claims = await authFromRequest(req);
  if (!claims || claims.role !== ROLE_ADMIN) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return claims;
}
