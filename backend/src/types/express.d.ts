declare namespace Express {
  interface Request {
    user?: {
      userId: string | null;
      role: "admin" | "user" | "guest";
    };
  }
}
