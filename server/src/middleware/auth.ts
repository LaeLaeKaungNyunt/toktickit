import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getPrisma } from "../prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-toktickit-jwt-secret-key";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  tokenVersion: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface JwtPayload {
  userId: string;
  role: string;
  tokenVersion: number;
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization token" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      res.status(401).json({ error: "User not found or access token invalid" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Account is inactive" });
      return;
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      res.status(401).json({ error: "Session has been invalidated" });
      return;
    }

    (req as AuthenticatedRequest).user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
    };

    // Mandatory First Password Change Gate
    const isAllowedPasswordGatePath =
      req.originalUrl.includes("/auth/me") ||
      req.originalUrl.includes("/auth/change-password") ||
      req.originalUrl.includes("/auth/logout") ||
      req.path === "/me" ||
      req.path === "/change-password" ||
      req.path === "/logout";

    if (user.mustChangePassword && !isAllowedPasswordGatePath) {
      res.status(403).json({
        error: "Password change required before accessing application features",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
      return;
    }

    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...permittedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || !permittedRoles.includes(user.role)) {
      res.status(403).json({ error: "Forbidden: insufficient permissions" });
      return;
    }
    next();
  };
}
