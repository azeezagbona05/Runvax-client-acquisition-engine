-- MANUAL ROLLBACK for 3_sales_workflow. Never run automatically.
-- Generated with prisma migrate diff (schema after 3 -> schema after 2). Touches only Acquisition* tables.
-- Drops AcquisitionOutcome (recorded sales outcomes) — export it first if it holds data.
--   DELETE FROM `_prisma_migrations` WHERE migration_name = '3_sales_workflow';
-- DropForeignKey
ALTER TABLE `AcquisitionOutcome` DROP FOREIGN KEY `AcquisitionOutcome_userId_fkey`;

-- DropForeignKey
ALTER TABLE `AcquisitionOutcome` DROP FOREIGN KEY `AcquisitionOutcome_acqProspectId_fkey`;

-- AlterTable
ALTER TABLE `AcquisitionDraft` DROP COLUMN `evidenceHash`,
    DROP COLUMN `evidenceSignalIds`,
    DROP COLUMN `industryConfigVersion`,
    DROP COLUMN `offerConfigVersion`,
    DROP COLUMN `offerHash`,
    DROP COLUMN `readiness`,
    DROP COLUMN `statusReason`;

-- AlterTable
ALTER TABLE `AcquisitionApproval` DROP COLUMN `evidenceHash`,
    DROP COLUMN `offerHash`;

-- DropTable
DROP TABLE `AcquisitionOutcome`;

