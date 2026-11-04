-- MANUAL ROLLBACK for 6_acquisition_pipeline. Never run automatically. Drops the reply and log tables and the new lead columns.
ALTER TABLE `CampaignLog` DROP FOREIGN KEY `CampaignLog_campaignId_fkey`;
ALTER TABLE `CampaignReply` DROP FOREIGN KEY `CampaignReply_leadId_fkey`;
ALTER TABLE `CampaignReply` DROP FOREIGN KEY `CampaignReply_campaignId_fkey`;
DROP TABLE `CampaignLog`;
DROP TABLE `CampaignReply`;
ALTER TABLE `OutreachLead` DROP COLUMN `replyClass`, DROP COLUMN `pausedUntil`, DROP COLUMN `stage`, DROP COLUMN `demoAt`, DROP COLUMN `closedAt`, DROP COLUMN `dealValue`, DROP COLUMN `ownerNotifiedAt`;
