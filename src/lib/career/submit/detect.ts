/** Words that tell us what a page is. Kept separate from the browser code so they can be tested without one. */
export const CONFIRMATION: Record<string, RegExp> = {
  greenhouse: /\b(?:thank you for applying|your application has been (?:submitted|received)|application (?:has been )?(?:submitted|received)|we(?:'ve| have) received your application)\b/i,
  lever: /\b(?:application submitted|thanks? for applying|thank you for (?:applying|your (?:application|interest))|your application has been (?:submitted|received))\b/i,
  fixture: /\b(?:thank you for applying|application submitted)\b/i,
};
/** A challenge or security check the agent must hand back, never get past. */
export const CHALLENGE_TEXT = /\b(?:verify (?:that )?you(?:'re| are) (?:a )?human|are you a robot|i(?:'m| am) not a robot|security (?:check|code|verification)|verification code|complete the captcha|captcha|unusual traffic|access denied|just a moment|checking your browser|press (?:and|&) hold)\b/i;
export const BLOCKED_TEXT = /\b(?:access denied|403 forbidden|too many requests|you have been blocked|request blocked)\b/i;
export const CLOSED_TEXT = /\b(?:no longer (?:accepting|available|open)|this (?:job|position|role|posting) (?:has been (?:closed|filled)|is (?:no longer|closed))|position (?:has been )?filled|job not found|page not found)\b/i;
export const SUBMIT_LABEL = /^(?:submit(?: application)?|apply(?: now)?|send application|submit your application)$/i;
