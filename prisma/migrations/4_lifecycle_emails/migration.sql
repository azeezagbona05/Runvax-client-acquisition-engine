-- CreateTable
CREATE TABLE `LifecycleEmail` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LifecycleEmail_key_idx`(`key`),
    UNIQUE INDEX `LifecycleEmail_userId_key_key`(`userId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LifecycleEmail` ADD CONSTRAINT `LifecycleEmail_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

