import "dotenv/config";
import bcrypt from "bcryptjs";
import { getDb } from "./db.js";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required in .env");
  }

  const db = await getDb();
  const existing = await db.get("SELECT id FROM admin_users WHERE email = ?", email);
  const passwordHash = await bcrypt.hash(password, 12);

  if (existing) {
    await db.run("UPDATE admin_users SET password_hash = ? WHERE email = ?", [passwordHash, email]);
    console.log("Admin password updated.");
  } else {
    await db.run("INSERT INTO admin_users (email, password_hash) VALUES (?, ?)", [email, passwordHash]);
    console.log("Admin user created.");
  }

  await db.close();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
