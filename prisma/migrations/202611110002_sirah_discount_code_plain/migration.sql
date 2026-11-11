-- Additive only: add the shareable plaintext code to SirahManualDiscount. No
-- existing column is altered or dropped. The column is nullable, so every
-- existing row keeps codePlain = NULL (rendered as "hidden" in the admin list)
-- until backfilled. Validation stays hash-based on codeHash and is unchanged.
-- Safe on live MySQL.
ALTER TABLE `SirahManualDiscount`
  ADD COLUMN `codePlain` VARCHAR(191) NULL;
