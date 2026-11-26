ALTER TABLE `SirahLedgerPayment` ADD COLUMN `periodId` VARCHAR(191) NULL;

CREATE TABLE `SirahPaymentPlan` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `billingDay` INTEGER NOT NULL,
    `firstDueAt` DATETIME(3) NOT NULL,
    `monthlyMinor` INTEGER NOT NULL,
    `arrearsPartMinor` INTEGER NOT NULL,
    `changeAt` DATETIME(3) NULL,
    `nextMonthlyMinor` INTEGER NULL,
    `nextArrearsMinor` INTEGER NULL,
    `openingArrearsMinor` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `SirahPaymentPlan_orderId_key`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SirahPaymentPeriod` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `periodMonth` VARCHAR(7) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `amountMinor` INTEGER NOT NULL,
    `arrearsPartMinor` INTEGER NOT NULL,
    UNIQUE INDEX `SirahPaymentPeriod_planId_periodMonth_key`(`planId`, `periodMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `SirahLedgerPayment_periodId_idx` ON `SirahLedgerPayment`(`periodId`);
ALTER TABLE `SirahLedgerPayment` ADD CONSTRAINT `SirahLedgerPayment_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `SirahPaymentPeriod`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SirahPaymentPlan` ADD CONSTRAINT `SirahPaymentPlan_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `SirahOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SirahPaymentPeriod` ADD CONSTRAINT `SirahPaymentPeriod_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `SirahPaymentPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
