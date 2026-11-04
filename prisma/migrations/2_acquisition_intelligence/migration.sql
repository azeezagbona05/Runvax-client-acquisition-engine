-- AlterTable
ALTER TABLE `AcquisitionProspect` ADD COLUMN `area` VARCHAR(191) NULL,
    ADD COLUMN `candidateId` VARCHAR(191) NULL,
    ADD COLUMN `crmConflict` VARCHAR(191) NULL,
    ADD COLUMN `importBatchId` VARCHAR(191) NULL,
    ADD COLUMN `lastScoredAt` DATETIME(3) NULL,
    ADD COLUMN `orgDomain` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `AcquisitionSource` ADD COLUMN `httpStatus` INTEGER NULL,
    ADD COLUMN `method` VARCHAR(191) NULL,
    ADD COLUMN `robotsAllowed` BOOLEAN NULL;

-- AlterTable
ALTER TABLE `AcquisitionDecisionMaker` ADD COLUMN `contactKey` VARCHAR(191) NULL,
    ADD COLUMN `evidenceQuote` TEXT NULL,
    ADD COLUMN `flags` JSON NULL,
    ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'role_inbox',
    ADD COLUMN `lastVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `lawfulBasis` VARCHAR(191) NOT NULL DEFAULT 'legitimate_interest_b2b',
    ADD COLUMN `mxValid` BOOLEAN NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `retainUntil` DATETIME(3) NULL,
    ADD COLUMN `sourceNote` TEXT NULL,
    ADD COLUMN `sourceUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `AcquisitionFinding` ADD COLUMN `findingKey` VARCHAR(191) NULL,
    ADD COLUMN `signalIds` JSON NULL;

