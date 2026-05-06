import { Request, Response, NextFunction } from "express";

export interface AuthUser {
  id: number;
  username: string;
  role: "trainer" | "admin";
  position?: string | null;
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
