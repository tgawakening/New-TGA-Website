-- CreateTable
CREATE TABLE `FreeWarriorApplication` (
  `id` VARCHAR(191) NOT NULL,
  `fullName` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `whatsapp` VARCHAR(191) NOT NULL,
  `age` INTEGER NULL,
  `cityCountry` VARCHAR(191) NOT NULL,
  `occupation` VARCHAR(191) NOT NULL,
  `knowledgeLevel` VARCHAR(191) NOT NULL,
  `previousSeerahStudy` VARCHAR(191) NULL,
  `currentInvolvement` VARCHAR(191) NULL,
  `whatDrawsYou` TEXT NOT NULL,
  `howItBenefits` TEXT NOT NULL,
  `mostInterestingTopic` VARCHAR(191) NOT NULL,
  `whyThisTopic` TEXT NOT NULL,
  `canAttendRegularly` VARCHAR(191) NOT NULL,
  `attendedOrientation` BOOLEAN NOT NULL,
  `reasonForWaiver` TEXT NOT NULL,
  `howHeard` VARCHAR(191) NULL,
  `adabCommitment` BOOLEAN NOT NULL,
  `genuineFinancialNeed` BOOLEAN NOT NULL,
  `courseSlug` VARCHAR(191) NOT NULL,
  `courseTitle` VARCHAR(191) NOT NULL,
  `listedPrice` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `reviewNote` VARCHAR(191) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `approvedUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `FreeWarriorApplication_email_status_idx`(`email`, `status`),
  INDEX `FreeWarriorApplication_approvedUserId_idx`(`approvedUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FreeWarriorApplication`
  ADD CONSTRAINT `FreeWarriorApplication_approvedUserId_fkey`
  FOREIGN KEY (`approvedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
