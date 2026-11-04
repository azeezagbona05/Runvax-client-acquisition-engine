-- MANUAL ROLLBACK for 5_outreach_campaigns. Never run automatically. Drops every email campaign and lead (the sent / opened / replied history).
-- Afterwards: DELETE FROM `_prisma_migrations` WHERE migration_name = '5_outreach_campaigns';
-- DropForeignKey
ALTER TABLE `OutreachLead` DROP FOREIGN KEY `OutreachLead_campaignId_fkey`;

-- DropForeignKey
ALTER TABLE `OutreachCampaign` DROP FOREIGN KEY `OutreachCampaign_userId_fkey`;

-- DropTable
DROP TABLE `OutreachLead`;

-- DropTable
DROP TABLE `OutreachCampaign`;
