-- Career Agent Phase 5: employer replies and interviews. Additive only.

CREATE TABLE `CareerResponse` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(14) NOT NULL,
    `subject` VARCHAR(200) NOT NULL DEFAULT '',
    `summary` VARCHAR(600) NOT NULL DEFAULT '',
    `receivedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CareerResponse_userId_receivedAt_idx`(`userId`, `receivedAt`),
    INDEX `CareerResponse_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CareerInterview` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NULL,
    `company` VARCHAR(160) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `kind` VARCHAR(8) NOT NULL DEFAULT 'video',
    `startsAt` DATETIME(3) NOT NULL,
    `location` VARCHAR(300) NOT NULL DEFAULT '',
    `notes` TEXT NOT NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'scheduled',
    `prep` JSON NULL,
    `reminderSentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CareerInterview_userId_startsAt_idx`(`userId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CareerResponse` ADD CONSTRAINT `CareerResponse_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CareerResponse` ADD CONSTRAINT `CareerResponse_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `JobApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CareerInterview` ADD CONSTRAINT `CareerInterview_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CareerInterview` ADD CONSTRAINT `CareerInterview_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `JobApplication`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
