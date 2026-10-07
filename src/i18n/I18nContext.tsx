import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { LocaleId, LocaleInfo, AVAILABLE_LOCALES, Translations } from './types';
import { TRANSLATIONS } from './translations';
import { BookStorage } from '../services/storage';

interface I18nContextType {
  locale: LocaleId;
  setLocale: (locale: LocaleId) => void;
  t: Translations;
  availableLocales: LocaleInfo[];
  currentLocaleInfo: LocaleInfo;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<LocaleId>(() => {
    const saved = BookStorage.loadLocale() as LocaleId;
    if (AVAILABLE_LOCALES.some((l) => l.id === saved)) {
      return saved;
    }
    // Auto-detect browser language if available
    try {
      const browserLang = navigator.language;
      const matched = AVAILABLE_LOCALES.find(
        (l) => l.id === browserLang || l.id.startsWith(browserLang.slice(0, 2))
      );
      if (matched) return matched.id;
    } catch {}
    return 'pt-BR';
  });

  const setLocale = (newLocale: LocaleId) => {
    setLocaleState(newLocale);
    BookStorage.saveLocale(newLocale);
    try {
      document.documentElement.lang = newLocale;
    } catch {}
  };

  useEffect(() => {
    try {
      document.documentElement.lang = locale;
    } catch {}
  }, [locale]);

  const t = useMemo(() => {
    return TRANSLATIONS[locale] || TRANSLATIONS['pt-BR'];
  }, [locale]);

  const currentLocaleInfo = useMemo(() => {
    return (
      AVAILABLE_LOCALES.find((l) => l.id === locale) ||
      AVAILABLE_LOCALES[0]
    );
  }, [locale]);

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        availableLocales: AVAILABLE_LOCALES,
        currentLocaleInfo,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
