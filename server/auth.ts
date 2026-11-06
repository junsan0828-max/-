import { Request, Response, NextFunction } from "express";

export interface AuthUser {
  id: number;
  username: string;
  role: "admin" | "sub_admin" | "trainer" | "consultant";
  position?: string | null;
  trainerId?: number;
}

declare module "express-session" {
  interface SessionData {
    // 자이언트짐 관리시스템 (ziantgym.sid)
    user?: AuthUser;
    // ZIANTGYM+ 회원앱 (gymplus.sid)
    gymPlusMemberId?: number;
    // 핏스텝 (fitstep.sid)
    fitStepMemberId?: number;
    // 미니서비스 핏트레이너프로 (fittrainer.sid)
    fitTrainerMemberId?: number;
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
