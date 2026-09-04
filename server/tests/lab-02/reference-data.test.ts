import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("Lab 2 Reference Data Endpoints", () => {
  describe("GET /api/v1/development-requesters (AC-01, AC-02, AC-04)", () => {
    it("returns 200 OK with active development requesters wrapped in items array", async () => {
      const res = await request(app).get("/api/v1/development-requesters");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("items");
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThanOrEqual(4);

      for (const reqItem of res.body.items) {
        expect(reqItem).toHaveProperty("id");
        expect(reqItem).toHaveProperty("displayName");
        expect(reqItem).toHaveProperty("email");
        expect(reqItem).not.toHaveProperty("isActive");
      }
    });

    it("excludes inactive development requesters (AC-02)", async () => {
      const res = await request(app).get("/api/v1/development-requesters");

      expect(res.status).toBe(200);
      const emails = res.body.items.map((i: { email: string }) => i.email);
      expect(emails).not.toContain("eve.mallary@university.edu");
    });
  });

  describe("GET /api/v1/categories (AC-04)", () => {
    it("returns 200 OK with categories wrapped in items array", async () => {
      const res = await request(app).get("/api/v1/categories");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("items");
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThanOrEqual(4);

      const names = res.body.items.map((c: { name: string }) => c.name);
      expect(names).toContain("Account and Access");
      expect(names).toContain("Hardware");
      expect(names).toContain("Software");
      expect(names).toContain("Network");
    });
  });

  describe("GET /api/v1/related-systems (AC-04)", () => {
    it("returns 200 OK with active related systems wrapped in items array", async () => {
      const res = await request(app).get("/api/v1/related-systems");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("items");
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThanOrEqual(6);

      for (const sysItem of res.body.items) {
        expect(sysItem).toHaveProperty("id");
        expect(sysItem).toHaveProperty("name");
        expect(sysItem).not.toHaveProperty("isActive");
      }
    });
  });
});
