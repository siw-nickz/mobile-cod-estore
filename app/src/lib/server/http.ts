import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function logErr(publicMsg: string, cause: unknown) {
  console.error(`${publicMsg}:`, cause);
}

export function internal(cause: unknown, publicMsg = "internal error") {
  logErr(publicMsg, cause);
  return err(500, publicMsg);
}
