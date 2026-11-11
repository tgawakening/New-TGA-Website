-- Additive only: add redemption tracking to SirahManualDiscount. No existing
-- column is altered or dropped. The two NOT NULL columns have defaults so every
-- existing row is backfilled automatically (maxRedemptions=1 single-use,
-- redeemedCount=0). The two redeemed* columns are nullable. Safe on live MySQL.
ALTER TABLE `SirahManualDiscount`
  ADD COLUMN `maxRedemptions` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `redeemedCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `redeemedEmail` VARCHAR(191) NULL,
  ADD COLUMN `redeemedOrderId` VARCHAR(191) NULL;
