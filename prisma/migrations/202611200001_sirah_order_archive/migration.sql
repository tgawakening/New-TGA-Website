-- Additive only: soft-delete ("archive") timestamp on SirahOrder.
-- Nullable, no default, no backfill (null = not archived). No existing column,
-- row or index is changed or dropped.
ALTER TABLE `SirahOrder` ADD COLUMN `archivedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `SirahOrder_archivedAt_idx` ON `SirahOrder`(`archivedAt`);
