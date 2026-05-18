import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SKIP_PATHS = new Set(["/api/health"]);

function deriveEntity(path: string): string {
  const seg = path.split("/").filter(Boolean)[1] ?? "unknown";
  const map: Record<string, string> = {
    vouchers: "Voucher", cards: "Card", autocomplete: "AutocompleteEntry",
    export: "Export", analytics: "Analytics", audit: "AuditLog", auth: "Auth",
  };
  return map[seg] ?? seg;
}

function deriveAction(method: string, entity: string): string {
  const verbs: Record<string, string> = {
    GET: "Listed", POST: "Created", PATCH: "Updated", PUT: "Replaced", DELETE: "Deleted",
  };
  return `${verbs[method] ?? method} ${entity}`;
}

export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATHS.has(req.path) || req.path.startsWith("/api/audit")) {
    next();
    return;
  }

  const startAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startAt;
    const entity     = deriveEntity(req.path);
    const action     = deriveAction(req.method, entity);

    prisma.auditLog.create({
      data: {
        action,
        entity,
        method:     req.method,
        path:       req.path,
        statusCode: res.statusCode,
        durationMs,
        ipAddress:  req.ip ?? null,
        userAgent:  req.get("user-agent") ?? null,
      },
    }).catch(err => console.error("[Audit] Write failed:", err));
  });

  next();
}
