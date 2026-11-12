-- Additive only: staff-confirmed "added to course group" tracking on SirahOrder.
-- No existing column, row or index is changed; no backfill.
ALTER TABLE `SirahOrder` ADD COLUMN `groupAddedAt` DATETIME(3) NULL, ADD COLUMN `groupAddedBy` VARCHAR(320) NULL;

-- CreateIndex
CREATE INDEX `SirahOrder_groupAddedAt_idx` ON `SirahOrder`(`groupAddedAt`);
