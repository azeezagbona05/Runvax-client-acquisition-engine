-- Client Acquisition, part 3: "My Templates". One new table, additive only.
-- A saved template keeps a campaign's reusable structure (brief and email sequence), never its contacts, replies or results.

-- CreateTable
CREATE TABLE `CampaignTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `industry` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NULL,
    `baseTemplateId` VARCHAR(191) NULL,
    `data` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CampaignTemplate_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
