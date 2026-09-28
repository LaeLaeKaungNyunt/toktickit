import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Legacy X-Dev-Requester-Id Rejection (Repurposed for Issue #24)", () => {
  it("rejects GET /api/v1/tickets when X-Dev-Requester-Id is provided without JWT with 401 Unauthorized", async () => {
    const prisma = getPrisma();
    const activeReq = await prisma.user.findFirst({
      where: { role: "Requester", isActive: true },
    });
    expect(activeReq).not.toBeNull();

    const res = await request(app)
      .get("/api/v1/tickets")
      .set("X-Dev-Requester-Id", activeReq!.id);

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("rejects POST /api/v1/tickets when X-Dev-Requester-Id is provided without JWT with 401 Unauthorized", async () => {
    const prisma = getPrisma();
    const activeReq = await prisma.user.findFirst({
      where: { role: "Requester", isActive: true },
    });

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("X-Dev-Requester-Id", activeReq!.id)
      .send({
        summary: "Test summary",
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("rejects GET /api/v1/tickets/:ticketId when X-Dev-Requester-Id is provided without JWT with 401 Unauthorized", async () => {
    const prisma = getPrisma();
    const activeReq = await prisma.user.findFirst({
      where: { role: "Requester", isActive: true },
    });

    const res = await request(app)
      .get("/api/v1/tickets/00000000-0000-0000-0000-000000000000")
      .set("X-Dev-Requester-Id", activeReq!.id);

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
