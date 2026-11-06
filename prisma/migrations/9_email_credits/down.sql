-- MANUAL ROLLBACK for 9_email_credits. Never run automatically. Deletes every wallet balance and the credit history.
DROP TABLE `EmailCreditLedger`;
DROP TABLE `EmailWallet`;
