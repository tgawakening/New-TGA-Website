ALTER TABLE `SirahOrder` ADD COLUMN `ledgerFeeMinor` INTEGER NULL,
  ADD COLUMN `ledgerFeeCurrency` VARCHAR(3) NULL;

CREATE TABLE `SirahLedgerPayment` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `amountMinor` INTEGER NOT NULL,
  `currency` VARCHAR(3) NOT NULL,
  `method` VARCHAR(16) NOT NULL,
  `receivedAt` DATETIME(3) NOT NULL,
  `note` TEXT NULL,
  `createdBy` VARCHAR(320) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `SirahLedgerPayment_orderId_receivedAt_idx` (`orderId`, `receivedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SirahLedgerPayment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `SirahOrder` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SirahAgreement` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `filename` VARCHAR(191) NOT NULL,
  `mime` VARCHAR(191) NOT NULL,
  `data` LONGBLOB NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SirahAgreement_orderId_key` (`orderId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SirahAgreement_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `SirahOrder` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SirahSettlement` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `amountMinor` INTEGER NOT NULL,
  `currency` VARCHAR(3) NOT NULL,
  `status` VARCHAR(16) NOT NULL,
  `stripeSessionId` VARCHAR(191) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdBy` VARCHAR(320) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SirahSettlement_stripeSessionId_key` (`stripeSessionId`),
  INDEX `SirahSettlement_orderId_status_idx` (`orderId`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SirahSettlement_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `SirahOrder` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
