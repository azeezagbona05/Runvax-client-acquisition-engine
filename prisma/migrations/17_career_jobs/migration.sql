-- Career Agent Phase 2: discovered jobs and match scores. Additive only.

CREATE TABLE `JobListing` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `source` VARCHAR(16) NOT NULL,
    `externalId` VARCHAR(120) NOT NULL,
    `dedupeKey` VARCHAR(64) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `company` VARCHAR(160) NOT NULL,
    `location` VARCHAR(200) NOT NULL DEFAULT '',
    `remote` BOOLEAN NOT NULL DEFAULT false,
    `url` VARCHAR(600) NOT NULL,
    `description` TEXT NOT NULL,
    `postedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JobListing_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `JobListing_userId_dedupeKey_key`(`userId`, `dedupeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `JobMatch` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `listingId` VARCHAR(191) NOT NULL,
    `score` INTEGER NOT NULL,
    `reasons` JSON NOT NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'new',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `JobMatch_listingId_key`(`listingId`),
    INDEX `JobMatch_userId_status_score_idx`(`userId`, `status`, `score`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `JobListing` ADD CONSTRAINT `JobListing_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `JobMatch` ADD CONSTRAINT `JobMatch_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `JobMatch` ADD CONSTRAINT `JobMatch_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `JobListing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
