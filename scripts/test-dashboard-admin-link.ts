import { test } from "node:test";
import assert from "node:assert/strict";
import { canSeeDashboardAdminLink } from "../lib/auth/dashboard-admin-link";

const student = { email: "sirah-pk-returning-test@example.com", role: "STUDENT" };

test("a student without any admin session does not see the link", () => {
  assert.equal(canSeeDashboardAdminLink(student, null), false);
  assert.equal(canSeeDashboardAdminLink(student, undefined), false);
  assert.equal(canSeeDashboardAdminLink(student, ""), false);
});

test("regression: a super-admin cookie in the same browser does not leak the link to a student", () => {
  assert.equal(canSeeDashboardAdminLink(student, "admin@tga.example"), false);
});

test("the super admin signed in as their own account sees the link (email match is case-insensitive)", () => {
  assert.equal(
    canSeeDashboardAdminLink({ email: "Admin@TGA.example", role: "STUDENT" }, " admin@tga.example "),
    true,
  );
});

test("Sīrah team accounts (Manager / Community Lead) see the link without an admin cookie", () => {
  assert.equal(canSeeDashboardAdminLink({ email: "m@x.example", role: "SIRAH_REVIEWER" }, null), true);
  assert.equal(canSeeDashboardAdminLink({ email: "c@x.example", role: "SIRAH_VIEWER" }, null), true);
});

test("other roles do not see the link", () => {
  for (const role of ["ADMIN", "TEACHER", "", "sirah_reviewer"])
    assert.equal(canSeeDashboardAdminLink({ email: "x@x.example", role }, null), false);
});
