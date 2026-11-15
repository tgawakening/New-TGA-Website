-- AlterTable
ALTER TABLE `SirahAnnouncement` ADD COLUMN `emailStudents` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `SirahClassroomEmail` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(32) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NULL,
    `announcementId` VARCHAR(191) NULL,
    `toEmail` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `state` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `providerId` VARCHAR(191) NULL,
    `error` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,

    UNIQUE INDEX `SirahClassroomEmail_key_key`(`key`),
    INDEX `SirahClassroomEmail_state_lockedUntil_idx`(`state`, `lockedUntil`),
    INDEX `SirahClassroomEmail_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SirahClassroomEmail` ADD CONSTRAINT `SirahClassroomEmail_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

