-- Career Agent Phase 4: the submission queue and its evidence. Additive only.

CREATE TABLE `ApplicationSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(12) NOT NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'queued',
    `trigger` VARCHAR(8) NOT NULL DEFAULT 'user',
    `reason` VARCHAR(600) NOT NULL DEFAULT '',
    `questions` JSON NULL,
    `steps` JSON NULL,
    `evidence` VARCHAR(600) NOT NULL DEFAULT '',
    `finalUrl` VARCHAR(600) NOT NULL DEFAULT '',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,

    INDEX `ApplicationSubmission_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `ApplicationSubmission_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `ApplicationSubmission_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ApplicationSubmission` ADD CONSTRAINT `ApplicationSubmission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ApplicationSubmission` ADD CONSTRAINT `ApplicationSubmission_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `JobApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
