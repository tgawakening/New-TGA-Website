-- CreateTable
CREATE TABLE `SirahOrder` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `batchCode` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `requestKey` VARCHAR(191) NOT NULL,
    `registrationId` VARCHAR(191) NULL,
    `phoneCountry` VARCHAR(191) NOT NULL,
    `phoneE164` VARCHAR(191) NOT NULL,
    `countryCode` VARCHAR(191) NOT NULL,
    `countryName` VARCHAR(191) NOT NULL,
    `marketCode` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NULL,
    `pricingVersion` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `amountMinor` INTEGER NOT NULL,
    `totalMinor` INTEGER NOT NULL,
    `paymentState` VARCHAR(191) NOT NULL DEFAULT 'UNPAID',
    `enrolmentState` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `revision` INTEGER NOT NULL DEFAULT 0,
    `terms` JSON NULL,
    `providerOrderId` VARCHAR(191) NULL,
    `checkoutToken` VARCHAR(191) NULL,
    `providerPlanId` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `accessEndsAt` DATETIME(3) NULL,
    `refundedMinor` INTEGER NOT NULL DEFAULT 0,
    `providerSubscriptionId` VARCHAR(191) NULL,
    `providerCustomerId` VARCHAR(191) NULL,
    `programmeStart` DATETIME(3) NULL,
    `programmeEnd` DATETIME(3) NULL,
    `nextBillingAt` DATETIME(3) NULL,
    `paidMinor` INTEGER NOT NULL DEFAULT 0,
    `paidCount` INTEGER NOT NULL DEFAULT 0,
    `invitationState` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SirahOrder_reference_key`(`reference`),
    UNIQUE INDEX `SirahOrder_requestKey_key`(`requestKey`),
    UNIQUE INDEX `SirahOrder_registrationId_key`(`registrationId`),
    UNIQUE INDEX `SirahOrder_providerOrderId_key`(`providerOrderId`),
    UNIQUE INDEX `SirahOrder_checkoutToken_key`(`checkoutToken`),
    UNIQUE INDEX `SirahOrder_providerSubscriptionId_key`(`providerSubscriptionId`),
    INDEX `SirahOrder_paymentState_enrolmentState_createdAt_idx`(`paymentState`, `enrolmentState`, `createdAt`),
    UNIQUE INDEX `SirahOrder_userId_courseId_batchCode_key`(`userId`, `courseId`, `batchCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SirahReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `sha256` VARCHAR(191) NOT NULL,
    `data` LONGBLOB NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SirahReceipt_orderId_revision_key`(`orderId`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SirahAudit` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `actor` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `detail` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SirahAudit_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SirahPaymentEvent` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `amountMinor` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SirahPaymentEvent_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SirahNotification` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `toEmail` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `state` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `providerId` VARCHAR(191) NULL,
    `error` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SirahNotification_key_key`(`key`),
    INDEX `SirahNotification_state_lockedUntil_idx`(`state`, `lockedUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SirahOrder` ADD CONSTRAINT `SirahOrder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SirahOrder` ADD CONSTRAINT `SirahOrder_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SirahOrder` ADD CONSTRAINT `SirahOrder_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `Registration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SirahReceipt` ADD CONSTRAINT `SirahReceipt_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `SirahOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SirahAudit` ADD CONSTRAINT `SirahAudit_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `SirahOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SirahPaymentEvent` ADD CONSTRAINT `SirahPaymentEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `SirahOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SirahNotification` ADD CONSTRAINT `SirahNotification_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `SirahOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

