-- Appointments follow-up: what happened at a booked meeting and the next step. Additive only (one new table, no change to OutreachLead).

CREATE TABLE `LeadAppointment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `outcome` VARCHAR(12) NULL,
    `nextAction` VARCHAR(300) NULL,
    `nextActionDue` DATETIME(3) NULL,
    `nextActionDoneAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LeadAppointment_leadId_key`(`leadId`),
    INDEX `LeadAppointment_userId_outcome_idx`(`userId`, `outcome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LeadAppointment` ADD CONSTRAINT `LeadAppointment_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `OutreachLead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
