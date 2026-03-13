-- AlterTable
ALTER TABLE `Registration`
  ADD COLUMN `paymentReference` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `Registration_paymentReference_key`(`paymentReference`);

-- AlterTable
ALTER TABLE `Payment`
  ADD COLUMN `manualNotes` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ManualPaymentSubmission` (
  `id` VARCHAR(191) NOT NULL,
  `paymentId` VARCHAR(191) NOT NULL,
  `method` ENUM('STRIPE', 'PAYPAL', 'BANK_TRANSFER', 'EASYPAISA', 'JAZZCASH', 'NAYAPAY') NOT NULL,
  `senderName` VARCHAR(191) NOT NULL,
  `senderNumber` VARCHAR(191) NOT NULL,
  `referenceKey` VARCHAR(191) NOT NULL,
  `screenshotUrl` VARCHAR(191) NULL,
  `notes` VARCHAR(191) NULL,
  `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedByAdminId` VARCHAR(191) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `reviewNote` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ManualPaymentSubmission_paymentId_key`(`paymentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `registrationId` VARCHAR(191) NOT NULL,
  `provider` ENUM('STRIPE', 'PAYPAL') NOT NULL,
  `status` ENUM('INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED') NOT NULL DEFAULT 'INCOMPLETE',
  `providerSubscriptionId` VARCHAR(191) NULL,
  `providerCustomerId` VARCHAR(191) NULL,
  `currentPeriodStart` DATETIME(3) NULL,
  `currentPeriodEnd` DATETIME(3) NULL,
  `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
  `canceledAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `Subscription_registrationId_key`(`registrationId`),
  UNIQUE INDEX `Subscription_providerSubscriptionId_key`(`providerSubscriptionId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailLog` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `toEmail` VARCHAR(191) NOT NULL,
  `emailType` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `providerId` VARCHAR(191) NULL,
  `error` VARCHAR(191) NULL,
  `payload` JSON NULL,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `EmailLog_userId_emailType_idx`(`userId`, `emailType`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ManualPaymentSubmission`
  ADD CONSTRAINT `ManualPaymentSubmission_paymentId_fkey`
  FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription`
  ADD CONSTRAINT `Subscription_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription`
  ADD CONSTRAINT `Subscription_registrationId_fkey`
  FOREIGN KEY (`registrationId`) REFERENCES `Registration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailLog`
  ADD CONSTRAINT `EmailLog_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
