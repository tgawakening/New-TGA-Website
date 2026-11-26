ALTER TABLE `SirahReceipt` ADD COLUMN `storageKey` VARCHAR(191) NULL;
ALTER TABLE `SirahAgreement` ADD COLUMN `storageKey` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `SirahReceipt_storageKey_key` ON `SirahReceipt`(`storageKey`);
CREATE UNIQUE INDEX `SirahAgreement_storageKey_key` ON `SirahAgreement`(`storageKey`);
CREATE TABLE `LmsTaskAttachment` (
  `id` VARCHAR(191) NOT NULL,
  `submissionId` VARCHAR(191) NOT NULL,
  `storageKey` VARCHAR(191) NOT NULL,
  `filename` VARCHAR(191) NOT NULL,
  `contentType` VARCHAR(191) NOT NULL,
  `sizeBytes` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `LmsTaskAttachment_storageKey_key`(`storageKey`),
  INDEX `LmsTaskAttachment_submissionId_idx`(`submissionId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `LmsTaskAttachment_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `LmsTaskSubmission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
