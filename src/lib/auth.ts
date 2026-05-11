import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE = "ct_admin";

export function isAuthenticated(req: NextRequest) {
  return req.cookies.get(COOKIE)?.value === process.env.SESSION_SECRET;
}

export function checkAdminSession() {
  try {
    return cookies().get(COOKIE)?.value === process.env.SESSION_SECRET;
  } catch { return false; }
}

export function setSessionHeaders(res: Response) {
  res.headers.set("Set-Cookie",
    `${COOKIE}=${process.env.SESSION_SECRET}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${60*60*8}${process.env.NODE_ENV==="production"?"; Secure":""}`
  );
}

export function clearSessionHeaders() {
  return new Headers({ "Set-Cookie": `${COOKIE}=; HttpOnly; Path=/; Max-Age=0` });
}