import { Request, Response, NextFunction } from "express";
import { getPrisma } from "../prisma.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuthenticatedRequesterRequest extends Request {
  devRequester?: {
    id: string;
    displayName: string;
    email: string;
    isActive: boolean;
  };
}

export async function requesterContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authUser = (req as any).user;
  if (authUser) {
    (req as AuthenticatedRequesterRequest).devRequester = {
      id: authUser.id,
      displayName: authUser.name,
      email: authUser.email,
      isActive: true,
    };
    next();
    return;
  }

  const requesterId = req.header("x-dev-requester-id");

  if (!requesterId || !UUID_REGEX.test(requesterId)) {
    res.status(400).json({
      error: {
        code: "INVALID_REQUESTER_CONTEXT",
        message: "Missing or invalid X-Dev-Requester-Id context header",
      },
    });
    return;
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!user || !user.isActive) {
      res.status(400).json({
        error: {
          code: "INVALID_REQUESTER_CONTEXT",
          message: "Missing or invalid X-Dev-Requester-Id context header",
        },
      });
      return;
    }

    (req as AuthenticatedRequesterRequest).devRequester = {
      id: user.id,
      displayName: user.name,
      email: user.email,
      isActive: user.isActive,
    };

    next();
  } catch {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to validate Development Requester context",
      },
    });
  }
}
