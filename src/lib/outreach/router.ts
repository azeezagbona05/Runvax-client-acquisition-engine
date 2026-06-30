import type {
  ProspectContext, RouterSelection,
  PersuasionPrinciple, CtaLevel,
} from './types';
import { getFramework, UI_PICKER_MAP } from './frameworks/registry';
import { OBJECTION_REFRAMES } from './frameworks/objection';

// Classify free-text objection into one of our handled categories.
function classifyObjection(
  text: string,
): keyof typeof OBJECTION_REFRAMES {
  const t = text.toLowerCase();
  if (t.includes('instagram') || t.includes('facebook') || t.includes('social')) return 'has_social';
  if (t.includes('expensive') || t.includes('cost') || t.includes('price') || t.includes('afford')) return 'too_expensive';
  if (t.includes('referral') || t.includes('word of mouth') || t.includes('recommendation')) return 'referrals';
  if (t.includes('time') || t.includes('busy') || t.includes('manage')) return 'no_time';
  return 'other';
}

// Deterministic rule table — pure function, no I/O.
export function selectFrameworks(ctx: ProspectContext): RouterSelection {
  // Manual UI picker override: preserve existing framework picker behaviour.
  if (ctx.forceFrameworkId) {
    const normalised = UI_PICKER_MAP[ctx.forceFrameworkId] ?? ctx.forceFrameworkId;
    const primary = getFramework(normalised);
    const [principle, ctaLevel] = derivePrincipleAndCta(ctx);
    return { primary, principle, ctaLevel };
  }

  const { intent, channel, hasWebsite, followupStep } = ctx;

  if (intent === 'cold_first_touch') {
    if (channel === 'whatsapp' && !hasWebsite) {
      return {
        primary: getFramework('three_line'),
        secondary: getFramework('pas'),
        principle: 'reciprocity',
        ctaLevel: 'micro',
      };
    }
    return {
      primary: getFramework('aidca'),
      secondary: getFramework('cgp'),
      principle: 'authority',
      ctaLevel: 'soft_call',
    };
  }

  if (intent === 'audit_outreach') {
    return {
      primary: getFramework('cgp'),
      secondary: getFramework('what_so_what'),
      principle: 'authority',
      ctaLevel: 'micro',
    };
  }

  if (intent === 'reply_interested') {
    return {
      primary: getFramework('spin'),
      principle: 'commitment',
      ctaLevel: 'soft_call',
    };
  }

  if (intent === 'reply_objection') {
    const objectionKey = ctx.objectionText
      ? classifyObjection(ctx.objectionText)
      : 'other';
    return {
      primary: getFramework('laer'),
      secondary: getFramework('feel_felt_found'),
      principle: 'liking',
      ctaLevel: 'interest',
      objectionReframe: OBJECTION_REFRAMES[objectionKey],
    };
  }

  if (intent === 'proposal') {
    return {
      primary: getFramework('storybrand'),
      secondary: getFramework('proposal_spine'),
      principle: 'social_proof',
      ctaLevel: 'direct_close',
    };
  }

  if (intent === 'weakness_report') {
    return {
      primary: getFramework('what_so_what'),
      secondary: getFramework('fab'),
      principle: 'authority',
      ctaLevel: 'soft_call',
    };
  }

  if (intent === 'presence_audit') {
    return {
      primary: getFramework('cgp'),
      secondary: getFramework('what_so_what'),
      principle: 'authority',
      ctaLevel: 'micro',
    };
  }

  if (intent === 'followup') {
    if (followupStep === 1) {
      return {
        primary: getFramework('value_add_nudge'),
        principle: 'reciprocity',
        ctaLevel: 'soft_call',
      };
    }
    if (followupStep === 2) {
      return {
        primary: getFramework('value_add_nudge'),
        secondary: getFramework('sss'),
        principle: 'social_proof',
        ctaLevel: 'interest',
      };
    }
    // step 3 or unspecified
    return {
      primary: getFramework('breakup'),
      principle: 'scarcity',
      ctaLevel: 'two_option',
    };
  }

  if (intent === 'breakup') {
    return {
      primary: getFramework('breakup'),
      principle: 'scarcity',
      ctaLevel: 'two_option',
    };
  }

  // Fallback — should never reach here given exhaustive intent list.
  return {
    primary: getFramework('pas'),
    principle: 'authority',
    ctaLevel: 'soft_call',
  };
}

// Derive principle + CTA for manual-override case (picker set, no intent row available).
function derivePrincipleAndCta(
  ctx: ProspectContext,
): [PersuasionPrinciple, CtaLevel] {
  const { intent, channel, hasWebsite } = ctx;
  if (intent === 'cold_first_touch') {
    return channel === 'whatsapp' && !hasWebsite
      ? ['reciprocity', 'micro']
      : ['authority', 'soft_call'];
  }
  if (intent === 'reply_objection') return ['liking', 'interest'];
  if (intent === 'proposal') return ['social_proof', 'direct_close'];
  if (intent === 'followup') return ['reciprocity', 'soft_call'];
  if (intent === 'breakup') return ['scarcity', 'two_option'];
  return ['authority', 'soft_call'];
}
