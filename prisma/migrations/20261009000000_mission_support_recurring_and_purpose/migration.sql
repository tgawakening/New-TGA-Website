ALTER TABLE `MissionSupportDonation`
  ADD COLUMN `frequency` VARCHAR(191) NOT NULL DEFAULT 'ONE_TIME',
  ADD COLUMN `purpose` VARCHAR(191) NOT NULL DEFAULT 'WHERE_NEEDED',
  ADD COLUMN `providerCustomerId` VARCHAR(191) NULL,
  ADD COLUMN `providerSubscriptionId` VARCHAR(191) NULL,
  ADD COLUMN `subscriptionStatus` VARCHAR(191) NULL,
  ADD COLUMN `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `checkoutKey` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `MissionSupportDonation_providerSubscriptionId_key` ON `MissionSupportDonation`(`providerSubscriptionId`);
CREATE UNIQUE INDEX `MissionSupportDonation_checkoutKey_key` ON `MissionSupportDonation`(`checkoutKey`);

CREATE TABLE `MissionSupportPayment` (
  `id` VARCHAR(191) NOT NULL,
  `donationId` VARCHAR(191) NOT NULL,
  `providerReference` VARCHAR(191) NOT NULL,
  `providerPaymentId` VARCHAR(191) NULL,
  `providerInvoiceId` VARCHAR(191) NULL,
  `amount` INTEGER NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'GBP',
  `status` VARCHAR(191) NOT NULL,
  `refundedAmount` INTEGER NOT NULL DEFAULT 0,
  `paidAt` DATETIME(3) NULL,
  `receiptUrl` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MissionSupportPayment_providerReference_key`(`providerReference`),
  INDEX `MissionSupportPayment_donationId_createdAt_idx`(`donationId`, `createdAt`),
  INDEX `MissionSupportPayment_providerPaymentId_idx`(`providerPaymentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `MissionSupportPayment` ADD CONSTRAINT `MissionSupportPayment_donationId_fkey` FOREIGN KEY (`donationId`) REFERENCES `MissionSupportDonation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE `MissionSupportWebhookEvent` (
  `id` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
