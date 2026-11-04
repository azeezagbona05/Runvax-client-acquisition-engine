-- CreateTable
CREATE TABLE `OutreachCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `followUpSubject` VARCHAR(191) NULL,
    `followUpBody` TEXT NULL,
    `followUpAfterDays` INTEGER NOT NULL DEFAULT 3,
    `maxFollowUps` INTEGER NOT NULL DEFAULT 1,
    `dailyCap` INTEGER NOT NULL DEFAULT 30,
    `automation` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `startedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OutreachCampaign_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OutreachLead` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `business` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `token` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NULL,
    `customSubject` VARCHAR(191) NULL,
    `customBody` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `lastSentAt` DATETIME(3) NULL,
    `followUpsSent` INTEGER NOT NULL DEFAULT 0,
    `openedAt` DATETIME(3) NULL,
    `openCount` INTEGER NOT NULL DEFAULT 0,
    `clickedAt` DATETIME(3) NULL,
    `clickCount` INTEGER NOT NULL DEFAULT 0,
    `repliedAt` DATETIME(3) NULL,
    `outcome` VARCHAR(191) NULL,
    `unsubscribedAt` DATETIME(3) NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `OutreachLead_token_key`(`token`),
    INDEX `OutreachLead_campaignId_status_idx`(`campaignId`, `status`),
    INDEX `OutreachLead_userId_email_idx`(`userId`, `email`),
    INDEX `OutreachLead_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `OutreachLead_campaignId_email_key`(`campaignId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OutreachCampaign` ADD CONSTRAINT `OutreachCampaign_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OutreachLead` ADD CONSTRAINT `OutreachLead_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `OutreachCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
