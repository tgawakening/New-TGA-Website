-- Additive only: two new tables (Recording, RecordingAsset) and one foreign
-- key on each new table (Recording -> LmsSession, RecordingAsset ->
-- Recording, both ON DELETE CASCADE). No existing table, column, row or
-- index is altered or dropped, and no data is written.

-- CreateTable
CREATE TABLE `Recording` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `zoomMeetingUuid` VARCHAR(128) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'COPYING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `visibility` ENUM('HIDDEN', 'PUBLISHED') NOT NULL DEFAULT 'HIDDEN',
    `publishedAt` DATETIME(3) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Recording_zoomMeetingUuid_key`(`zoomMeetingUuid`),
    INDEX `Recording_sessionId_idx`(`sessionId`),
    INDEX `Recording_status_visibility_idx`(`status`, `visibility`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecordingAsset` (
    `id` VARCHAR(191) NOT NULL,
    `recordingId` VARCHAR(191) NOT NULL,
    `kind` ENUM('VIDEO', 'AUDIO', 'TRANSCRIPT', 'CHAT') NOT NULL,
    `zoomFileId` VARCHAR(191) NOT NULL,
    `sizeBytes` BIGINT NOT NULL DEFAULT 0,
    `storageKey` VARCHAR(512) NULL,
    `status` ENUM('PENDING', 'COPYING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RecordingAsset_zoomFileId_key`(`zoomFileId`),
    INDEX `RecordingAsset_recordingId_idx`(`recordingId`),
    INDEX `RecordingAsset_status_updatedAt_idx`(`status`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Recording` ADD CONSTRAINT `Recording_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `LmsSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecordingAsset` ADD CONSTRAINT `RecordingAsset_recordingId_fkey` FOREIGN KEY (`recordingId`) REFERENCES `Recording`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

