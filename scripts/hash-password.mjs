// Genera el hash de una contraseña (así no queda en texto en el .env ni en Vercel)
// Uso:
//   node scripts/hash-password.mjs "ClaveDelIngresoAlSistema"          → ADMIN_PASSWORD_HASH
//   node scripts/hash-password.mjs "ClaveDelDueño" OWNER               → OWNER_PASSWORD_HASH
import crypto from "crypto";

const pass = process.argv[2];
const who = (process.argv[3] || "ADMIN").toUpperCase() === "OWNER" ? "OWNER" : "ADMIN";
if (!pass || pass.length < 8) {
  console.error('Usá una contraseña de al menos 8 caracteres:  node scripts/hash-password.mjs "..." [OWNER]');
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(pass, salt, 64);
// Con ":" (no "$"): Next.js toma los "$" del .env como variables y rompería el valor
console.log(`${who}_PASSWORD_HASH=scrypt:${salt.toString("base64")}:${hash.toString("base64")}`);
if (who === "ADMIN") {
  console.log("\nY para SESSION_SECRET (si querés uno nuevo):");
  console.log(`SESSION_SECRET=${crypto.randomBytes(48).toString("base64url")}`);
}
