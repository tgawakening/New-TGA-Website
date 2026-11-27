-- Optional per-teacher agreed share. NULL = use the course default (70%).
ALTER TABLE `ZoomHost` ADD COLUMN `revenueSharePercent` DECIMAL(5, 2) NULL;

-- Append-only advances ledger. Each row is one admin action, so the table is its
-- own audit history: positive = advance given (e.g. 30000 GBP = £300),
-- negative = advance reduced or recovered. Rows are never edited or deleted.
CREATE TABLE `TeacherAdvance` (
    `id` VARCHAR(191) NOT NULL,
    `zoomHostId` VARCHAR(191) NOT NULL,
    `amountMinor` INTEGER NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `occurredOn` DATE NOT NULL,
    `createdBy` VARCHAR(320) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `TeacherAdvance_zoomHostId_currency_idx`(`zoomHostId`, `currency`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TeacherAdvance` ADD CONSTRAINT `TeacherAdvance_zoomHostId_fkey`
  FOREIGN KEY (`zoomHostId`) REFERENCES `ZoomHost`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
