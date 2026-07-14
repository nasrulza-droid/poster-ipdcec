import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const fieldNames = [
  "student_id_or_enrollment",
  "proof_follow_instagram",
  "proof_twibbon",
  "proof_share_poster",
  "poster_final_file",
  "proof_payment",
];

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = ext || ".bin";
      const generated = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt}`;
      cb(null, generated);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: fieldNames.length,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error("Unsupported file type."));
      return;
    }
    cb(null, true);
  },
});

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many registration attempts. Try again later." },
});

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapRegistration(row) {
  return {
    ...row,
    files: parseJsonArray(row.files_json),
  };
}

function toCsv(rows) {
  const headers = [
    "id",
    "submitted_at",
    "updated_at",
    "status",
    "participant_type",
    "leader_name",
    "member_2",
    "member_3",
    "email",
    "whatsapp",
    "school_name",
    "country",
    "poster_title",
    "subtheme",
    "files",
  ];

  const escapeCell = (value) => {
    const safe = String(value ?? "").replaceAll('"', '""');
    return `"${safe}"`;
  };

  const lines = [headers.join(",")];

  rows.forEach((row) => {
    const entry = mapRegistration(row);
    const cells = headers.map((key) => {
      if (key === "files") {
        return escapeCell((entry.files || []).join(" | "));
      }
      return escapeCell(entry[key]);
    });
    lines.push(cells.join(","));
  });

  return lines.join("\n");
}

async function logAdminAction(db, actorEmail, action, targetId, metadata = {}) {
  await db.run(
    "INSERT INTO admin_logs (actor_email, action, target_id, metadata_json) VALUES (?, ?, ?, ?)",
    [actorEmail || "unknown", action, targetId || null, JSON.stringify(metadata)]
  );
}

export function buildRegistrationsRouter(db) {
  const router = express.Router();

  const uploadFields = upload.fields(fieldNames.map((name) => ({ name, maxCount: 1 })));

  router.post("/", registrationLimiter, (req, res, next) => {
    uploadFields(req, res, (error) => {
      if (error) {
        return res.status(400).json({ message: error.message || "Invalid upload." });
      }
      return next();
    });
  }, async (req, res) => {
    const body = req.body || {};

    // Honeypot field should always be empty for real users.
    if (String(body._honey || "").trim()) {
      return res.status(400).json({ message: "Rejected by anti-bot filter." });
    }

    const required = [
      "leader_name",
      "email",
      "whatsapp",
      "school_name",
      "country",
      "poster_title",
      "subtheme",
      "participant_type",
    ];

    for (const field of required) {
      if (!String(body[field] || "").trim()) {
        return res.status(400).json({ message: `Field ${field} is required.` });
      }
    }

    if (String(body.participant_type || "") === "Team" && !String(body.member_2 || "").trim()) {
      return res.status(400).json({ message: "Field member_2 is required for team registration." });
    }

    const uploadedFiles = fieldNames
      .map((field) => {
        const file = req.files?.[field]?.[0];
        if (!file) {
          return null;
        }
        return {
          field,
          original_name: file.originalname,
          stored_name: file.filename,
          mime_type: file.mimetype,
          size: file.size,
        };
      })
      .filter(Boolean);

    if (uploadedFiles.length !== fieldNames.length) {
      return res.status(400).json({ message: "All required documents must be uploaded." });
    }

    const id = `REG-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO registrations (
        id, submitted_at, updated_at, status, participant_type,
        leader_name, member_2, member_3, email, whatsapp,
        school_name, country, poster_title, subtheme, files_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        now,
        now,
        "Baru",
        String(body.participant_type),
        String(body.leader_name),
        String(body.member_2 || ""),
        String(body.member_3 || ""),
        String(body.email),
        String(body.whatsapp),
        String(body.school_name),
        String(body.country),
        String(body.poster_title),
        String(body.subtheme),
        JSON.stringify(uploadedFiles),
      ]
    );

    return res.status(201).json({ id, message: "Registration created." });
  });

  router.get("/admin", requireAuth, async (_req, res) => {
    const rows = await db.all("SELECT * FROM registrations ORDER BY submitted_at DESC");
    return res.json(rows.map(mapRegistration));
  });

  router.get("/admin/logs", requireAuth, async (_req, res) => {
    const rows = await db.all(
      "SELECT id, actor_email, action, target_id, metadata_json, created_at FROM admin_logs ORDER BY created_at DESC, id DESC LIMIT 150"
    );
    const logs = rows.map((row) => ({
      ...row,
      metadata: JSON.parse(row.metadata_json || "{}"),
    }));
    return res.json(logs);
  });

  router.get("/admin/export.csv", requireAuth, async (_req, res) => {
    const rows = await db.all("SELECT * FROM registrations ORDER BY submitted_at DESC");
    const csv = toCsv(rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=ipdcec-registrations.csv");
    return res.status(200).send(csv);
  });

  router.get("/admin/:id/files/:field", requireAuth, async (req, res) => {
    const { id, field } = req.params;
    if (!fieldNames.includes(field)) {
      return res.status(400).json({ message: "Invalid file field." });
    }

    const row = await db.get("SELECT id, files_json FROM registrations WHERE id = ?", id);
    if (!row) {
      return res.status(404).json({ message: "Registration not found." });
    }

    const files = parseJsonArray(row.files_json);
    const fileMeta = files.find((item) => item && typeof item === "object" && item.field === field);
    if (!fileMeta?.stored_name) {
      return res.status(404).json({ message: "File not found." });
    }

    const absolutePath = path.resolve(uploadDir, fileMeta.stored_name);
    const normalizedUploadDir = path.resolve(uploadDir);
    if (!absolutePath.startsWith(normalizedUploadDir)) {
      return res.status(400).json({ message: "Invalid file path." });
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: "Stored file not found." });
    }

    const downloadName = String(fileMeta.original_name || `${field}.bin`).replace(/[\r\n"]/g, "_");

    await logAdminAction(db, req.user?.email, "registration.file.download", id, { field, stored_name: fileMeta.stored_name });

    res.setHeader("Content-Type", fileMeta.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    return res.sendFile(absolutePath);
  });

  router.patch("/admin/:id/status", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body || {};
    const allowed = ["Baru", "Terverifikasi", "Lolos Administrasi", "Ditolak"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const now = new Date().toISOString();
    const result = await db.run(
      "UPDATE registrations SET status = ?, updated_at = ? WHERE id = ?",
      [status, now, id]
    );

    if (!result.changes) {
      return res.status(404).json({ message: "Registration not found." });
    }

    await logAdminAction(db, req.user?.email, "registration.status.update", id, { status });

    return res.json({ message: "Status updated." });
  });

  router.delete("/admin/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const result = await db.run("DELETE FROM registrations WHERE id = ?", id);

    if (!result.changes) {
      return res.status(404).json({ message: "Registration not found." });
    }

    await logAdminAction(db, req.user?.email, "registration.delete", id);

    return res.json({ message: "Registration deleted." });
  });

  return router;
}
