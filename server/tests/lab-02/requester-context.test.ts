import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { requesterContextMiddleware } from "../../src/middleware/requesterContext.js";
import { getPrisma } from "../../src/prisma.js";

describe("Requester Context Middleware (X-Dev-Requester-Id)", () => {
  function createMockReqRes(headerValue?: string) {
    const req = {
      header: (name: string) => {
        if (name.toLowerCase() === "x-dev-requester-id") return headerValue;
        return undefined;
      },
    } as unknown as Request;

    const resJson = vi.fn();
    const resStatus = vi.fn().mockReturnValue({ json: resJson });

    const res = {
      status: resStatus,
      json: resJson,
    } as unknown as Response;

    const next: NextFunction = vi.fn();

    return { req, res, next, resStatus, resJson };
  }

  it("returns 400 Bad Request if X-Dev-Requester-Id header is missing", async () => {
    const { req, res, next, resStatus, resJson } = createMockReqRes(undefined);

    await requesterContextMiddleware(req, res, next);

    expect(resStatus).toHaveBeenCalledWith(400);
    expect(resJson).toHaveBeenCalledWith({
      error: {
        code: "INVALID_REQUESTER_CONTEXT",
        message: "Missing or invalid X-Dev-Requester-Id context header",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 Bad Request if X-Dev-Requester-Id header is not a valid UUID", async () => {
    const { req, res, next, resStatus, resJson } = createMockReqRes("invalid-uuid");

    await requesterContextMiddleware(req, res, next);

    expect(resStatus).toHaveBeenCalledWith(400);
    expect(resJson).toHaveBeenCalledWith({
      error: {
        code: "INVALID_REQUESTER_CONTEXT",
        message: "Missing or invalid X-Dev-Requester-Id context header",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 Bad Request if X-Dev-Requester-Id references an unknown UUID", async () => {
    const { req, res, next, resStatus, resJson } = createMockReqRes(
      "00000000-0000-0000-0000-000000000000"
    );

    await requesterContextMiddleware(req, res, next);

    expect(resStatus).toHaveBeenCalledWith(400);
    expect(resJson).toHaveBeenCalledWith({
      error: {
        code: "INVALID_REQUESTER_CONTEXT",
        message: "Missing or invalid X-Dev-Requester-Id context header",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 Bad Request if X-Dev-Requester-Id references an inactive Development Requester", async () => {
    const prisma = getPrisma();
    const inactiveReq = await prisma.developmentRequester.findFirst({
      where: { isActive: false },
    });
    expect(inactiveReq).toBeDefined();

    const { req, res, next, resStatus, resJson } = createMockReqRes(inactiveReq!.id);

    await requesterContextMiddleware(req, res, next);

    expect(resStatus).toHaveBeenCalledWith(400);
    expect(resJson).toHaveBeenCalledWith({
      error: {
        code: "INVALID_REQUESTER_CONTEXT",
        message: "Missing or invalid X-Dev-Requester-Id context header",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and attaches devRequester when X-Dev-Requester-Id is a valid active requester UUID", async () => {
    const prisma = getPrisma();
    const activeReq = await prisma.developmentRequester.findFirst({
      where: { isActive: true },
    });
    expect(activeReq).toBeDefined();

    const { req, res, next } = createMockReqRes(activeReq!.id);

    await requesterContextMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).devRequester).toBeDefined();
    expect((req as any).devRequester.id).toBe(activeReq!.id);
  });
});
