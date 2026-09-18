import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Lab 3 Auth API (/api/v1/auth)", () => {
  beforeAll(async () => {
    // Ensure DB has seeded data
  });

  afterAll(async () => {
    await getPrisma().$disconnect();
  });

  it("AC-01: Valid login returns 200, user DTO, and JWT token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "alice.smith@university.edu", password: "Password123!" });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe("alice.smith@university.edu");
    expect(res.body.user.role).toBe("Requester");
    expect(res.body.user.mustChangePassword).toBe(false);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe("string");
  });

  it("AC-02: Invalid password returns 401 Unauthorized without exposing sensitive info", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "alice.smith@university.edu", password: "WrongPassword" });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("AC-02: Unknown email returns 401 Unauthorized without exposing account existence", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nonexistent@university.edu", password: "Password123!" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("AC-03: Inactive account returns 403 Forbidden upon login", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "eve.mallary@university.edu", password: "Password123!" });

    expect(res.status).toBe(403);
    expect(res.body.token).toBeUndefined();
    expect(res.body.error).toBe("Account is inactive");
  });

  it("AC-05: GET /api/v1/auth/me returns authenticated user context", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "staff1@university.edu", password: "Password123!" });

    const token = loginRes.body.token;

    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe("staff1@university.edu");
    expect(meRes.body.user.role).toBe("IT Staff");
    expect(meRes.body.user.passwordHash).toBeUndefined();
  });

  it("GET /api/v1/auth/me returns 401 when token is missing or invalid", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);

    const resInvalid = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer invalid-token-string");
    expect(resInvalid.status).toBe(401);
  });

  it("AC-04: Mandatory password change gate blocks restricted endpoints", async () => {
    const prisma = getPrisma();
    const bcrypt = await import("bcryptjs");
    const initialHash = await bcrypt.default.hash("InitialPassword123!", 10);
    await prisma.user.update({
      where: { email: "initial.user@university.edu" },
      data: {
        passwordHash: initialHash,
        mustChangePassword: true,
      },
    });

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "initial.user@university.edu", password: "InitialPassword123!" });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.mustChangePassword).toBe(true);
    const token = loginRes.body.token;

    // /auth/me is permitted
    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(meRes.status).toBe(200);

    // Requesting restricted application endpoint before password change is blocked
    const restrictedRes = await request(app)
      .get("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`);
    expect(restrictedRes.status).toBe(403);
    expect(restrictedRes.body.code).toBe("PASSWORD_CHANGE_REQUIRED");

    // Change password succeeds
    const changeRes = await request(app)
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        newPassword: "NewSecurePassword123!",
        confirmPassword: "NewSecurePassword123!",
      });

    expect(changeRes.status).toBe(200);
    expect(changeRes.body.user.mustChangePassword).toBe(false);
    expect(changeRes.body.token).toBeDefined();

    const replacementToken = changeRes.body.token;

    // Requesting restricted application endpoint after password change succeeds with replacement token
    const postChangeRestrictedRes = await request(app)
      .get("/api/v1/tickets")
      .set("Authorization", `Bearer ${replacementToken}`);
    expect(postChangeRestrictedRes.status).toBe(200);

    // Verify login with new password works
    const newLoginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "initial.user@university.edu", password: "NewSecurePassword123!" });
    expect(newLoginRes.status).toBe(200);
  });

  it("AC-06: Logout invalidates the active authenticated token (returns 401 on subsequent requests)", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@university.edu", password: "Password123!" });

    const token = loginRes.body.token;

    // Verify token works before logout
    const preLogoutRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(preLogoutRes.status).toBe(200);

    // Logout
    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(logoutRes.status).toBe(204);

    // Verify token used BEFORE logout now fails with 401 Unauthorized
    const postLogoutRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(postLogoutRes.status).toBe(401);
    expect(postLogoutRes.body.error).toBe("Session has been invalidated");
  });
});
