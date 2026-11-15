// Production safety guard for destructive test scripts.
//
// Import this as the FIRST import of any script that writes to or wipes the
// database (e.g. prisma.*.deleteMany() with no where clause):
//
//   import "./assert-local-db";
//
// It runs on import, so it executes before any later import (lib/prisma,
// services, routes) is evaluated and before any query can be sent. Imports are
// hoisted, so calling a function below the imports would be too late.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function describe(raw: string | undefined): string {
  if (!raw) return "DATABASE_URL is not set";
  try {
    const url = new URL(raw);
    // Never echo credentials: report only protocol, host, port and database.
    return `DATABASE_URL points to ${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "DATABASE_URL could not be parsed as a URL";
  }
}

export function localDbHostname(raw: string | undefined): string | null {
  if (!raw) return null;
  let hostname: string;
  try {
    hostname = new URL(raw).hostname;
  } catch {
    return null;
  }
  // WHATWG URL keeps IPv6 brackets: mysql://u:p@[::1]:3306/db -> "[::1]".
  hostname = hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
  return LOCAL_HOSTS.has(hostname) ? hostname : null;
}

export function assertLocalDb(raw: string | undefined = process.env.DATABASE_URL): void {
  if (localDbHostname(raw)) return;
  throw new Error(
    [
      "REFUSED: this test script deletes database rows and will only run against a local database.",
      `${describe(raw)}.`,
      "Allowed hosts: localhost, 127.0.0.1, ::1.",
      "Refusing to run in order to protect production data. Point DATABASE_URL at a local test database",
      "(e.g. mysql://root:password@127.0.0.1:3306/sirah_test) and try again.",
    ].join("\n"),
  );
}

assertLocalDb();
