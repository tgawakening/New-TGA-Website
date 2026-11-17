-- Additive only: the cohort's monthly billing and grace days, and the cycle an
-- order follows. No existing column, row or index is changed or dropped.
-- Existing orders get NULL cycle fields, i.e. they stay on their current
-- (anniversary) schedule until scripts/sirah-move-to-cohort-cycle.ts is run
-- with --apply after review.
ALTER TABLE `SirahCohort` ADD COLUMN `billingDay` INTEGER NOT NULL DEFAULT 7,
    ADD COLUMN `graceDay` INTEGER NOT NULL DEFAULT 15;

ALTER TABLE `SirahOrder` ADD COLUMN `cycleBillingDay` INTEGER NULL,
    ADD COLUMN `cycleGraceDay` INTEGER NULL,
    ADD COLUMN `cycleFirstDueAt` DATETIME(3) NULL;
