CREATE TABLE `MissionSupportDonation` (
  `id` VARCHAR(191) NOT NULL,
  `fullName` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phoneCountryCode` VARCHAR(191) NULL,
  `phoneNumber` VARCHAR(191) NULL,
  `countryName` VARCHAR(191) NULL,
  `amount` INTEGER NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'GBP',
  `paymentMethod` ENUM('STRIPE', 'PAYPAL', 'BANK_TRANSFER', 'EASYPAISA', 'JAZZCASH', 'NAYAPAY') NOT NULL,
  `paymentReference` VARCHAR(191) NULL,
  `status` ENUM('INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'UNDER_REVIEW', 'CONFIRMED') NOT NULL DEFAULT 'INITIATED',
  `donorMessage` TEXT NULL,
  `providerOrderId` VARCHAR(191) NULL,
  `providerPaymentId` VARCHAR(191) NULL,
  `manualNotes` TEXT NULL,
  `paidAt` DATETIME(3) NULL,
  `rawPayloadJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `MissionSupportDonation_paymentReference_key`(`paymentReference`),
  INDEX `MissionSupportDonation_email_createdAt_idx`(`email`, `createdAt`),
  INDEX `MissionSupportDonation_status_paymentMethod_idx`(`status`, `paymentMethod`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MissionSupportManualSubmission` (
  `id` VARCHAR(191) NOT NULL,
  `donationId` VARCHAR(191) NOT NULL,
  `method` ENUM('STRIPE', 'PAYPAL', 'BANK_TRANSFER', 'EASYPAISA', 'JAZZCASH', 'NAYAPAY') NOT NULL,
  `senderName` VARCHAR(191) NOT NULL,
  `senderNumber` VARCHAR(191) NOT NULL,
  `referenceKey` VARCHAR(191) NOT NULL,
  `screenshotUrl` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedAt` DATETIME(3) NULL,
  `reviewNote` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `MissionSupportManualSubmission_donationId_key`(`donationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MissionSupportManualSubmission`
  ADD CONSTRAINT `MissionSupportManualSubmission_donationId_fkey`
  FOREIGN KEY (`donationId`) REFERENCES `MissionSupportDonation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
