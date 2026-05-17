import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../middleware/errorHandler";

const router = Router();

router.post("/login", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    const validUser = process.env.AUTH_USERNAME;
    const validPass = process.env.AUTH_PASSWORD;
    const secret    = process.env.JWT_SECRET;

    if (!validUser || !validPass || !secret) {
      throw new AppError(500, "AUTH_USERNAME, AUTH_PASSWORD, and JWT_SECRET must be set in .env");
    }

    if (username !== validUser || password !== validPass) {
      throw new AppError(401, "Invalid username or password");
    }

    const token = jwt.sign({ username }, secret, { expiresIn: "30d" });
    res.json({ token });
  } catch (e) { next(e); }
});

export default router;
