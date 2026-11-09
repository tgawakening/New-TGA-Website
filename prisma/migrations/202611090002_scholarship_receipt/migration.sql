-- Add private evidence storage; preserve existing scholarship and payment records.
CREATE TABLE `FreeWarriorReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `applicationId` VARCHAR(191) NOT NULL,
  `method` VARCHAR(191) NOT NULL,
  `filename` VARCHAR(191) NOT NULL,
  `mime` VARCHAR(191) NOT NULL,
  `sha256` VARCHAR(191) NOT NULL,
  `data` LONGBLOB NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `FreeWarriorReceipt_applicationId_key` (`applicationId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `FreeWarriorReceipt_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `FreeWarriorApplication` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
