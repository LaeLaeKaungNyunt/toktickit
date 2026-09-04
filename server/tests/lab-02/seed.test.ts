import { describe, it, expect } from "vitest";
import { getPrisma } from "../../src/prisma.js";

describe("Database Seed Verification (Issue #12)", () => {
  it("has seeded the required 4 categories", async () => {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({ orderBy: { id: "asc" } });

    expect(categories.length).toBeGreaterThanOrEqual(4);
    const names = categories.map((c) => c.name);
    expect(names).toContain("Account and Access");
    expect(names).toContain("Hardware");
    expect(names).toContain("Software");
    expect(names).toContain("Network");
  });

  it("has seeded at least 4 active Development Requesters and 1 inactive Development Requester", async () => {
    const prisma = getPrisma();
    const activeRequesters = await prisma.developmentRequester.findMany({
      where: { isActive: true },
    });
    const inactiveRequesters = await prisma.developmentRequester.findMany({
      where: { isActive: false },
    });

    expect(activeRequesters.length).toBeGreaterThanOrEqual(4);
    expect(inactiveRequesters.length).toBeGreaterThanOrEqual(1);

    for (const requester of activeRequesters) {
      expect(requester.id).toBeDefined();
      expect(requester.displayName).toBeDefined();
      expect(requester.email).toBeDefined();
      expect(requester.isActive).toBe(true);
    }
  });

  it("has seeded at least 6 realistic active Related Systems", async () => {
    const prisma = getPrisma();
    const activeSystems = await prisma.relatedSystem.findMany({
      where: { isActive: true },
    });

    expect(activeSystems.length).toBeGreaterThanOrEqual(6);
    for (const system of activeSystems) {
      expect(system.id).toBeDefined();
      expect(system.name).toBeDefined();
      expect(system.isActive).toBe(true);
    }
  });
});
