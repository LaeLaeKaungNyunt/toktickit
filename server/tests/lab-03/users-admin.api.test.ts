import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-toktickit-jwt-secret-key";

function createToken(userId: string, role: string, tokenVersion = 0) {
  return jwt.sign({ userId, role, tokenVersion }, JWT_SECRET, { expiresIn: "8h" });
}

describe("Lab 3 Administrator User Management API (Issue #27)", () => {
  let adminToken: string;
  let adminUser: any;
  let staffToken: string;
  let staffUser: any;
  let requesterToken: string;
  let requesterUser: any;

  let createdTestUserId: string;

  beforeAll(async () => {
    const prisma = getPrisma();

    // Create dedicated isolated test users to prevent interference with shared seeded users
    adminUser = await prisma.user.upsert({
      where: { email: "users.admin.test.admin@university.edu" },
      update: { isActive: true, role: "Administrator", tokenVersion: 0 },
      create: {
        name: "Dedicated Test Admin",
        email: "users.admin.test.admin@university.edu",
        role: "Administrator",
        passwordHash: "hash",
        isActive: true,
        mustChangePassword: false,
      },
    });

    staffUser = await prisma.user.upsert({
      where: { email: "users.admin.test.staff@university.edu" },
      update: { isActive: true, role: "IT Staff", tokenVersion: 0 },
      create: {
        name: "Dedicated Test Staff",
        email: "users.admin.test.staff@university.edu",
        role: "IT Staff",
        passwordHash: "hash",
        isActive: true,
        mustChangePassword: false,
      },
    });

    requesterUser = await prisma.user.upsert({
      where: { email: "users.admin.test.req@university.edu" },
      update: { isActive: true, role: "Requester", tokenVersion: 0 },
      create: {
        name: "Dedicated Test Requester",
        email: "users.admin.test.req@university.edu",
        role: "Requester",
        passwordHash: "hash",
        isActive: true,
        mustChangePassword: false,
      },
    });

    adminToken = createToken(adminUser.id, adminUser.role, adminUser.tokenVersion);
    staffToken = createToken(staffUser.id, staffUser.role, staffUser.tokenVersion);
    requesterToken = createToken(requesterUser.id, requesterUser.role, requesterUser.tokenVersion);
  });

  afterAll(async () => {
    const prisma = getPrisma();
    if (createdTestUserId) {
      await prisma.user.deleteMany({
        where: { id: createdTestUserId },
      });
    }

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            "users.admin.test.admin@university.edu",
            "users.admin.test.staff@university.edu",
            "users.admin.test.req@university.edu",
          ],
        },
      },
    });

    await prisma.$disconnect();
  });

  // AC-36: Direct API Authorization Boundaries
  describe("AC-36: Direct API Authorization Boundaries", () => {
    it("Requester direct access is rejected with 403 Forbidden", async () => {
      const getRes = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${requesterToken}`);
      expect(getRes.status).toBe(403);
      expect(getRes.body.error).toBe("Forbidden: insufficient permissions");

      const postRes = await request(app)
        .post("/api/v1/admin/users")
        .set("Authorization", `Bearer ${requesterToken}`)
        .send({ name: "Hacker", email: "hacker@test.com", role: "Requester", initialPassword: "Password123!" });
      expect(postRes.status).toBe(403);

      const patchRes = await request(app)
        .patch(`/api/v1/admin/users/${staffUser.id}`)
        .set("Authorization", `Bearer ${requesterToken}`)
        .send({ name: "Attempt" });
      expect(patchRes.status).toBe(403);

      const resetRes = await request(app)
        .post(`/api/v1/admin/users/${staffUser.id}/reset-password`)
        .set("Authorization", `Bearer ${requesterToken}`)
        .send({ initialPassword: "Password123!" });
      expect(resetRes.status).toBe(403);
    });

    it("IT Staff direct access is rejected with 403 Forbidden", async () => {
      const getRes = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${staffToken}`);
      expect(getRes.status).toBe(403);

      const postRes = await request(app)
        .post("/api/v1/admin/users")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ name: "Staff Created", email: "staffcreated@test.com", role: "Requester", initialPassword: "Password123!" });
      expect(postRes.status).toBe(403);
    });
  });

  // AC-29 & AC-30: List Users, Search, Role Filtering
  describe("AC-29 & AC-30: GET /api/v1/admin/users", () => {
    it("Administrator can list all users and passwordHash is never returned", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBeGreaterThan(0);

      for (const u of res.body.users) {
        expect(u.id).toBeDefined();
        expect(u.name).toBeDefined();
        expect(u.email).toBeDefined();
        expect(u.role).toBeDefined();
        expect(u.isActive).toBeDefined();
        expect(u.mustChangePassword).toBeDefined();
        expect(u.passwordHash).toBeUndefined();
      }
    });

    it("Search users by name or email", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users?search=Alice")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.users.some((u: any) => u.email === "alice.smith@university.edu")).toBe(true);
    });

    it("Role filter returns only users matching that role", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users?role=IT%20Staff")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.users.every((u: any) => u.role === "IT Staff")).toBe(true);
    });

    it("Invalid role filter returns 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users?role=SuperAdmin")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid role filter");
    });
  });

  // AC-31 & AC-32: User Creation and Validation
  describe("AC-31 & AC-32: POST /api/v1/admin/users", () => {
    it("Creates a new user successfully with mustChangePassword: true", async () => {
      const testEmail = `newuser.${Date.now()}@university.edu`;
      const res = await request(app)
        .post("/api/v1/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "New Test User",
          email: testEmail,
          role: "IT Staff",
          initialPassword: "InitialPass123!",
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe("New Test User");
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.role).toBe("IT Staff");
      expect(res.body.user.isActive).toBe(true);
      expect(res.body.user.mustChangePassword).toBe(true);
      expect(res.body.user.passwordHash).toBeUndefined();

      createdTestUserId = res.body.user.id;

      // Verify the new user can log in and receives mustChangePassword: true
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: testEmail, password: "InitialPass123!" });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.mustChangePassword).toBe(true);
    });

    it("Rejects creation with duplicate email with 409 Conflict", async () => {
      const res = await request(app)
        .post("/api/v1/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Duplicate User",
          email: "alice.smith@university.edu",
          role: "Requester",
          initialPassword: "Password123!",
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("User with this email already exists");
    });

    it("Rejects creation with password shorter than 8 characters", async () => {
      const res = await request(app)
        .post("/api/v1/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Short Pass User",
          email: "shortpass@university.edu",
          role: "Requester",
          initialPassword: "short",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Initial password must be at least 8 characters long");
    });

    it("Rejects creation with invalid role", async () => {
      const res = await request(app)
        .post("/api/v1/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Invalid Role User",
          email: "invalidrole@university.edu",
          role: "Manager",
          initialPassword: "Password123!",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Role must be Requester, IT Staff, or Administrator");
    });
  });

  // AC-33: Edit User
  describe("AC-33: PATCH /api/v1/admin/users/:userId", () => {
    it("Updates user details cleanly", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${createdTestUserId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Updated Name",
          role: "Requester",
        });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe("Updated Name");
      expect(res.body.user.role).toBe("Requester");
    });

    it("Rejects update with unsupported protected fields", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${createdTestUserId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          passwordHash: "hacked",
          tokenVersion: 99,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Unsupported or protected fields cannot be updated");
    });

    it("Returns 404 for non-existent target user", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/users/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Nobody" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("User not found");
    });
  });

  // AC-34: Reset Initial Password
  describe("AC-34: POST /api/v1/admin/users/:userId/reset-password", () => {
    it("Administrator can set a new initial password requiring change at next login", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${createdTestUserId}/reset-password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ initialPassword: "NewResetPass123!" });

      expect(res.status).toBe(204);

      // Verify user must change password and can log in with new reset password
      const userInDb = await getPrisma().user.findUnique({ where: { id: createdTestUserId } });
      expect(userInDb?.mustChangePassword).toBe(true);

      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: userInDb!.email, password: "NewResetPass123!" });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.mustChangePassword).toBe(true);
    });
  });

  // AC-35: Administrator Safety Rules
  describe("AC-35: Administrator Safety Rules", () => {
    it("Administrator cannot deactivate their own account when another active Administrator exists", async () => {
      const prisma = getPrisma();

      // Create a temporary second active Administrator to ensure activeAdminCount >= 2
      const secondAdmin = await prisma.user.create({
        data: {
          name: "Second Active Admin",
          email: `second.admin.${Date.now()}@university.edu`,
          role: "Administrator",
          passwordHash: "hash",
          isActive: true,
          mustChangePassword: false,
        },
      });

      try {
        const res = await request(app)
          .patch(`/api/v1/admin/users/${adminUser.id}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ isActive: false });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("An Administrator cannot deactivate their own account");
      } finally {
        await prisma.user.delete({ where: { id: secondAdmin.id } });
      }
    });

    it("System rejects deactivating the last active Administrator with 409 Conflict", async () => {
      const prisma = getPrisma();

      const isolatedSingleAdmin = await prisma.user.create({
        data: {
          name: "Isolated Single Admin",
          email: `isolated.single.admin.${Date.now()}@university.edu`,
          role: "Administrator",
          passwordHash: "hash",
          isActive: true,
          mustChangePassword: false,
        },
      });

      const isolatedToken = createToken(isolatedSingleAdmin.id, isolatedSingleAdmin.role, isolatedSingleAdmin.tokenVersion);

      const otherAdmins = await prisma.user.findMany({
        where: { role: "Administrator", isActive: true, NOT: { id: isolatedSingleAdmin.id } },
      });

      try {
        if (otherAdmins.length > 0) {
          await prisma.user.updateMany({
            where: { id: { in: otherAdmins.map((a) => a.id) } },
            data: { isActive: false },
          });
        }

        const res = await request(app)
          .patch(`/api/v1/admin/users/${isolatedSingleAdmin.id}`)
          .set("Authorization", `Bearer ${isolatedToken}`)
          .send({ isActive: false });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe("Operation not permitted: cannot deactivate or reassign the last active Administrator");
      } finally {
        if (otherAdmins.length > 0) {
          await prisma.user.updateMany({
            where: { id: { in: otherAdmins.map((a) => a.id) } },
            data: { isActive: true },
          });
        }
        await prisma.user.delete({ where: { id: isolatedSingleAdmin.id } });
      }
    });

    it("System rejects reassigning the role of the last active Administrator with 409 Conflict", async () => {
      const prisma = getPrisma();

      const isolatedSingleAdmin = await prisma.user.create({
        data: {
          name: "Isolated Single Admin 2",
          email: `isolated.single.admin2.${Date.now()}@university.edu`,
          role: "Administrator",
          passwordHash: "hash",
          isActive: true,
          mustChangePassword: false,
        },
      });

      const isolatedToken = createToken(isolatedSingleAdmin.id, isolatedSingleAdmin.role, isolatedSingleAdmin.tokenVersion);

      const otherAdmins = await prisma.user.findMany({
        where: { role: "Administrator", isActive: true, NOT: { id: isolatedSingleAdmin.id } },
      });

      try {
        if (otherAdmins.length > 0) {
          await prisma.user.updateMany({
            where: { id: { in: otherAdmins.map((a) => a.id) } },
            data: { isActive: false },
          });
        }

        const reassignRes = await request(app)
          .patch(`/api/v1/admin/users/${isolatedSingleAdmin.id}`)
          .set("Authorization", `Bearer ${isolatedToken}`)
          .send({ role: "Requester" });

        expect(reassignRes.status).toBe(409);
        expect(reassignRes.body.error).toBe("Operation not permitted: cannot deactivate or reassign the last active Administrator");
      } finally {
        if (otherAdmins.length > 0) {
          await prisma.user.updateMany({
            where: { id: { in: otherAdmins.map((a) => a.id) } },
            data: { isActive: true },
          });
        }
        await prisma.user.delete({ where: { id: isolatedSingleAdmin.id } });
      }
    });
  });
});
