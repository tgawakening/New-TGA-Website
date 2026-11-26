import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const file = (relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;
let role: string | null = null;
mock.module("server-only", { namedExports: {} });
mock.module("next/navigation", { namedExports: { redirect: (url: string) => { throw new Error(`redirect:${url}`); } } });
mock.module(file("../lib/auth/sirah-workspace.ts"), { namedExports: { getSirahWorkspaceAccess: async () => role ? { role } : null } });
let requireAccess: typeof import("../lib/sirah/course-revenue-access").requireCourseRevenueAccess;
before(async () => { ({ requireCourseRevenueAccess: requireAccess } = await import("../lib/sirah/course-revenue-access")); });
test("only super admins may read the course revenue report", async () => {
  role = null; await assert.rejects(requireAccess(), /redirect:.*login/);
  role = "MANAGER"; await assert.rejects(requireAccess(), /redirect:.*overview/);
  role = "COMMUNITY_LEAD"; await assert.rejects(requireAccess(), /redirect:.*overview/);
  role = "SUPER_ADMIN"; await assert.doesNotReject(requireAccess());
});
