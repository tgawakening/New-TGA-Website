-- Additive only: Sīrah classroom (sessions, materials, announcements).
-- No existing table, column or index is changed.
-- CreateTable
CREATE TABLE `SirahLesson` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `weekNumber` INTEGER NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `zoomJoinUrl` VARCHAR(1024) NULL,
    `zoomMeetingId` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SirahLesson_scheduledAt_idx`(`scheduledAt`),
    INDEX `SirahLesson_weekNumber_idx`(`weekNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SirahMaterial` (
    `id` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `kind` ENUM('SLIDES', 'PDF', 'READING', 'LINK', 'RECORDING') NOT NULL,
    `url` VARCHAR(1024) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SirahMaterial_lessonId_order_idx`(`lessonId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SirahAnnouncement` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SirahAnnouncement_pinned_publishedAt_idx`(`pinned`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SirahMaterial` ADD CONSTRAINT `SirahMaterial_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `SirahLesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

