-- Additive only: three new tables (ZoomHost, LmsSession, ZoomWebhookEvent)
-- and two foreign keys from the new LmsSession table. No existing table,
-- column, row or index is altered or dropped. LmsSession.cohortId references
-- the existing SirahCohort.batchCode (ON DELETE RESTRICT), which adds no
-- column to SirahCohort.

-- CreateTable
CREATE TABLE `ZoomHost` (
    `id` VARCHAR(191) NOT NULL,
    `zoomUserId` VARCHAR(64) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `licensed` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ZoomHost_zoomUserId_key`(`zoomUserId`),
    INDEX `ZoomHost_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LmsSession` (
    `id` VARCHAR(191) NOT NULL,
    `cohortId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `durationMin` INTEGER NOT NULL,
    `status` ENUM('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `zoomHostId` VARCHAR(191) NOT NULL,
    `zoomMeetingId` VARCHAR(64) NULL,
    `zoomMeetingUuid` VARCHAR(128) NULL,
    `zoomOccurrenceId` VARCHAR(64) NULL,
    `joinUrlEncrypted` TEXT NULL,
    `passcodeEncrypted` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LmsSession_cohortId_startsAt_idx`(`cohortId`, `startsAt`),
    INDEX `LmsSession_zoomHostId_startsAt_idx`(`zoomHostId`, `startsAt`),
    INDEX `LmsSession_zoomMeetingId_idx`(`zoomMeetingId`),
    INDEX `LmsSession_status_startsAt_idx`(`status`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ZoomWebhookEvent` (
    `id` VARCHAR(191) NOT NULL,
    `dedupeKey` VARCHAR(64) NOT NULL,
    `event` VARCHAR(128) NOT NULL,
    `payload` JSON NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,
    `error` TEXT NULL,

    UNIQUE INDEX `ZoomWebhookEvent_dedupeKey_key`(`dedupeKey`),
    INDEX `ZoomWebhookEvent_processedAt_receivedAt_idx`(`processedAt`, `receivedAt`),
    INDEX `ZoomWebhookEvent_event_receivedAt_idx`(`event`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LmsSession` ADD CONSTRAINT `LmsSession_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `SirahCohort`(`batchCode`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LmsSession` ADD CONSTRAINT `LmsSession_zoomHostId_fkey` FOREIGN KEY (`zoomHostId`) REFERENCES `ZoomHost`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

