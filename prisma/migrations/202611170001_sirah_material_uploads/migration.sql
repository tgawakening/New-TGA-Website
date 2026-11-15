-- AlterTable
ALTER TABLE `SirahMaterial` ADD COLUMN `contentType` VARCHAR(191) NULL,
    ADD COLUMN `objectKey` VARCHAR(191) NULL,
    ADD COLUMN `originalFilename` VARCHAR(255) NULL,
    ADD COLUMN `sizeBytes` BIGINT NULL,
    ADD COLUMN `storage` ENUM('LINK', 'UPLOAD') NOT NULL DEFAULT 'LINK';

-- CreateIndex
CREATE UNIQUE INDEX `SirahMaterial_objectKey_key` ON `SirahMaterial`(`objectKey`);

