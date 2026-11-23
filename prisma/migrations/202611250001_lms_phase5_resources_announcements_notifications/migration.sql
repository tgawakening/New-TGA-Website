-- LMS Phase 5. Additive only: three new tables (LmsResource,
-- LmsAnnouncement, LmsNotification), their indexes, and foreign keys that
-- live on the new tables only (to SirahCohort.batchCode, LmsSession.id and
-- User.id). No existing table, column, index or row is altered or dropped.
-- Generated offline with `prisma migrate diff` (schema to schema); not run
-- against any database.

-- CreateTable
CREATE TABLE `LmsResource` (
    `id` VARCHAR(191) NOT NULL,
    `cohortId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `kind` ENUM('FILE', 'LINK') NOT NULL,
    `storageKey` VARCHAR(191) NULL,
    `url` VARCHAR(1024) NULL,
    `contentType` VARCHAR(191) NULL,
    `sizeBytes` BIGINT NULL,
    `originalFilename` VARCHAR(255) NULL,
    `visibility` ENUM('HIDDEN', 'PUBLISHED') NOT NULL DEFAULT 'HIDDEN',
    `publishedAt` DATETIME(3) NULL,
    `uploadedBy` VARCHAR(320) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LmsResource_storageKey_key`(`storageKey`),
    INDEX `LmsResource_cohortId_visibility_idx`(`cohortId`, `visibility`),
    INDEX `LmsResource_sessionId_visibility_idx`(`sessionId`, `visibility`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LmsAnnouncement` (
    `id` VARCHAR(191) NOT NULL,
    `cohortId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(320) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LmsAnnouncement_cohortId_publishedAt_idx`(`cohortId`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LmsNotification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `link` VARCHAR(1024) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dedupeKey` VARCHAR(191) NOT NULL,
    `emailState` VARCHAR(32) NULL,
    `emailAttempts` INTEGER NOT NULL DEFAULT 0,
    `emailLockedUntil` DATETIME(3) NULL,
    `emailSentAt` DATETIME(3) NULL,
    `emailProviderId` VARCHAR(191) NULL,
    `emailError` VARCHAR(500) NULL,

    UNIQUE INDEX `LmsNotification_dedupeKey_key`(`dedupeKey`),
    INDEX `LmsNotification_userId_readAt_idx`(`userId`, `readAt`),
    INDEX `LmsNotification_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `LmsNotification_emailState_emailLockedUntil_idx`(`emailState`, `emailLockedUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LmsResource` ADD CONSTRAINT `LmsResource_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `SirahCohort`(`batchCode`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LmsResource` ADD CONSTRAINT `LmsResource_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `LmsSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LmsAnnouncement` ADD CONSTRAINT `LmsAnnouncement_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `SirahCohort`(`batchCode`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LmsNotification` ADD CONSTRAINT `LmsNotification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

