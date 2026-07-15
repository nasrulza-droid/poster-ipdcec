import jwt from "jsonwebtoken";

function verifyToken(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return { ok: false, message: "Unauthorized" };
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return { ok: true, payload };
  } catch {
    return { ok: false, message: "Invalid token" };
  }
}

function buildRequireRole(expectedRole) {
  return function requireRole(req, res, next) {
    const result = verifyToken(req);
    if (!result.ok) {
      return res.status(401).json({ message: result.message });
    }

    if (result.payload.role !== expectedRole) {
      return res.status(403).json({ message: "Forbidden" });
    }

    req.user = result.payload;
    return next();
  };
}

export const requireAuth = buildRequireRole("admin");
export const requireParticipantAuth = buildRequireRole("participant");
