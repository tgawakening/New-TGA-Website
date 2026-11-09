-- Nullable, additive fields preserve every historical fee-waiver application.
ALTER TABLE `FreeWarriorApplication`
    ADD COLUMN `scholarshipBatch` VARCHAR(191) NULL,
    ADD COLUMN `scholarshipDetails` JSON NULL;
CREATE INDEX `FreeWarriorApplication_scholarshipBatch_status_idx`
    ON `FreeWarriorApplication`(`scholarshipBatch`, `status`);
