-- CreateTable
CREATE TABLE `AcquisitionProspect` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `prospectId` VARCHAR(191) NOT NULL,
    `industryKey` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL DEFAULT 'discovered',
    `fitScore` INTEGER NULL,
    `scoreIsEstimate` BOOLEAN NOT NULL DEFAULT true,
    `discoveredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastVerifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AcquisitionProspect_prospectId_key`(`prospectId`),
    INDEX `AcquisitionProspect_userId_industryKey_state_idx`(`userId`, `industryKey`, `state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionSource` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `acqProspectId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `url` TEXT NULL,
    `contentHash` VARCHAR(191) NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcquisitionSource_userId_idx`(`userId`),
    UNIQUE INDEX `AcquisitionSource_acqProspectId_kind_contentHash_key`(`acqProspectId`, `kind`, `contentHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionDecisionMaker` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `acqProspectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `role` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `channel` VARCHAR(191) NOT NULL DEFAULT 'email',
    `verification` VARCHAR(191) NOT NULL DEFAULT 'unverified',
    `sourceId` VARCHAR(191) NULL,
    `observedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confidence` VARCHAR(191) NOT NULL DEFAULT 'low',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcquisitionDecisionMaker_userId_idx`(`userId`),
    UNIQUE INDEX `AcquisitionDecisionMaker_acqProspectId_email_key`(`acqProspectId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionFinding` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `acqProspectId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `polarity` VARCHAR(191) NOT NULL,
    `basis` VARCHAR(191) NOT NULL,
    `finding` TEXT NOT NULL,
    `evidence` TEXT NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `observedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `impactHypothesis` TEXT NULL,
    `confidence` VARCHAR(191) NOT NULL DEFAULT 'low',
    `validationQuestion` TEXT NULL,
    `solutionCategory` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcquisitionFinding_acqProspectId_category_idx`(`acqProspectId`, `category`),
    INDEX `AcquisitionFinding_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionRecommendation` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `acqProspectId` VARCHAR(191) NOT NULL,
    `primaryOfferId` VARCHAR(191) NOT NULL,
    `secondaryOfferId` VARCHAR(191) NULL,
    `rationale` TEXT NOT NULL,
    `findingIds` JSON NOT NULL,
    `targetRole` VARCHAR(191) NULL,
    `angle` TEXT NULL,
    `cta` TEXT NULL,
    `confidence` VARCHAR(191) NOT NULL DEFAULT 'low',
    `missingInfo` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcquisitionRecommendation_acqProspectId_idx`(`acqProspectId`),
    INDEX `AcquisitionRecommendation_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionDraft` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `acqProspectId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL DEFAULT 'email',
    `recipientDmId` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `evidenceFindingIds` JSON NOT NULL,
    `offerId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `riskFlags` JSON NULL,
    `gateResult` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AcquisitionDraft_userId_status_idx`(`userId`, `status`),
    INDEX `AcquisitionDraft_acqProspectId_idx`(`acqProspectId`),
    UNIQUE INDEX `AcquisitionDraft_userId_idempotencyKey_key`(`userId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionApproval` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `draftId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `actorEmail` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `bodyHashBefore` VARCHAR(191) NULL,
    `bodyHashAfter` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcquisitionApproval_draftId_createdAt_idx`(`draftId`, `createdAt`),
    INDEX `AcquisitionApproval_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionSuppression` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AcquisitionSuppression_userId_kind_value_key`(`userId`, `kind`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionTask` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `acqProspectId` VARCHAR(191) NULL,
    `parentTaskId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `input` JSON NULL,
    `output` JSON NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `scheduledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lockedUntil` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcquisitionTask_status_scheduledAt_idx`(`status`, `scheduledAt`),
    INDEX `AcquisitionTask_acqProspectId_idx`(`acqProspectId`),
    UNIQUE INDEX `AcquisitionTask_userId_idempotencyKey_key`(`userId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionAgentRun` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `agent` VARCHAR(191) NOT NULL,
    `attempt` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `inputTokens` INTEGER NULL,
    `outputTokens` INTEGER NULL,
    `costUsdMicros` INTEGER NULL,
    `durationMs` INTEGER NULL,
    `inputHash` VARCHAR(191) NULL,
    `evidenceRefs` JSON NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,

    INDEX `AcquisitionAgentRun_taskId_idx`(`taskId`),
    INDEX `AcquisitionAgentRun_userId_startedAt_idx`(`userId`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcquisitionPipelineEvent` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `acqProspectId` VARCHAR(191) NOT NULL,
    `fromState` VARCHAR(191) NOT NULL,
    `toState` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `actor` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcquisitionPipelineEvent_acqProspectId_createdAt_idx`(`acqProspectId`, `createdAt`),
    INDEX `AcquisitionPipelineEvent_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AcquisitionProspect` ADD CONSTRAINT `AcquisitionProspect_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionProspect` ADD CONSTRAINT `AcquisitionProspect_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionSource` ADD CONSTRAINT `AcquisitionSource_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionSource` ADD CONSTRAINT `AcquisitionSource_acqProspectId_fkey` FOREIGN KEY (`acqProspectId`) REFERENCES `AcquisitionProspect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionDecisionMaker` ADD CONSTRAINT `AcquisitionDecisionMaker_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionDecisionMaker` ADD CONSTRAINT `AcquisitionDecisionMaker_acqProspectId_fkey` FOREIGN KEY (`acqProspectId`) REFERENCES `AcquisitionProspect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionFinding` ADD CONSTRAINT `AcquisitionFinding_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionFinding` ADD CONSTRAINT `AcquisitionFinding_acqProspectId_fkey` FOREIGN KEY (`acqProspectId`) REFERENCES `AcquisitionProspect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionRecommendation` ADD CONSTRAINT `AcquisitionRecommendation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionRecommendation` ADD CONSTRAINT `AcquisitionRecommendation_acqProspectId_fkey` FOREIGN KEY (`acqProspectId`) REFERENCES `AcquisitionProspect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionDraft` ADD CONSTRAINT `AcquisitionDraft_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionDraft` ADD CONSTRAINT `AcquisitionDraft_acqProspectId_fkey` FOREIGN KEY (`acqProspectId`) REFERENCES `AcquisitionProspect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionApproval` ADD CONSTRAINT `AcquisitionApproval_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionApproval` ADD CONSTRAINT `AcquisitionApproval_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `AcquisitionDraft`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionSuppression` ADD CONSTRAINT `AcquisitionSuppression_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionTask` ADD CONSTRAINT `AcquisitionTask_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionTask` ADD CONSTRAINT `AcquisitionTask_acqProspectId_fkey` FOREIGN KEY (`acqProspectId`) REFERENCES `AcquisitionProspect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionAgentRun` ADD CONSTRAINT `AcquisitionAgentRun_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionAgentRun` ADD CONSTRAINT `AcquisitionAgentRun_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `AcquisitionTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionPipelineEvent` ADD CONSTRAINT `AcquisitionPipelineEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcquisitionPipelineEvent` ADD CONSTRAINT `AcquisitionPipelineEvent_acqProspectId_fkey` FOREIGN KEY (`acqProspectId`) REFERENCES `AcquisitionProspect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

