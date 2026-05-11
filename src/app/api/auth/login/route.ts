import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: "ct_admin",
      value: process.env.SESSION_SECRET!,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return res;
  }
  await new Promise(r => setTimeout(r, 400));
  return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: "ct_admin", value: "", maxAge: 0, path: "/" });
  return res;
}