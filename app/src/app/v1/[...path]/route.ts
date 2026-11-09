import { handleApi } from "@/lib/server/api-router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(req: Request) {
  return handleApi(req);
}

export const GET = run;
export const POST = run;
export const PUT = run;
export const DELETE = run;
export const PATCH = run;
