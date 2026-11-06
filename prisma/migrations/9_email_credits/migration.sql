-- Client Acquisition, part 4: email reveal credits. Two new tables, additive only.
-- EmailWallet holds purchased/granted credits. EmailCreditLedger records every credit used or added; the unique
-- (userId, revealKey) pair means an email revealed once is never charged twice.

-- CreateTable
CREATE TABLE `EmailWallet` (
    `userId` VARCHAR(191) NOT NULL,
    `balance` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailCreditLedger` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `credits` INTEGER NOT NULL,
    `revealKey` VARCHAR(191) NULL,
    `period` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailCreditLedger_userId_revealKey_key`(`userId`, `revealKey`),
    INDEX `EmailCreditLedger_userId_kind_source_period_idx`(`userId`, `kind`, `source`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
