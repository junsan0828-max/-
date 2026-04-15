import { Request, Response, NextFunction } from "express";

export interface AuthUser {
  id: number;
  username: string;
  role: "admin" | "trainer";
  trainerId?: number;
}

declare module "express-session" {
  interface SessionData {
    user?: AuthUser;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user || req.session.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
