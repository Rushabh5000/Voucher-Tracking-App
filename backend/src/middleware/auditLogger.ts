import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SKIP_PATHS = new Set(["/api/health"]);
const SENSITIVE_KEYS = /^(password|pass|token|secret|key|auth|credential|pwd|pin)$/i;

function sanitizeBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || Object.keys(body as object).length === 0) return undefined;
  try {
    const cleaned = JSON.parse(JSON.stringify(body));
    for (const k of Object.keys(cleaned)) {
      if (SENSITIVE_KEYS.test(k)) cleaned[k] = "***";
    }
    const str = JSON.stringify(cleaned);
    return str.length > 1000 ? str.slice(0, 997) + "…" : str;
  } catch {
    return undefined;
  }
}

export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATHS.has(req.path) || req.path.startsWith("/api/audit")) {
    next();
    return;
  }

  const startAt = Date.now();

  res.on("finish", () => {
    const durationMs  = Date.now() - startAt;
    const requestBody = ["POST", "PATCH", "PUT"].includes(req.method)
      ? sanitizeBody(req.body)
      : undefined;

    prisma.auditLog.create({
      data: {
        method:      req.method,
        path:        req.path,
        statusCode:  res.statusCode,
        durationMs,
        requestBody,
        ipAddress:   req.ip ?? null,
        userAgent:   req.get("user-agent") ?? null,
      },
    }).catch(err => console.error("[Audit] Write failed:", err));
  });

  next();
}
