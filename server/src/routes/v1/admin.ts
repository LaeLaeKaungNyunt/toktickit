import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { getPrisma } from "../../prisma.js";
import { authenticateToken, requireRole, AuthenticatedRequest } from "../../middleware/auth.js";

const router = Router();
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERMITTED_ROLES = ["Requester", "IT Staff", "Administrator"];
const ALLOWED_PATCH_FIELDS = ["name", "email", "role", "isActive"];

// Apply authentication & Administrator role check to all admin routes
router.use(authenticateToken);
router.use(requireRole("Administrator"));

/**
 * GET /api/v1/admin/users
 * Search and list users with optional role filter
 */
router.get("/users", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, role } = req.query;

    if (role && typeof role === "string" && !PERMITTED_ROLES.includes(role)) {
      res.status(400).json({ error: "Invalid role filter" });
      return;
    }

    const prisma = getPrisma();
    const whereClause: any = {};

    if (role && typeof role === "string") {
      whereClause.role = role;
    }

    if (search && typeof search === "string" && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    res.status(200).json({ users });
  } catch {
    res.status(500).json({ error: "Unable to retrieve users" });
  }
});

/**
 * POST /api/v1/admin/users
 * Create a new user account with initial password requiring first password change
 */
router.post("/users", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, email, role, initialPassword, isActive } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }

  if (!role || typeof role !== "string" || !PERMITTED_ROLES.includes(role)) {
    res.status(400).json({ error: "Role must be Requester, IT Staff, or Administrator" });
    return;
  }

  if (!initialPassword || typeof initialPassword !== "string" || initialPassword.length < 8) {
    res.status(400).json({ error: "Initial password must be at least 8 characters long" });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const prisma = getPrisma();

    // Check email uniqueness
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      res.status(409).json({ error: "User with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(initialPassword, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        role,
        passwordHash,
        isActive: typeof isActive === "boolean" ? isActive : true,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
      },
    });

    res.status(201).json({ user });
  } catch {
    res.status(500).json({ error: "Unable to create user" });
  }
});

/**
 * PATCH /api/v1/admin/users/:userId
 * Update permitted editable account fields with safety enforcement
 */
router.patch("/users/:userId", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { userId } = req.params;

  if (!UUID_REGEX.test(userId)) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const body = req.body || {};
  const bodyKeys = Object.keys(body);

  if (bodyKeys.length === 0) {
    res.status(400).json({ error: "No fields provided to update" });
    return;
  }

  // Reject unsupported / protected fields
  const unsupportedKeys = bodyKeys.filter((key) => !ALLOWED_PATCH_FIELDS.includes(key));
  if (unsupportedKeys.length > 0) {
    res.status(400).json({ error: `Unsupported or protected fields cannot be updated: ${unsupportedKeys.join(", ")}` });
    return;
  }

  const { name, email, role, isActive } = body;

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    res.status(400).json({ error: "Name must be a non-empty string" });
    return;
  }

  if (email !== undefined && (typeof email !== "string" || !EMAIL_REGEX.test(email.trim()))) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }

  if (role !== undefined && (typeof role !== "string" || !PERMITTED_ROLES.includes(role))) {
    res.status(400).json({ error: "Role must be Requester, IT Staff, or Administrator" });
    return;
  }

  if (isActive !== undefined && typeof isActive !== "boolean") {
    res.status(400).json({ error: "isActive must be a boolean" });
    return;
  }

  try {
    const prisma = getPrisma();

    // Use transaction to enforce Administrator safety rules atomically
    const result = await prisma.$transaction(async (tx) => {
      const currentTarget = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!currentTarget) {
        return { status: 404, error: "User not found" };
      }

      // BR-26 / AC-35: Last active Administrator protection
      const nextRole = role !== undefined ? role : currentTarget.role;
      const nextActive = isActive !== undefined ? isActive : currentTarget.isActive;

      const isTargetActiveAdmin = currentTarget.role === "Administrator" && currentTarget.isActive;
      const willBeActiveAdmin = nextRole === "Administrator" && nextActive;

      if (isTargetActiveAdmin && !willBeActiveAdmin) {
        const activeAdminCount = await tx.user.count({
          where: { role: "Administrator", isActive: true },
        });

        if (activeAdminCount <= 1) {
          return { status: 409, error: "Operation not permitted: cannot deactivate or reassign the last active Administrator" };
        }
      }

      // BR-25 / AC-35: Administrator self-deactivation protection
      if (req.user!.id === userId && isActive === false) {
        return { status: 400, error: "An Administrator cannot deactivate their own account" };
      }

      // Unique email check if email is changing
      if (email !== undefined) {
        const cleanEmail = email.trim().toLowerCase();
        if (cleanEmail !== currentTarget.email.toLowerCase()) {
          const existing = await tx.user.findUnique({
            where: { email: cleanEmail },
          });

          if (existing) {
            return { status: 409, error: "User with this email already exists" };
          }
        }
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (email !== undefined) updateData.email = email.trim().toLowerCase();
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) {
        updateData.isActive = isActive;
        if (!isActive) {
          updateData.tokenVersion = { increment: 1 };
        }
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
        },
      });

      return { status: 200, user: updated };
    });

    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(200).json({ user: result.user });
  } catch {
    res.status(500).json({ error: "Unable to update user" });
  }
});

/**
 * POST /api/v1/admin/users/:userId/reset-password
 * Set a new initial password for a user, requiring change at next login and invalidating sessions
 */
router.post("/users/:userId/reset-password", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { userId } = req.params;

  if (!UUID_REGEX.test(userId)) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { initialPassword } = req.body || {};

  if (!initialPassword || typeof initialPassword !== "string" || initialPassword.length < 8) {
    res.status(400).json({ error: "Initial password must be at least 8 characters long" });
    return;
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const passwordHash = await bcrypt.hash(initialPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        tokenVersion: { increment: 1 },
      },
    });

    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Unable to reset user password" });
  }
});

export default router;
