import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("ct_admin");
  const ok = cookie?.value === process.env.SESSION_SECRET;
  return NextResponse.json({ ok });
}