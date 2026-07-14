import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

export function buildAuthRouter(db) {
  const router = express.Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Try again later." },
  });

  router.post("/login", loginLimiter, async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const admin = await db.get("SELECT id, email, password_hash FROM admin_users WHERE email = ?", email);

    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign(
      { sub: String(admin.id), email: admin.email, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    await db.run(
      "INSERT INTO admin_logs (actor_email, action, target_id, metadata_json) VALUES (?, ?, ?, ?)",
      [admin.email, "auth.login", null, JSON.stringify({ source: "web" })]
    );

    return res.json({ token, user: { email: admin.email, role: "admin" } });
  });

  return router;
}
