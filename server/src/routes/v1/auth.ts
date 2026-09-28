import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPrisma } from "../../prisma.js";
import { authenticateToken, AuthenticatedRequest } from "../../middleware/auth.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-toktickit-jwt-secret-key";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "1d") as any;

// POST /api/v1/auth/login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body || {};

  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Account is inactive" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
      token,
    });
  } catch {
    res.status(500).json({ error: "Authentication failed due to a server error" });
  }
});

// GET /api/v1/auth/me
router.get("/me", authenticateToken, (req: Request, res: Response): void => {
  const user = (req as AuthenticatedRequest).user!;
  res.status(200).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

// POST /api/v1/auth/change-password
router.post("/change-password", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { newPassword, confirmPassword } = req.body || {};
  const authUser = (req as AuthenticatedRequest).user!;

  if (!newPassword || typeof newPassword !== "string" || !confirmPassword || typeof confirmPassword !== "string") {
    res.status(400).json({ error: "New password and password confirmation are required" });
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: "Password confirmation does not match new password" });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters long" });
    return;
  }

  try {
    const prisma = getPrisma();
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    });

    const newToken = jwt.sign(
      {
        userId: updatedUser.id,
        role: updatedUser.role,
        tokenVersion: updatedUser.tokenVersion,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(200).json({
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        mustChangePassword: updatedUser.mustChangePassword,
      },
      token: newToken,
    });
  } catch {
    res.status(500).json({ error: "Failed to change password due to a server error" });
  }
});

// POST /api/v1/auth/logout
router.post("/logout", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const authUser = (req as AuthenticatedRequest).user!;

  try {
    const prisma = getPrisma();
    await prisma.user.update({
      where: { id: authUser.id },
      data: { tokenVersion: { increment: 1 } },
    });

    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Logout failed due to a server error" });
  }
});

export default router;
