-- MANUAL ROLLBACK for 2_acquisition_intelligence. Never run automatically.
-- Generated with: prisma migrate diff --from-schema-datamodel <schema after 2> --to-schema-datamodel <schema after 1> --script
-- Touches only Acquisition* tables. Requires explicit approval before use on any shared database.
-- If AcquisitionSuppression holds hash-only rows (value IS NULL), delete or back them up first:
--   the MODIFY back to NOT NULL fails otherwise. Then:
--   DELETE FROM `_prisma_migrations` WHERE migration_name = '2_acquisition_intelligence';
-- DropForeignKey
ALTER TABLE `AcquisitionCandidate` DROP FOREIGN KEY `AcquisitionCandidate_userId_fkey`;

-- DropForeignKey
ALTER TABLE `AcquisitionImportBatch` DROP FOREIGN KEY `AcquisitionImportBatch_userId_fkey`;

-- DropForeignKey
ALTER TABLE `AcquisitionIdentity` DROP FOREIGN KEY `AcquisitionIdentity_userId_fkey`;

-- DropForeignKey
ALTER TABLE `AcquisitionIdentity` DROP FOREIGN KEY `AcquisitionIdentity_acqProspectId_fkey`;

-- DropForeignKey
ALTER TABLE `AcquisitionSignal` DROP FOREIGN KEY `AcquisitionSignal_userId_fkey`;

-- DropForeignKey
ALTER TABLE `AcquisitionSignal` DROP FOREIGN KEY `AcquisitionSignal_acqProspectId_fkey`;

-- DropForeignKey
ALTER TABLE `AcquisitionScore` DROP FOREIGN KEY `AcquisitionScore_userId_fkey`;

-- DropForeignKey
ALTER TABLE `AcquisitionScore` DROP FOREIGN KEY `AcquisitionScore_acqProspectId_fkey`;

-- DropForeignKey
ALTER TABLE `AcquisitionPageCache` DROP FOREIGN KEY `AcquisitionPageCache_userId_fkey`;

-- DropIndex
DROP INDEX `AcquisitionDecisionMaker_acqProspectId_contactKey_key` ON `AcquisitionDecisionMaker`;

-- DropIndex
DROP INDEX `AcquisitionFinding_acqProspectId_findingKey_key` ON `AcquisitionFinding`;

-- DropIndex
DROP INDEX `AcquisitionRecommendation_acqProspectId_scoreId_key` ON `AcquisitionRecommendation`;

-- DropIndex
-- Hand-ordered: recreate the old unique index first so the userId foreign key keeps an index (MySQL 1553)
CREATE UNIQUE INDEX `AcquisitionSuppression_userId_kind_value_key` ON `AcquisitionSuppression`(`userId`, `kind`, `value`);
DROP INDEX `AcquisitionSuppression_userId_kind_valueHash_key` ON `AcquisitionSuppression`;

-- AlterTable
ALTER TABLE `AcquisitionProspect` DROP COLUMN `area`,
    DROP COLUMN `candidateId`,
    DROP COLUMN `crmConflict`,
    DROP COLUMN `importBatchId`,
    DROP COLUMN `lastScoredAt`,
    DROP COLUMN `orgDomain`;

-- AlterTable
ALTER TABLE `AcquisitionSource` DROP COLUMN `httpStatus`,
    DROP COLUMN `method`,
    DROP COLUMN `robotsAllowed`;

-- AlterTable
ALTER TABLE `AcquisitionDecisionMaker` DROP COLUMN `contactKey`,
    DROP COLUMN `evidenceQuote`,
    DROP COLUMN `flags`,
    DROP COLUMN `kind`,
    DROP COLUMN `lastVerifiedAt`,
    DROP COLUMN `lawfulBasis`,
    DROP COLUMN `mxValid`,
    DROP COLUMN `phone`,
    DROP COLUMN `retainUntil`,
    DROP COLUMN `sourceNote`,
    DROP COLUMN `sourceUrl`;

-- AlterTable
ALTER TABLE `AcquisitionFinding` DROP COLUMN `findingKey`,
    DROP COLUMN `signalIds`;

-- AlterTable
ALTER TABLE `AcquisitionRecommendation` DROP COLUMN `offerStatusAtTime`,
    DROP COLUMN `scoreId`;

-- AlterTable
ALTER TABLE `AcquisitionSuppression` DROP COLUMN `expiresAt`,
    DROP COLUMN `valueHash`,
    MODIFY `value` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `AcquisitionCandidate`;

-- DropTable
DROP TABLE `AcquisitionImportBatch`;

-- DropTable
DROP TABLE `AcquisitionIdentity`;

-- DropTable
DROP TABLE `AcquisitionSignal`;

-- DropTable
DROP TABLE `AcquisitionScore`;

-- DropTable
DROP TABLE `AcquisitionPageCache`;

-- DropTable
DROP TABLE `AcquisitionProviderUsage`;

-- CreateIndex

