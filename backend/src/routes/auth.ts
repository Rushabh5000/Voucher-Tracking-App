import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { promisify } from "util";
import { AppError } from "../middleware/errorHandler";
import { prisma } from "../db";

const router = Router();
const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 32)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 32)) as Buffer;
  return crypto.timingSafeEqual(derived, Buffer.from(hash, "hex"));
}

// POST /api/auth/login — admin (env vars) or registered user
router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new AppError(500, "JWT_SECRET must be set");

    if (!username?.trim() || !password) throw new AppError(400, "username and password are required");

    // Check admin env-var credentials first
    const adminUser = process.env.AUTH_USERNAME;
    const adminPass = process.env.AUTH_PASSWORD;
    if (adminUser && adminPass && username === adminUser && password === adminPass) {
      const token = jwt.sign({ role: "admin" }, secret, { expiresIn: "30d" });
      return res.json({ token, username: adminUser, role: "admin" });
    }

    // Check registered users
    const user = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError(401, "Invalid username or password");
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, secret, { expiresIn: "30d" });
    res.json({ token, username: user.username, role: user.role });
  } catch (e) { next(e); }
});

// POST /api/auth/register — create a new account
router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new AppError(500, "JWT_SECRET must be set");

    if (!username?.trim()) throw new AppError(400, "username is required");
    if (!password || password.length < 6) throw new AppError(400, "password must be at least 6 characters");

    // Block registering with the admin username
    if (username.trim() === process.env.AUTH_USERNAME) {
      throw new AppError(409, "Username already taken");
    }

    const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (existing) throw new AppError(409, "Username already taken");

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username: username.trim(), passwordHash, role: "user" },
    });

    const token = jwt.sign({ userId: user.id, role: "user" }, secret, { expiresIn: "30d" });
    res.status(201).json({ token, username: user.username, role: "user" });
  } catch (e) { next(e); }
});

// POST /api/auth/guest — create a temporary guest session (2-hour expiry)
router.post("/guest", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new AppError(500, "JWT_SECRET must be set");

    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    const guestName = `guest_${crypto.randomBytes(4).toString("hex")}`;

    const user = await prisma.user.create({
      data: {
        username:     guestName,
        passwordHash: "",  // guests cannot log in with password
        role:         "guest",
        expiresAt,
      },
    });

    const token = jwt.sign({ userId: user.id, role: "guest" }, secret, { expiresIn: "2h" });
    res.status(201).json({ token, username: guestName, role: "guest", expiresAt: expiresAt.toISOString() });
  } catch (e) { next(e); }
});

export default router;
