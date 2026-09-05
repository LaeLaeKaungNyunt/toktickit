import { Router, Request, Response } from "express";
import { getPrisma } from "../../prisma.js";

const router = Router();

// GET /api/v1/development-requesters (AC-01, AC-02)
router.get("/development-requesters", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const items = await prisma.developmentRequester.findMany({
      where: { isActive: true },
      select: {
        id: true,
        displayName: true,
        email: true,
      },
      orderBy: { displayName: "asc" },
    });

    res.status(200).json({ items });
  } catch {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to load Development Requesters",
      },
    });
  }
});

// GET /api/v1/categories (AC-04)
router.get("/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const items = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { id: "asc" },
    });

    res.status(200).json({ items });
  } catch {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to load Categories",
      },
    });
  }
});

// GET /api/v1/related-systems (AC-04)
router.get("/related-systems", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const items = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({ items });
  } catch {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to load Related Systems",
      },
    });
  }
});

export default router;
