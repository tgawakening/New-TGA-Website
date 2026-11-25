import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test, { mock } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("node:module") as { _extensions: Record<string, (m: { exports: unknown }) => void> };
Module._extensions[".css"] = (m) => { m.exports = new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) }); };
const file = (p: string) => pathToFileURL(path.resolve(__dirname, p)).href;
type Role = "SUPER_ADMIN" | "MANAGER" | "COMMUNITY_LEAD";
let role: Role = "SUPER_ADMIN";
mock.module("server-only", { namedExports: {} });
mock.module("next/navigation", { namedExports: { usePathname: () => "/admin/sirah/overview", redirect: (url: string) => { throw Error(`redirect:${url}`); } } });
mock.module(file("../lib/auth/sirah-workspace.ts"), { namedExports: { getSirahWorkspaceAccess: async () => ({ role, readOnly: role !== "SUPER_ADMIN" }) } });
mock.module(file("../services/sirah-group.service.ts"), { namedExports: { sirahOverviewCounts: async () => ({ total: 4, paid: 2, pending: 1, needsReview: 1, groupAdded: 1, groupNotAdded: 1, excluded: 0, archived: 0 }) } });
mock.module(file("../components/sirah/admin-cohort.tsx"), { namedExports: { SirahAdminCohort: () => React.createElement("span", null, "Cohort settings") } });
mock.module(file("../components/sirah/admin-payment-totals.tsx"), { namedExports: { SirahPaymentsReceived: () => React.createElement("span", null, "Payments received totals") } });
mock.module(file("../components/admin/admin-logout-button.tsx"), { defaultExport: () => null });
mock.module(file("../components/sirah/admin-app.tsx"), { namedExports: { SirahAppInstallButton: () => null } });
mock.module(file("../components/brand-logo.tsx"), { namedExports: { BrandLogo: () => null } });

test("overview keeps counts visible and renders totals only to the Super Admin", async () => {
  const { default: Overview } = await import("../app/admin/sirah/(workspace)/overview/page");
  for (const current of ["SUPER_ADMIN", "MANAGER", "COMMUNITY_LEAD"] as const) {
    role = current;
    const html = renderToStaticMarkup(await Overview());
    assert.match(html, /Total registered/);
    assert.equal(html.includes("Payments received totals"), current === "SUPER_ADMIN");
    if (current === "COMMUNITY_LEAD") assert.doesNotMatch(html, /href="\/admin\/sirah(?:\?|")/);
  }
});
test("workspace navigation follows role access", async () => {
  const { SirahAdminShell } = await import("../components/sirah/admin-shell");
  for (const current of ["SUPER_ADMIN", "MANAGER", "COMMUNITY_LEAD"] as const) {
    const canManage = current !== "COMMUNITY_LEAD";
    const html = renderToStaticMarkup(<SirahAdminShell access={{ role: current, roleLabel: current, canCreateDiscountCodes: canManage, canManageEnrolments: canManage, canManageAccess: current === "SUPER_ADMIN" }} signedInAs="test">content</SirahAdminShell>);
    assert.equal(html.includes(">Students<"), canManage);
    assert.equal(html.includes("Payments and reviews"), canManage);
    assert.equal(html.includes("Main dashboard"), current === "SUPER_ADMIN");
    assert.ok(html.includes("Live sessions"));
    assert.ok(html.includes("Resources and notices"));
  }
});
