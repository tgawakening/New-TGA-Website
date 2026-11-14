-- Additive only: super-admin "test / exclude from analytics" flag on SirahOrder,
-- plus an append-only log of permanently deleted payment-free test orders.
-- No existing column, row or index is changed; no backfill (null = included).
ALTER TABLE `SirahOrder` ADD COLUMN `excludedAt` DATETIME(3) NULL, ADD COLUMN `excludedBy` VARCHAR(320) NULL;

-- CreateIndex
CREATE INDEX `SirahOrder_excludedAt_idx` ON `SirahOrder`(`excludedAt`);

-- CreateTable
CREATE TABLE `SirahRecordDeletion` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `actor` VARCHAR(320) NOT NULL,
    `snapshot` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SirahRecordDeletion_createdAt_idx`(`createdAt`),
    INDEX `SirahRecordDeletion_reference_idx`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
