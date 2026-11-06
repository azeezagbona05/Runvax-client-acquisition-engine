-- Client Acquisition: connected tools. One new table, additive only.

-- CreateTable
CREATE TABLE `IntegrationConnection` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `secret` TEXT NULL,
    `meta` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'connected',
    `statusDetail` VARCHAR(500) NULL,
    `lastCheckedAt` DATETIME(3) NULL,
    `lastSyncAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `IntegrationConnection_userId_provider_key`(`userId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `IntegrationConnection` ADD CONSTRAINT `IntegrationConnection_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
