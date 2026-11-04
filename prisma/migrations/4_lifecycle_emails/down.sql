-- MANUAL ROLLBACK for 4_lifecycle_emails. Never run automatically. Drops the LifecycleEmail table (sent-email log and opt-outs).
-- Afterwards: DELETE FROM `_prisma_migrations` WHERE migration_name = '4_lifecycle_emails';
-- DropForeignKey
ALTER TABLE `LifecycleEmail` DROP FOREIGN KEY `LifecycleEmail_userId_fkey`;

-- DropTable
DROP TABLE `LifecycleEmail`;

