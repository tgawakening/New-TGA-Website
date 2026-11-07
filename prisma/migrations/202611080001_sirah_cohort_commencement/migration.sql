-- Additive cohort setting only. No student, payment or historical pricing rows change.
CREATE TABLE `SirahCohort` (
    `batchCode` VARCHAR(191) NOT NULL,
    `commencementAt` DATETIME(3) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `confirmedBy` VARCHAR(191) NULL,
    `sourceReference` VARCHAR(191) NULL,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `history` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`batchCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Owner message 8 November 2026: first paid class is 14 November, not orientation.
-- Midnight is a calendar-date anchor, not a claim about the teaching session time.
INSERT INTO `SirahCohort` (`batchCode`, `commencementAt`, `confirmedAt`, `confirmedBy`, `sourceReference`, `revision`, `history`, `updatedAt`)
VALUES ('beyond-chronology-2026', '2026-11-14 00:00:00.000', CURRENT_TIMESTAMP(3), 'owner:conversation',
        'Owner confirmed first paid class: 14 November 2026', 1,
        JSON_ARRAY(JSON_OBJECT('actor', 'owner:conversation', 'commencementDate', '2026-11-14', 'sourceReference', 'Owner message 8 November 2026; free orientation was 7 November')),
        CURRENT_TIMESTAMP(3));
