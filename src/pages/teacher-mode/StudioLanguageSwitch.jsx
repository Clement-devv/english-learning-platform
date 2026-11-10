import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { studioLanguageKey } from './useStudioLanguage';

export default function StudioLanguageSwitch({ scope = 'teacher' }) {
  const { i18n } = useTranslation();
  const isVietnamese = (i18n.resolvedLanguage || i18n.language) === 'vi';
  return <button type="button" className="tm-language-switch" onClick={() => { const next = isVietnamese ? 'en' : 'vi'; localStorage.setItem(studioLanguageKey(scope), next); i18n.changeLanguage(next); }} aria-label={isVietnamese ? 'Switch to English' : 'Chuyển sang tiếng Việt'}><Languages size={16} />{isVietnamese ? 'English' : 'Tiếng Việt'}</button>;
}
