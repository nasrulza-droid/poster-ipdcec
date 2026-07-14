import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
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

function mapRegistration(row) {
  return {
    ...row,
    files: JSON.parse(row.files_json || "[]"),
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

export function buildRegistrationsRouter(db) {
  const router = express.Router();

  const uploadFields = upload.fields(fieldNames.map((name) => ({ name, maxCount: 1 })));

  router.post("/", (req, res, next) => {
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

  router.get("/admin/export.csv", requireAuth, async (_req, res) => {
    const rows = await db.all("SELECT * FROM registrations ORDER BY submitted_at DESC");
    const csv = toCsv(rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=ipdcec-registrations.csv");
    return res.status(200).send(csv);
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

    return res.json({ message: "Status updated." });
  });

  router.delete("/admin/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const result = await db.run("DELETE FROM registrations WHERE id = ?", id);

    if (!result.changes) {
      return res.status(404).json({ message: "Registration not found." });
    }

    return res.json({ message: "Registration deleted." });
  });

  return router;
}
