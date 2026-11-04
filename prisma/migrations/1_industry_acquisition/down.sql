-- MANUAL ROLLBACK for 1_industry_acquisition. Never run automatically.
-- Drops only the tables this migration created, children before parents.
-- Requires explicit approval before use against any shared database; see
-- docs/database-migrations.md. Afterwards remove the migration's row:
--   DELETE FROM `_prisma_migrations` WHERE migration_name = '1_industry_acquisition';
DROP TABLE IF EXISTS `AcquisitionAgentRun`;
DROP TABLE IF EXISTS `AcquisitionApproval`;
DROP TABLE IF EXISTS `AcquisitionTask`;
DROP TABLE IF EXISTS `AcquisitionDraft`;
DROP TABLE IF EXISTS `AcquisitionRecommendation`;
DROP TABLE IF EXISTS `AcquisitionFinding`;
DROP TABLE IF EXISTS `AcquisitionDecisionMaker`;
DROP TABLE IF EXISTS `AcquisitionSource`;
DROP TABLE IF EXISTS `AcquisitionPipelineEvent`;
DROP TABLE IF EXISTS `AcquisitionSuppression`;
DROP TABLE IF EXISTS `AcquisitionProspect`;
