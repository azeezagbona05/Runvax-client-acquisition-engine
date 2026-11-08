-- Client Acquisition: custom AI agents (visibility + assistant). Three new tables, additive only.

-- CreateTable
CREATE TABLE `CustomAgent` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'visibility',
    `name` VARCHAR(120) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `publicKey` VARCHAR(191) NOT NULL,
    `config` JSON NOT NULL,
    `secret` TEXT NULL,
    `lastRunAt` DATETIME(3) NULL,
    `nextRunAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CustomAgent_publicKey_key`(`publicKey`),
    INDEX `CustomAgent_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `CustomAgent_status_nextRunAt_idx`(`status`, `nextRunAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomAgentPost` (
    `id` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `summary` VARCHAR(400) NOT NULL,
    `body` MEDIUMTEXT NOT NULL,
    `keywords` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `source` VARCHAR(191) NOT NULL DEFAULT 'ai',
    `pushed` JSON NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomAgentPost_agentId_status_publishedAt_idx`(`agentId`, `status`, `publishedAt`),
    UNIQUE INDEX `CustomAgentPost_agentId_slug_key`(`agentId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomAgentChat` (
    `id` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(20) NOT NULL,
    `externalId` VARCHAR(120) NOT NULL,
    `visitor` JSON NULL,
    `messages` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `notifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomAgentChat_agentId_status_updatedAt_idx`(`agentId`, `status`, `updatedAt`),
    UNIQUE INDEX `CustomAgentChat_agentId_channel_externalId_key`(`agentId`, `channel`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CustomAgent` ADD CONSTRAINT `CustomAgent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomAgentPost` ADD CONSTRAINT `CustomAgentPost_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `CustomAgent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomAgentChat` ADD CONSTRAINT `CustomAgentChat_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `CustomAgent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

