-- Client Acquisition: knowledge base for assistants. Two new tables, additive only.

-- CreateTable
CREATE TABLE `KnowledgeSource` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ready',
    `error` VARCHAR(300) NULL,
    `meta` JSON NULL,
    `chars` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgeSource_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeChunk` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `idx` INTEGER NOT NULL,
    `label` VARCHAR(200) NULL,
    `text` TEXT NOT NULL,

    INDEX `KnowledgeChunk_sourceId_idx_idx`(`sourceId`, `idx`),
    INDEX `KnowledgeChunk_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KnowledgeSource` ADD CONSTRAINT `KnowledgeSource_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeChunk` ADD CONSTRAINT `KnowledgeChunk_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `KnowledgeSource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

