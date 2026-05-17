import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Accept Bearer token in Authorization header OR ?token= query param (for file download links)
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
    jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session — please log in again" });
  }
}
