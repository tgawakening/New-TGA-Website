-- Additive only: new append-only table for Sirah workspace access changes.
-- No existing table, column, row or index is changed.
CREATE TABLE `SirahAccessAudit` (
    `id` VARCHAR(191) NOT NULL,
    `actor` VARCHAR(320) NOT NULL,
    `action` VARCHAR(32) NOT NULL,
    `targetUserId` VARCHAR(191) NULL,
    `targetEmail` VARCHAR(320) NOT NULL,
    `fromRole` VARCHAR(32) NULL,
    `toRole` VARCHAR(32) NULL,
    `fromStatus` VARCHAR(32) NULL,
    `toStatus` VARCHAR(32) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SirahAccessAudit_createdAt_idx`(`createdAt`),
    INDEX `SirahAccessAudit_targetEmail_createdAt_idx`(`targetEmail`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
