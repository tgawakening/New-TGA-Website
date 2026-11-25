-- CreateTable
CREATE TABLE `LmsTask` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `recordingId` VARCHAR(191) NULL,
    `externalRecordingId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LmsTask_sessionId_publishedAt_idx`(`sessionId`, `publishedAt`),
    INDEX `LmsTask_recordingId_publishedAt_idx`(`recordingId`, `publishedAt`),
    INDEX `LmsTask_externalRecordingId_publishedAt_idx`(`externalRecordingId`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LmsTaskSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `answer` LONGTEXT NOT NULL,
    `link` VARCHAR(1024) NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LmsTaskSubmission_studentId_idx`(`studentId`),
    UNIQUE INDEX `LmsTaskSubmission_taskId_studentId_key`(`taskId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LmsTask` ADD CONSTRAINT `LmsTask_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `LmsSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LmsTask` ADD CONSTRAINT `LmsTask_recordingId_fkey` FOREIGN KEY (`recordingId`) REFERENCES `Recording`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LmsTask` ADD CONSTRAINT `LmsTask_externalRecordingId_fkey` FOREIGN KEY (`externalRecordingId`) REFERENCES `LmsResource`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LmsTaskSubmission` ADD CONSTRAINT `LmsTaskSubmission_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `LmsTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LmsTaskSubmission` ADD CONSTRAINT `LmsTaskSubmission_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