-- AlterTable
ALTER TABLE `AcquisitionRecommendation` ADD COLUMN `offerStatusAtTime` VARCHAR(191) NULL,
    ADD COLUMN `scoreId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `AcquisitionSuppression` ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `valueHash` VARCHAR(191) NOT NULL,
    MODIFY `value` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `AcquisitionCandidate` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `industryKey` VARCHAR(191) NOT NULL,
    `placeId` VARCHAR(191) NOT NULL,
    `area` VARCHAR(191) NULL,
    `queryIndex` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending_research',
    `acqProspectId` VARCHAR(191) NULL,
    `discoveredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AcquisitionCandidate_userId_status_idx`(`userId`, `status`),
    UNIQUE INDEX `AcquisitionCandidate_userId_placeId_key`(`userId`, `placeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionImportBatch` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `industryKey` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `fileHash` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'previewed',
    `rowCount` INTEGER NOT NULL DEFAULT 0,
    `acceptedCount` INTEGER NOT NULL DEFAULT 0,
    `duplicateCount` INTEGER NOT NULL DEFAULT 0,
    `rejectedCount` INTEGER NOT NULL DEFAULT 0,
    `rows` JSON NULL,
    `results` JSON NULL,
    `attestedBy` VARCHAR(191) NULL,
    `attestedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcquisitionImportBatch_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `AcquisitionImportBatch_userId_fileHash_key`(`userId`, `fileHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionIdentity` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `acqProspectId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcquisitionIdentity_acqProspectId_idx`(`acqProspectId`),
    UNIQUE INDEX `AcquisitionIdentity_userId_kind_value_key`(`userId`, `kind`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionSignal` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `acqProspectId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `value` JSON NULL,
    `basis` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `confidence` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `sourceUrl` TEXT NULL,
    `evidenceQuote` TEXT NULL,
    `contentHash` VARCHAR(191) NOT NULL,
    `observedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastVerifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `supersededAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcquisitionSignal_acqProspectId_code_idx`(`acqProspectId`, `code`),
    INDEX `AcquisitionSignal_userId_idx`(`userId`),
    UNIQUE INDEX `AcquisitionSignal_acqProspectId_code_contentHash_key`(`acqProspectId`, `code`, `contentHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionScore` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `acqProspectId` VARCHAR(191) NOT NULL,
    `industryKey` VARCHAR(191) NOT NULL,
    `configVersion` INTEGER NOT NULL,
    `scoreVersion` VARCHAR(191) NOT NULL,
    `total` INTEGER NOT NULL,
    `band` VARCHAR(191) NOT NULL,
    `coverage` DOUBLE NOT NULL,
    `contactability` VARCHAR(191) NOT NULL,
    `eligible` BOOLEAN NOT NULL,
    `eligibility` JSON NOT NULL,
    `breakdown` JSON NOT NULL,
    `inputHash` VARCHAR(191) NOT NULL,
    `computedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcquisitionScore_acqProspectId_computedAt_idx`(`acqProspectId`, `computedAt`),
    INDEX `AcquisitionScore_userId_idx`(`userId`),
    UNIQUE INDEX `AcquisitionScore_acqProspectId_inputHash_key`(`acqProspectId`, `inputHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionPageCache` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `urlHash` VARCHAR(191) NOT NULL,
    `finalUrl` TEXT NULL,
    `status` VARCHAR(191) NOT NULL,
    `httpStatus` INTEGER NULL,
    `html` MEDIUMTEXT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `AcquisitionPageCache_expiresAt_idx`(`expiresAt`),
    INDEX `AcquisitionPageCache_userId_domain_idx`(`userId`, `domain`),
    UNIQUE INDEX `AcquisitionPageCache_userId_urlHash_key`(`userId`, `urlHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionProviderUsage` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `day` VARCHAR(191) NOT NULL,
    `calls` INTEGER NOT NULL DEFAULT 0,
    `consecutiveFailures` INTEGER NOT NULL DEFAULT 0,
    `lastFailureAt` DATETIME(3) NULL,
    `pausedUntil` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AcquisitionProviderUsage_provider_day_key`(`provider`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `AcquisitionDecisionMaker_acqProspectId_contactKey_key` ON `AcquisitionDecisionMaker`(`acqProspectId`, `contactKey`);

-- CreateIndex
CREATE UNIQUE INDEX `AcquisitionFinding_acqProspectId_findingKey_key` ON `AcquisitionFinding`(`acqProspectId`, `findingKey`);

-- CreateIndex
CREATE UNIQUE INDEX `AcquisitionRecommendation_acqProspectId_scoreId_key` ON `AcquisitionRecommendation`(`acqProspectId`, `scoreId`);

-- CreateIndex
CREATE UNIQUE INDEX `AcquisitionSuppression_userId_kind_valueHash_key` ON `AcquisitionSuppression`(`userId`, `kind`, `valueHash`);

-- DropIndex (hand-ordered: only after the new (userId, …) unique index exists,
-- otherwise MySQL refuses — error 1553, the userId foreign key needs an index)
DROP INDEX `AcquisitionSuppression_userId_kind_value_key` ON `AcquisitionSuppression`;

-- AddForeignKey
ALTER TABLE `AcquisitionCandidate` ADD CONSTRAINT `AcquisitionCandidate_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionImportBatch` ADD CONSTRAINT `AcquisitionImportBatch_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionIdentity` ADD CONSTRAINT `AcquisitionIdentity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionIdentity` ADD CONSTRAINT `AcquisitionIdentity_acqProspectId_fkey` FOREIGN KEY (`acqProspectId`) REFERENCES `AcquisitionProspect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionSignal` ADD CONSTRAINT `AcquisitionSignal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionSignal` ADD CONSTRAINT `AcquisitionSignal_acqProspectId_fkey` FOREIGN KEY (`acqProspectId`) REFERENCES `AcquisitionProspect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionScore` ADD CONSTRAINT `AcquisitionScore_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionScore` ADD CONSTRAINT `AcquisitionScore_acqProspectId_fkey` FOREIGN KEY (`acqProspectId`) REFERENCES `AcquisitionProspect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionPageCache` ADD CONSTRAINT `AcquisitionPageCache_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

