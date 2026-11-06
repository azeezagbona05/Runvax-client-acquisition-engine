-- Client Acquisition: WhatsApp in campaigns. One new table, additive only (OutreachLead is not changed).

-- CreateTable
CREATE TABLE `LeadWhatsApp` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `messageId` VARCHAR(191) NULL,
    `error` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LeadWhatsApp_leadId_key`(`leadId`),
    INDEX `LeadWhatsApp_userId_sentAt_idx`(`userId`, `sentAt`),
    INDEX `LeadWhatsApp_campaignId_sentAt_idx`(`campaignId`, `sentAt`),
    INDEX `LeadWhatsApp_userId_phone_idx`(`userId`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LeadWhatsApp` ADD CONSTRAINT `LeadWhatsApp_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `OutreachLead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
