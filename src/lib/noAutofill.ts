/**
 * Props that stop browsers and password managers from popping up their own suggestions on a field.
 * `autoComplete="off"` alone is ignored by Chrome on fields it thinks are addresses (country, state, location), so an
 * unrecognised value is used instead, plus the opt-outs LastPass and 1Password read.
 */
export const NO_AUTOFILL = {
  autoComplete: 'nope',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-form-type': 'other',
} as const;
