import crypto from 'node:crypto';
import { seal, open } from '@/lib/integrations/crypto';

export interface AgentSecrets { webhookSecret?: string; wpPassword?: string; telegramToken?: string; telegramSecret?: string }
export const openSecrets = (sealed: string | null | undefined): AgentSecrets => open<AgentSecrets>(sealed) ?? {};
export const sealSecrets = (s: AgentSecrets) => seal(s);
export const newPublicKey = () => 'rva_' + crypto.randomBytes(15).toString('base64url');
export const newSecret = () => crypto.randomBytes(24).toString('base64url');
export const validKey = (k: unknown): k is string => typeof k === 'string' && /^rva_[A-Za-z0-9_-]{20}$/.test(k);
/** What the page may show about a secret: never the value. */
export const secretFlags = (s: AgentSecrets) => ({ webhookSecret: !!s.webhookSecret, wpPassword: !!s.wpPassword, telegramToken: !!s.telegramToken });
