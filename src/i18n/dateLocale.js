// src/i18n/dateLocale.js
import i18n from './i18n.js';

/**
 * Locale for formatting dates in the chosen app language.
 * English keeps the format the screen asked for ("en-US" → Oct 12, "en-GB" → 12 Oct).
 * @param {string} [english] - locale to use when the app is in English
 */
export function dateLocale(english = 'en-US') {
  return i18n.language === 'vi' ? 'vi-VN' : english;
}
