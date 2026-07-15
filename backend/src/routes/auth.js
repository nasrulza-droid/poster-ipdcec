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

  const participantRegisterLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many register attempts. Try again later." },
  });

  const participantLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Try again later." },
  });

  router.post("/participant/register", participantRegisterLimiter, async (req, res) => {
    const { full_name: fullName, email, password } = req.body || {};

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "full_name, email, and password are required." });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await db.get("SELECT id FROM participant_users WHERE email = ?", normalizedEmail);
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const result = await db.run(
      "INSERT INTO participant_users (email, full_name, password_hash) VALUES (?, ?, ?)",
      [normalizedEmail, String(fullName).trim(), passwordHash]
    );

    return res.status(201).json({
      message: "Participant registered.",
      user: {
        id: result.lastID,
        email: normalizedEmail,
        full_name: String(fullName).trim(),
      },
    });
  });

  router.post("/participant/login", participantLoginLimiter, async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const participant = await db.get(
      "SELECT id, email, full_name, password_hash FROM participant_users WHERE email = ?",
      normalizedEmail
    );

    if (!participant) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const ok = await bcrypt.compare(String(password), participant.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign(
      {
        sub: String(participant.id),
        email: participant.email,
        full_name: participant.full_name,
        role: "participant",
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({
      token,
      user: {
        email: participant.email,
        full_name: participant.full_name,
        role: "participant",
      },
    });
  });

  router.get("/participant/me", async (req, res) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.role !== "participant") {
        return res.status(403).json({ message: "Forbidden" });
      }
      return res.json({
        user: {
          email: payload.email,
          full_name: payload.full_name,
          role: payload.role,
        },
      });
    } catch {
      return res.status(401).json({ message: "Invalid token" });
    }
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
