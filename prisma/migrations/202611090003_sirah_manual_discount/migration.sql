-- Personal offers are isolated from historical coupons and accepted payment records.
CREATE TABLE `SirahManualDiscount` (
  `id` VARCHAR(191) NOT NULL,
  `codeHash` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `batchCode` VARCHAR(191) NOT NULL,
  `countryCode` VARCHAR(191) NOT NULL,
  `plan` VARCHAR(191) NOT NULL,
  `currency` VARCHAR(191) NOT NULL,
  `amountMinor` INTEGER NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `SirahManualDiscount_codeHash_key` (`codeHash`),
  INDEX `SirahManualDiscount_email_batchCode_isActive_idx` (`email`, `batchCode`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `SirahOrder` ADD COLUMN `discount` JSON NULL;
