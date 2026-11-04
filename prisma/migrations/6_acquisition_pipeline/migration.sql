-- Client Acquisition, part 2: reply handling, the acquisition pipeline and the shared agent activity log.
-- Additive only: new columns on OutreachLead (created in migration 5) and two new tables.

-- AlterTable
ALTER TABLE `OutreachLead`
    ADD COLUMN `replyClass` VARCHAR(191) NULL,
    ADD COLUMN `pausedUntil` DATETIME(3) NULL,
    ADD COLUMN `stage` VARCHAR(191) NULL,
    ADD COLUMN `demoAt` DATETIME(3) NULL,
    ADD COLUMN `closedAt` DATETIME(3) NULL,
    ADD COLUMN `dealValue` INTEGER NULL,
    ADD COLUMN `ownerNotifiedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `CampaignReply` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `fromEmail` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `text` TEXT NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL,
    `replyClass` VARCHAR(191) NOT NULL,
    `confidence` DOUBLE NOT NULL DEFAULT 0.7,
    `classifiedBy` VARCHAR(191) NOT NULL DEFAULT 'rules',
    `suggestion` TEXT NULL,
    `suggestionBy` VARCHAR(191) NULL,
    `respondedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CampaignReply_userId_messageId_key`(`userId`, `messageId`),
    INDEX `CampaignReply_userId_receivedAt_idx`(`userId`, `receivedAt`),
    INDEX `CampaignReply_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NULL,
    `agent` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `detail` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CampaignLog_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `CampaignLog_campaignId_createdAt_idx`(`campaignId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CampaignReply` ADD CONSTRAINT `CampaignReply_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `OutreachCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CampaignReply` ADD CONSTRAINT `CampaignReply_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `OutreachLead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CampaignLog` ADD CONSTRAINT `CampaignLog_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `OutreachCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
