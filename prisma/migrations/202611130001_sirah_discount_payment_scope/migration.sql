-- Additive only: which checkout a discount code may price.
-- Every existing row becomes MANUAL (Pakistan bank transfer / JazzCash), so
-- current codes behave exactly as before. No other column, row or index changes.
ALTER TABLE `SirahManualDiscount` ADD COLUMN `paymentScope` VARCHAR(16) NOT NULL DEFAULT 'MANUAL';
