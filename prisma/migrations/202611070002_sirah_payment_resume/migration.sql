CREATE TABLE `SirahResumeLink` (
  `id` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SirahResumeLink_tokenHash_key` (`tokenHash`),
  INDEX `SirahResumeLink_orderId_createdAt_idx` (`orderId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SirahResumeLink_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `SirahOrder` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
