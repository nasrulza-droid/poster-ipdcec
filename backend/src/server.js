import "dotenv/config";
import express from "express";
import fs from "node:fs";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { getDb } from "./db.js";
import { buildAuthRouter } from "./routes/auth.js";
import { buildRegistrationsRouter } from "./routes/registrations.js";
import { createRegistrationNotifier } from "./services/registrationNotifier.js";

const port = Number(process.env.PORT || 5001);
const isProduction = process.env.NODE_ENV === "production";
const securityAlertWindowMs = Number(process.env.SECURITY_ALERT_WINDOW_MS || 5 * 60 * 1000);
const securityAlertThreshold = Number(process.env.SECURITY_ALERT_THRESHOLD || 30);
const securityAlertLogPath = String(process.env.SECURITY_ALERT_LOG_PATH || "/tmp/ipdcec-security-alert.log");

function resolveTrustProxy() {
  const raw = String(process.env.TRUST_PROXY || "").trim().toLowerCase();

  if (!raw) {
    return isProduction ? 1 : false;
  }

  if (raw === "true") {
    return true;
  }

  if (raw === "false") {
    return false;
  }

  const asNumber = Number(raw);
  if (Number.isInteger(asNumber) && asNumber >= 0) {
    return asNumber;
  }

  return raw;
}

function resolveAllowedOrigins() {
  const localDevOrigins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5001",
  ];

  const raw = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "";
  const configured = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (configured.length && isProduction) {
    return configured;
  }

  if (configured.length && !isProduction) {
    return [...new Set([...configured, ...localDevOrigins])];
  }

  if (isProduction) {
    return [];
  }

  return localDevOrigins;
}

const allowedOrigins = resolveAllowedOrigins();

function recordSecurityAlert(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    fs.appendFileSync(securityAlertLogPath, line, { encoding: "utf8" });
  } catch {
    // Keep request lifecycle unaffected when alert log file is not writable.
  }
}

function buildSecurityStatusMonitor() {
  let windowStartedAt = Date.now();
  const counters = new Map();
  const alerted = new Set();

  return function securityStatusMonitor(req, res, next) {
    res.on("finish", () => {
      const now = Date.now();
      if (now - windowStartedAt >= securityAlertWindowMs) {
        windowStartedAt = now;
        counters.clear();
        alerted.clear();
      }

      const statusCode = Number(res.statusCode);
      const requestPath = String(req.originalUrl || req.url || req.path || "");
      const routePrefix = requestPath.startsWith("/api/auth")
        ? "auth"
        : requestPath.startsWith("/api/registrations")
          ? "registrations"
          : null;

      if (!routePrefix || (statusCode !== 400 && statusCode !== 401)) {
        return;
      }

      const key = `${routePrefix}:${statusCode}`;
      const nextCount = (counters.get(key) || 0) + 1;
      counters.set(key, nextCount);

      if (nextCount >= securityAlertThreshold && !alerted.has(key)) {
        alerted.add(key);
        const alertMessage = `[SECURITY_ALERT] high volume ${key} responses (${nextCount}) within ${Math.floor(
          securityAlertWindowMs / 1000
        )}s window`;
        console.warn(alertMessage);
        recordSecurityAlert(alertMessage);
      }
    });

    next();
  };
}

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required in .env");
  }

  const db = await getDb();
  const app = express();
  const notifyRegistration = createRegistrationNotifier();

  // Ensure rate-limits and request IP detection work correctly behind reverse proxies.
  app.set("trust proxy", resolveTrustProxy());

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
  app.use(buildSecurityStatusMonitor());

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
  app.use("/api/registrations", buildRegistrationsRouter(db, { notifyRegistration }));

  app.use((error, _req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
      return res.status(400).json({ message: "Invalid JSON payload." });
    }

    if (error && typeof error.message === "string" && error.message.includes("Origin not allowed by CORS")) {
      return res.status(403).json({ message: "CORS origin denied." });
    }

    return next(error);
  });

  app.use((_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  app.use((error, req, res, _next) => {
    console.error(`[UNHANDLED_ERROR] ${req.method} ${req.path}: ${error?.message || "Unknown error"}`);
    return res.status(500).json({ message: "Internal server error." });
  });

  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
