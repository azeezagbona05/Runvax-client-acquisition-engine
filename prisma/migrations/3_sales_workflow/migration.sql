-- AlterTable
ALTER TABLE `AcquisitionDraft` ADD COLUMN `evidenceHash` VARCHAR(191) NULL,
    ADD COLUMN `evidenceSignalIds` JSON NULL,
    ADD COLUMN `industryConfigVersion` INTEGER NULL,
    ADD COLUMN `offerConfigVersion` INTEGER NULL,
    ADD COLUMN `offerHash` VARCHAR(191) NULL,
    ADD COLUMN `readiness` JSON NULL,
    ADD COLUMN `statusReason` TEXT NULL;

-- AlterTable
ALTER TABLE `AcquisitionApproval` ADD COLUMN `evidenceHash` VARCHAR(191) NULL,
    ADD COLUMN `offerHash` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `AcquisitionOutcome` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `acqProspectId` VARCHAR(191) NOT NULL,
    `draftId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `sentiment` VARCHAR(191) NULL,
    `amount` INTEGER NULL,
    `currency` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `actorEmail` VARCHAR(191) NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcquisitionOutcome_acqProspectId_occurredAt_idx`(`acqProspectId`, `occurredAt`),
    INDEX `AcquisitionOutcome_userId_type_idx`(`userId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AcquisitionOutcome` ADD CONSTRAINT `AcquisitionOutcome_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionOutcome` ADD CONSTRAINT `AcquisitionOutcome_acqProspectId_fkey` FOREIGN KEY (`acqProspectId`) REFERENCES `AcquisitionProspect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

