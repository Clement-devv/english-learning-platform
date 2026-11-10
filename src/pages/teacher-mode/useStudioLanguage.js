import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const studioLanguageKey = scope => scope === 'family' ? 'teacherFamilyLanguage' : 'teacherStudioLanguage';

export function useStudioLanguage(scope) {
  const { i18n } = useTranslation();
  useLayoutEffect(() => {
    const prior = i18n.language;
    const stored = localStorage.getItem(studioLanguageKey(scope));
    const language = stored === 'vi' || stored === 'en' ? stored : 'en';
    if (i18n.language !== language) i18n.changeLanguage(language);
    return () => { if (i18n.language !== prior) i18n.changeLanguage(prior); };
  }, [i18n, scope]);
}
