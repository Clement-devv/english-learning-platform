// src/i18n/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import vi from './locales/vi.json';

const savedLang = localStorage.getItem('elp_lang') || 'en';

// Per-area text (e.g. the admin dashboard) lives in locales/<area>/<lang>.json and
// is downloaded only when a screen asks for it — useTranslation('admin') — and only
// for the language in use (plus English as the fallback). Keeps every visitor from
// downloading every dashboard's text in both languages.
const areaFiles = import.meta.glob('./locales/*/*.json');

const lazyAreas = {
  type: 'backend',
  init() {},
  read(lng, ns, callback) {
    const load = areaFiles[`./locales/${ns}/${lng}.json`];
    if (!load) return callback(null, {});
    load().then((m) => callback(null, m.default), (err) => callback(err, null));
  },
};

i18n.use(lazyAreas).use(initReactI18next).init({
  // The small shared file (nav, login, common) is bundled for instant first paint
  resources: {
    en: { translation: en },
    vi: { translation: vi },
  },
  partialBundledLanguages: true,
  ns: ['translation'],
  defaultNS: 'translation',
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
