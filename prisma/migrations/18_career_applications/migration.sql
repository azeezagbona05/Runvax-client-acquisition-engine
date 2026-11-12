-- Career Agent Phase 3: prepared applications and the candidate's approval. Additive only.

CREATE TABLE `JobApplication` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'prepared',
    `cv` JSON NOT NULL,
    `coverLetter` TEXT NOT NULL,
    `answers` JSON NOT NULL,
    `gaps` JSON NOT NULL,
    `flags` JSON NOT NULL,
    `source` VARCHAR(8) NOT NULL DEFAULT 'rules',
    `edited` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `appliedAt` DATETIME(3) NULL,
    `appliedBy` VARCHAR(8) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `JobApplication_matchId_key`(`matchId`),
    INDEX `JobApplication_userId_status_updatedAt_idx`(`userId`, `status`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `JobApplication` ADD CONSTRAINT `JobApplication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `JobApplication` ADD CONSTRAINT `JobApplication_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `JobMatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
