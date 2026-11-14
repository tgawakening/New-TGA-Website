-- Additive only: per-student completion marks on Sīrah classroom sessions.
-- No existing table, column or index is changed.
-- CreateTable
CREATE TABLE `SirahLessonProgress` (
    `id` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SirahLessonProgress_studentId_idx`(`studentId`),
    UNIQUE INDEX `SirahLessonProgress_lessonId_studentId_key`(`lessonId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SirahLessonProgress` ADD CONSTRAINT `SirahLessonProgress_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `SirahLesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SirahLessonProgress` ADD CONSTRAINT `SirahLessonProgress_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

