import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
const file = (relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;
let role: string | null = null;
let creates = 0;
class TestError extends Error { constructor(message: string, public status = 400) { super(message); } }
mock.module("server-only", { namedExports: {} });
mock.module(file("../lib/lms/task-admin-access.ts"), { namedExports: { taskAdminRole: async () => role } });
mock.module(file("../lib/sirah/http.ts"), { namedExports: {
  checkSirahOrigin: () => {}, privateJson: (value: unknown) => Response.json(value),
  sirahExclusionActor: async () => "reviewer:test",
  sirahResponseError: (error: TestError) => Response.json({ error: error.message }, { status: error.status || 500 }),
} });
mock.module(file("../services/sirah-registration.service.ts"), { namedExports: { SirahError: TestError } });
class Existing extends TestError { existing = { id: "existing", reference: "SIRAH-EXISTING" }; constructor() { super("Already exists", 409); } }
mock.module(file("../services/sirah-admin-paid-registration.service.ts"), { namedExports: {
  adminRegistrationCohorts: async () => ["cohort"],
  adminPaidRegistrationSchema: { safeParse: (value: unknown) => ({ success: true, data: value }) },
  createAdminPaidRegistration: async () => { creates++; return { id: "new", reference: "SIRAH-NEW" }; },
  ExistingSirahRegistration: Existing,
} });
let route: typeof import("../app/api/admin/sirah/paid-registration/route");
before(async () => { route = await import("../app/api/admin/sirah/paid-registration/route"); });
const req = () => new Request("https://example.test/api/admin/sirah/paid-registration", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
test("community lead and anonymous roles cannot create paid registrations", async () => {
  role = null;
  assert.equal((await route.POST(req())).status, 403);
  assert.equal(creates, 0);
});
test("manager may submit the registration", async () => {
  role = "MANAGER";
  assert.equal((await route.POST(req())).status, 200);
  assert.equal(creates, 1);
});
