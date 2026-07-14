import express from "express";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";

function mapRegistration(row) {
  return {
    ...row,
    files: JSON.parse(row.files_json || "[]"),
  };
}

export function buildRegistrationsRouter(db) {
  const router = express.Router();

  router.post("/", async (req, res) => {
    const body = req.body || {};
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
        JSON.stringify(Array.isArray(body.files) ? body.files : []),
      ]
    );

    return res.status(201).json({ id, message: "Registration created." });
  });

  router.get("/admin", requireAuth, async (_req, res) => {
    const rows = await db.all("SELECT * FROM registrations ORDER BY submitted_at DESC");
    return res.json(rows.map(mapRegistration));
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
