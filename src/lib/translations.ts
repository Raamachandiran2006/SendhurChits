
// This file can be deleted or left empty.
// The internationalization feature has been reverted.
export type Language = 'en' | 'ta'; // Keep for type safety if any references remain

export const translations = {
  en: {},
  ta: {}
};

export type TranslationKeys = keyof typeof translations.en;
