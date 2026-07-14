import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { getDb } from "./db.js";
import { buildAuthRouter } from "./routes/auth.js";
import { buildRegistrationsRouter } from "./routes/registrations.js";

const port = Number(process.env.PORT || 5001);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required in .env");
  }

  const db = await getDb();
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigin,
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
