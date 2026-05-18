import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

type TokenPayload =
  | { role: "admin" }
  | { userId: string; role: "user" | "guest" };

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header     = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  const token      = queryToken || (header?.startsWith("Bearer ") ? header.slice(7) : null);

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: "JWT_SECRET not configured" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    if (decoded.role === "admin") {
      req.user = { userId: null, role: "admin" };
    } else {
      req.user = { userId: (decoded as { userId: string; role: "user" | "guest" }).userId, role: decoded.role };
    }
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session — please log in again" });
  }
}
