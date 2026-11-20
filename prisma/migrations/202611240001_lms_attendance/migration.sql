-- Additive only: two new nullable columns on LmsSession (zoomStartedAt,
-- zoomEndedAt; existing rows get NULL), two new tables (AttendanceInterval,
-- Attendance) and one foreign key from each new table to LmsSession. No
-- existing column, row or index is altered or dropped. userId on the new
-- tables deliberately has no foreign key to User.

-- AlterTable
ALTER TABLE `LmsSession` ADD COLUMN `zoomEndedAt` DATETIME(3) NULL,
    ADD COLUMN `zoomStartedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `AttendanceInterval` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `zoomParticipantId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(320) NULL,
    `name` VARCHAR(191) NULL,
    `joinedAt` DATETIME(3) NOT NULL,
    `leftAt` DATETIME(3) NULL,
    `matchMethod` ENUM('EMAIL', 'NAME', 'NONE') NOT NULL DEFAULT 'NONE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AttendanceInterval_sessionId_userId_idx`(`sessionId`, `userId`),
    INDEX `AttendanceInterval_sessionId_leftAt_idx`(`sessionId`, `leftAt`),
    UNIQUE INDEX `AttendanceInterval_sessionId_zoomParticipantId_joinedAt_key`(`sessionId`, `zoomParticipantId`, `joinedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attendance` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` ENUM('JOINED', 'PRESENT', 'PARTIAL') NOT NULL DEFAULT 'JOINED',
    `joinedMinutes` INTEGER NOT NULL DEFAULT 0,
    `firstJoinedAt` DATETIME(3) NOT NULL,
    `lastLeftAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Attendance_userId_idx`(`userId`),
    UNIQUE INDEX `Attendance_sessionId_userId_key`(`sessionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AttendanceInterval` ADD CONSTRAINT `AttendanceInterval_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `LmsSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `LmsSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

