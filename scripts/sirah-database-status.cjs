/* Read-only production preflight. Never creates tables, baselines, or changes data. */
let prisma;
const required = [
  "SirahOrder",
  "SirahReceipt",
  "SirahAudit",
  "SirahPaymentEvent",
  "SirahNotification",
];
(async () => {
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient({ log: [] });
  const tables =
    await prisma.$queryRaw`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`;
  const names = new Set(tables.map((row) => row.name));
  const historyExists = names.has("_prisma_migrations");
  const missing = required.filter((name) => !names.has(name));
  console.log(
    "Sīrah registration tables:",
    missing.length ? `missing ${missing.join(", ")}` : "all five present",
  );
  console.log(
    "Prisma migration history:",
    historyExists ? "present" : "absent",
  );
  if (historyExists) {
    const rows =
      await prisma.$queryRaw`SELECT migration_name AS name, finished_at AS finished, rolled_back_at AS rolledBack FROM _prisma_migrations ORDER BY started_at`;
    const failed = rows.filter((row) => !row.finished && !row.rolledBack);
    console.log("Unresolved migrations:", failed.length);
    console.log(
      "Sīrah migration completed:",
      rows.some(
        (row) =>
          row.name === "202611070001_sirah_registration_workflow" &&
          row.finished &&
          !row.rolledBack,
      ),
    );
    if (failed.length) {
      console.log(
        "Resolve the migration failure before deploying another migration.",
      );
      process.exitCode = 2;
    } else if (missing.length)
      console.log(
        "Next: npm run prisma:migrate:deploy, then run this status command again.",
      );
  } else if (tables.length) {
    console.log(
      "STOP: existing tables have no Prisma migration history. Compare the existing schema and establish a verified baseline before migrate deploy. Do not use migrate reset or db push.",
    );
    process.exitCode = 2;
  } else console.log("Fresh empty schema: npm run prisma:migrate:deploy.");
})()
  .catch(() => {
    console.error(
      "Could not inspect the database. Check the host DATABASE_URL, CA certificate and trusted-source connection settings. No database changes were attempted.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma?.$disconnect());
