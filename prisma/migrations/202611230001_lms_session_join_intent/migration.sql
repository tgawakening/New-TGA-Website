-- Additive only: one new table (SessionJoinIntent) and one foreign key from
-- that new table to LmsSession. No existing table, column, row or index is
-- altered or dropped. userId deliberately has no foreign key to User.

-- CreateTable
CREATE TABLE `SessionJoinIntent` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SessionJoinIntent_sessionId_at_idx`(`sessionId`, `at`),
    INDEX `SessionJoinIntent_userId_at_idx`(`userId`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SessionJoinIntent` ADD CONSTRAINT `SessionJoinIntent_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `LmsSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
