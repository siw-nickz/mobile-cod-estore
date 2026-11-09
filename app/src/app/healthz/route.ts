import { handleApi } from "@/lib/server/api-router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleApi(req);
}
