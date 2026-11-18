-- Team CRM: teammates, who owns which contact, notes and tasks. Additive only (new tables; no change to existing ones).

CREATE TABLE `CrmMember` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `email` VARCHAR(190) NOT NULL,
    `role` VARCHAR(8) NOT NULL DEFAULT 'member',
    `status` VARCHAR(8) NOT NULL DEFAULT 'invited',
    `invitedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `joinedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CrmMember_ownerId_email_key`(`ownerId`, `email`),
    INDEX `CrmMember_userId_idx`(`userId`),
    INDEX `CrmMember_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LeadAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LeadAssignment_leadId_key`(`leadId`),
    INDEX `LeadAssignment_ownerId_assigneeId_idx`(`ownerId`, `assigneeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CrmTask` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `assigneeId` VARCHAR(191) NULL,
    `title` VARCHAR(300) NOT NULL,
    `dueAt` DATETIME(3) NULL,
    `doneAt` DATETIME(3) NULL,
    `doneBy` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CrmTask_ownerId_doneAt_dueAt_idx`(`ownerId`, `doneAt`, `dueAt`),
    INDEX `CrmTask_leadId_idx`(`leadId`),
    INDEX `CrmTask_assigneeId_idx`(`assigneeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CrmNote` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(10) NOT NULL DEFAULT 'note',
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CrmNote_leadId_createdAt_idx`(`leadId`, `createdAt`),
    INDEX `CrmNote_ownerId_createdAt_idx`(`ownerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LeadAssignment` ADD CONSTRAINT `LeadAssignment_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `OutreachLead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CrmTask` ADD CONSTRAINT `CrmTask_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `OutreachLead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CrmNote` ADD CONSTRAINT `CrmNote_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `OutreachLead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
