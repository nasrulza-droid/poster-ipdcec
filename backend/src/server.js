import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { getDb } from "./db.js";
import { buildAuthRouter } from "./routes/auth.js";
import { buildRegistrationsRouter } from "./routes/registrations.js";

const port = Number(process.env.PORT || 5001);
const isProduction = process.env.NODE_ENV === "production";

function resolveAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "";
  const configured = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (configured.length) {
    return configured;
  }

  if (isProduction) {
    return [];
  }

  return [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5001",
  ];
}

const allowedOrigins = resolveAllowedOrigins();

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required in .env");
  }

  const db = await getDb();
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed by CORS."));
      },
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "ipdcec-backend" });
  });

  app.use("/api/auth", buildAuthRouter(db));
  app.use("/api/registrations", buildRegistrationsRouter(db));

  app.use((_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
