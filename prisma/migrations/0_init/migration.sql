-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `emailVerified` DATETIME(3) NULL,
    `image` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `plan` VARCHAR(191) NOT NULL DEFAULT 'free',
    `paystackCustomerCode` VARCHAR(191) NULL,
    `paystackSubscriptionCode` VARCHAR(191) NULL,
    `planExpiresAt` DATETIME(3) NULL,
    `expiryReminderSentAt` DATETIME(3) NULL,
    `searchLimitOverride` INTEGER NULL,
    `blockedLocations` TEXT NULL,
    `blockedCountries` TEXT NULL,
    `registrationIp` VARCHAR(191) NULL,
    `lastSeenIp` VARCHAR(191) NULL,
    `lastActiveAt` DATETIME(3) NULL,
    `isSuspended` BOOLEAN NOT NULL DEFAULT false,
    `termsAcceptedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebAuthnCredential` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `credentialId` VARCHAR(191) NOT NULL,
    `publicKey` LONGBLOB NOT NULL,
    `counter` INTEGER NOT NULL DEFAULT 0,
    `transports` VARCHAR(191) NULL,
    `deviceName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WebAuthnCredential_credentialId_key`(`credentialId`),
    INDEX `WebAuthnCredential_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Account` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(191) NULL,

    UNIQUE INDEX `Account_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_sessionToken_key`(`sessionToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationToken` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VerificationToken_token_key`(`token`),
    UNIQUE INDEX `VerificationToken_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Prospect` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `businessName` VARCHAR(191) NOT NULL,
    `businessData` JSON NOT NULL,
    `stage` VARCHAR(191) NOT NULL DEFAULT 'found',
    `notes` TEXT NULL,
    `score` INTEGER NULL,
    `estimatedPriceMin` INTEGER NULL,
    `estimatedPriceMax` INTEGER NULL,
    `savedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `outreachSentAt` DATETIME(3) NULL,
    `reminderDate` VARCHAR(191) NULL,
    `reminderNote` VARCHAR(191) NULL,
    `followUpSequence` JSON NULL,
    `source` VARCHAR(191) NULL,
    `campaignId` VARCHAR(191) NULL,

    INDEX `Prospect_campaignId_idx`(`campaignId`),
    UNIQUE INDEX `Prospect_userId_businessId_key`(`userId`, `businessId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `prospectId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `replyType` VARCHAR(191) NULL,
    `framework` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OutreachSignal` (
    `id` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `sendCount` INTEGER NOT NULL DEFAULT 1,
    `firstSentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OutreachSignal_businessId_lastSentAt_idx`(`businessId`, `lastSentAt`),
    UNIQUE INDEX `OutreachSignal_businessId_userId_key`(`businessId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentActivity` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `agentKey` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `detail` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgentActivity_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OutreachDraft` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `prospectId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `whatsapp` TEXT NULL,
    `emailSubject` VARCHAR(191) NULL,
    `emailBody` TEXT NULL,
    `framework` VARCHAR(191) NULL,
    `opportunityTitle` VARCHAR(191) NULL,
    `opportunityReason` TEXT NULL,
    `priorContext` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OutreachDraft_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AtlasBrief` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `recommendations` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AtlasBrief_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingBrief` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `recommendations` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BillingBrief_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminBrief` (
    `id` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `recommendations` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AdminBrief_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorEmail` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `detail` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `placeId` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `rating` DOUBLE NULL,
    `reviewCount` INTEGER NULL,
    `hasWebsite` BOOLEAN NOT NULL DEFAULT false,
    `capturedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BusinessSnapshot_placeId_date_idx`(`placeId`, `date`),
    INDEX `BusinessSnapshot_capturedAt_idx`(`capturedAt`),
    UNIQUE INDEX `BusinessSnapshot_placeId_date_key`(`placeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadTrigger` (
    `id` VARCHAR(191) NOT NULL,
    `placeId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `businessName` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'NG',
    `detail` TEXT NOT NULL,
    `strength` VARCHAR(191) NOT NULL,
    `detectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadTrigger_city_detectedAt_idx`(`city`, `detectedAt`),
    INDEX `LeadTrigger_category_detectedAt_idx`(`category`, `detectedAt`),
    INDEX `LeadTrigger_detectedAt_idx`(`detectedAt`),
    UNIQUE INDEX `LeadTrigger_placeId_type_key`(`placeId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserSettings` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `dailyGoal` INTEGER NOT NULL DEFAULT 10,
    `avgDealValue` INTEGER NOT NULL DEFAULT 300000,
    `closeRatePct` INTEGER NOT NULL DEFAULT 10,
    `senderName` VARCHAR(191) NULL,
    `businessName` VARCHAR(191) NULL,
    `whatsapp` VARCHAR(191) NULL,
    `replyEmail` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `tagline` VARCHAR(191) NULL,
    `jobTitle` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `smtpHost` VARCHAR(191) NULL,
    `smtpPort` INTEGER NULL,
    `smtpUser` VARCHAR(191) NULL,
    `smtpPass` TEXT NULL,
    `smtpFrom` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `bankAccount` VARCHAR(191) NULL,
    `bankAcctName` VARCHAR(191) NULL,
    `paymentLink` VARCHAR(191) NULL,
    `rateCard` JSON NULL,
    `portfolio` JSON NULL,
    `onboardingDone` BOOLEAN NOT NULL DEFAULT false,
    `autoProspectEnabled` BOOLEAN NOT NULL DEFAULT false,
    `autoProspectIndustry` VARCHAR(191) NULL,
    `autoProspectLocation` VARCHAR(191) NULL,
    `autoProspectMinRating` DOUBLE NOT NULL DEFAULT 0,
    `autoProspectNoWebsiteOnly` BOOLEAN NOT NULL DEFAULT true,
    `autoDraftEnabled` BOOLEAN NOT NULL DEFAULT false,
    `waPhoneNumberId` VARCHAR(191) NULL,
    `waAccessToken` TEXT NULL,
    `waTemplateName` VARCHAR(191) NULL,
    `wabaId` VARCHAR(191) NULL,
    `waDisplayPhone` VARCHAR(191) NULL,
    `waTemplateStatus` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserSettings_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `DailyLog_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UsageRecord` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `aiCalls` INTEGER NOT NULL DEFAULT 0,
    `searchCount` INTEGER NOT NULL DEFAULT 0,
    `openaiInputTokens` INTEGER NOT NULL DEFAULT 0,
    `openaiOutputTokens` INTEGER NOT NULL DEFAULT 0,
    `geminiInputTokens` INTEGER NOT NULL DEFAULT 0,
    `geminiOutputTokens` INTEGER NOT NULL DEFAULT 0,
    `googlePlacesReqs` INTEGER NOT NULL DEFAULT 0,
    `searchLimitEmailSent` BOOLEAN NOT NULL DEFAULT false,
    `aiLimitEmailSent` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `UsageRecord_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'success',
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Payment_reference_key`(`reference`),
    INDEX `Payment_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_token_key`(`token`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailVerificationToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailVerificationToken_token_key`(`token`),
    INDEX `EmailVerificationToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SearchHistory` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `industry` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `totalCount` INTEGER NOT NULL DEFAULT 0,
    `noWebsiteCount` INTEGER NOT NULL DEFAULT 0,
    `searchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SearchHistory_userId_idx`(`userId`),
    UNIQUE INDEX `SearchHistory_userId_industry_location_key`(`userId`, `industry`, `location`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanConfig` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT '',
    `price` VARCHAR(191) NULL,
    `priceNote` VARCHAR(191) NOT NULL DEFAULT 'per month',
    `searchesPerDay` INTEGER NOT NULL,
    `resultsPerSearch` INTEGER NOT NULL,
    `aiCallsPerDay` INTEGER NOT NULL,
    `maxProspects` INTEGER NOT NULL,
    `features` TEXT NULL,
    `allowedLocations` TEXT NULL,
    `allowedCountries` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PlanConfig_planId_key`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DemoSite` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `businessName` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DemoSite_slug_key`(`slug`),
    INDEX `DemoSite_userId_idx`(`userId`),
    UNIQUE INDEX `DemoSite_userId_businessId_key`(`userId`, `businessId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SearchCache` (
    `id` VARCHAR(191) NOT NULL,
    `cacheKey` VARCHAR(191) NOT NULL,
    `query` TEXT NOT NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'NG',
    `radius` INTEGER NOT NULL DEFAULT 5,
    `results` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SearchCache_cacheKey_key`(`cacheKey`),
    INDEX `SearchCache_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CachedBusiness` (
    `id` VARCHAR(191) NOT NULL,
    `placeId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'NG',
    `phone` VARCHAR(191) NULL,
    `website` TEXT NULL,
    `hasWebsite` BOOLEAN NOT NULL DEFAULT false,
    `rating` DOUBLE NULL,
    `reviewCount` INTEGER NULL,
    `description` TEXT NULL,
    `openingHours` JSON NULL,
    `categoryTypes` JSON NULL,
    `reviews` JSON NULL,
    `competitors` JSON NULL,
    `detailsRefreshedAt` DATETIME(3) NULL,
    `discoveredEmails` JSON NULL,
    `emailsCrawledAt` DATETIME(3) NULL,
    `psiScore` INTEGER NULL,
    `psiDesktopScore` INTEGER NULL,
    `psiDetails` JSON NULL,
    `psiScreenshot` MEDIUMTEXT NULL,
    `psiCheckedAt` DATETIME(3) NULL,
    `timesSearched` INTEGER NOT NULL DEFAULT 1,
    `timesContacted` INTEGER NOT NULL DEFAULT 0,
    `timesConverted` INTEGER NOT NULL DEFAULT 0,
    `totalDealValue` INTEGER NOT NULL DEFAULT 0,
    `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CachedBusiness_placeId_key`(`placeId`),
    INDEX `CachedBusiness_country_city_idx`(`country`, `city`),
    INDEX `CachedBusiness_category_idx`(`category`),
    INDEX `CachedBusiness_hasWebsite_idx`(`hasWebsite`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentTask` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `prospectId` VARCHAR(191) NULL,
    `parentTaskId` VARCHAR(191) NULL,
    `input` JSON NULL,
    `output` JSON NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `scheduledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgentTask_status_scheduledAt_idx`(`status`, `scheduledAt`),
    INDEX `AgentTask_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AgentTask_prospectId_idx`(`prospectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campaign` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `industry` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `noWebsiteOnly` BOOLEAN NOT NULL DEFAULT true,
    `minRating` DOUBLE NOT NULL DEFAULT 0,
    `dailyCap` INTEGER NOT NULL DEFAULT 20,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `lastRunAt` DATETIME(3) NULL,
    `totalImported` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Campaign_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProspectMemory` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `prospectId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `confidence` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProspectMemory_prospectId_createdAt_idx`(`prospectId`, `createdAt`),
    INDEX `ProspectMemory_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WebAuthnCredential` ADD CONSTRAINT `WebAuthnCredential_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prospect` ADD CONSTRAINT `Prospect_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OutreachSignal` ADD CONSTRAINT `OutreachSignal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentActivity` ADD CONSTRAINT `AgentActivity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OutreachDraft` ADD CONSTRAINT `OutreachDraft_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OutreachDraft` ADD CONSTRAINT `OutreachDraft_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AtlasBrief` ADD CONSTRAINT `AtlasBrief_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillingBrief` ADD CONSTRAINT `BillingBrief_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSettings` ADD CONSTRAINT `UserSettings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyLog` ADD CONSTRAINT `DailyLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsageRecord` ADD CONSTRAINT `UsageRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailVerificationToken` ADD CONSTRAINT `EmailVerificationToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SearchHistory` ADD CONSTRAINT `SearchHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DemoSite` ADD CONSTRAINT `DemoSite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentTask` ADD CONSTRAINT `AgentTask_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProspectMemory` ADD CONSTRAINT `ProspectMemory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

