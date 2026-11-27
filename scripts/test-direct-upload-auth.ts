import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
const file = (relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;
let identity: { id: string } | null = { id: "student-a" };
let visible = true;
let admin = false;
class TestError extends Error { constructor(message: string, public status = 400) { super(message); } }
mock.module("server-only", { namedExports: {} });
mock.module(file("../lib/auth/session.ts"), { namedExports: { getSessionIdentity: async () => identity } });
mock.module(file("../lib/lms/task-admin-access.ts"), { namedExports: { taskAdminRole: async () => admin ? "MANAGER" : null } });
mock.module(file("../lib/lms/tasks.ts"), { namedExports: { studentTaskDetail: async () => visible ? { id: "task-a" } : null } });
mock.module(file("../lib/sirah/http.ts"), { namedExports: { sirahExclusionActor: async () => "reviewer:staff", sirahUser: async () => ({ id: "student-a" }) } });
mock.module(file("../services/sirah-registration.service.ts"), { namedExports: { SirahError: TestError, ownedSirahOrder: async () => ({}) } });
mock.module(file("../lib/prisma.ts"), { namedExports: { prisma: { sirahOrder: { findUnique: async () => ({ id: "order-a" }) } } } });
let owner: typeof import("../lib/sirah/direct-upload-auth").directUploadOwner;
before(async () => { ({ directUploadOwner: owner } = await import("../lib/sirah/direct-upload-auth")); });
const request = new Request("https://example.test");
test("task upload tickets require a signed-in student with access", async () => {
  identity = { id: "student-a" }; visible = true;
  assert.equal(await owner(request, "task", "task-a"), "student-a");
  visible = false; await assert.rejects(() => owner(request, "task", "task-a"));
  visible = true; identity = null; await assert.rejects(() => owner(request, "task", "task-a"));
});
test("agreement tickets require an admin, anonymous registration needs a UUID scope", async () => {
  admin = false; await assert.rejects(() => owner(request, "agreement", "order-a"));
  admin = true; assert.equal(await owner(request, "agreement", "order-a"), "reviewer:staff");
  admin = false; await assert.rejects(() => owner(request, "admin-evidence", "order-a"));
  admin = true; assert.equal(await owner(request, "admin-evidence", "order-a"), "reviewer:staff");
  await assert.rejects(() => owner(request, "registration", "not-a-uuid"));
  const scope = "71ca2ef7-e3c4-4f26-a5c3-f8d4e11076a1";
  assert.equal(await owner(request, "registration", scope), scope);
});
test("staff receipt uploads require manager or super-admin access and a form scope", async () => {
  const scope = "71ca2ef7-e3c4-4f26-a5c3-f8d4e11076a1";
  admin = false;
  await assert.rejects(() => owner(request, "admin-registration", scope));
  admin = true;
  await assert.rejects(() => owner(request, "admin-registration", "invalid"));
  assert.equal(await owner(request, "admin-registration", scope), "reviewer:staff");
});
