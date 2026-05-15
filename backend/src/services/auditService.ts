import { PrismaClient } from "@prisma/client";
import { Request } from "express";

const prisma = new PrismaClient();

interface AuditEntry {
  action:     string;
  entity:     string;
  entityId?:  string | null;
  details?:   string | null;
  method:     string;
  path:       string;
  statusCode: number;
  durationMs: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function write(entry: AuditEntry): void {
  prisma.auditLog.create({ data: entry })
    .catch(err => console.error("[Audit] Write failed:", err));
}

// Returns a bound writer pre-loaded with HTTP context from the current request.
// Call the returned function after a successful DB operation.
export function auditWriter(req: Request, startAt: number) {
  return function log(
    action:    string,
    entity:    string,
    entityId?: string | null,
    details?:  string | null,
    statusCode = 200,
  ) {
    write({
      action, entity, entityId, details,
      method:     req.method,
      path:       req.path,
      statusCode,
      durationMs: Date.now() - startAt,
      ipAddress:  req.ip ?? null,
      userAgent:  req.get("user-agent") ?? null,
    });
  };
}
