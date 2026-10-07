export type LocaleId = 'pt-BR' | 'en-US' | 'es-ES' | 'fr-FR' | 'de-DE' | 'it-IT';

export interface LocaleInfo {
  id: LocaleId;
  name: string;
  country: string;
  flag: string;
  language: string;
}

export const AVAILABLE_LOCALES: LocaleInfo[] = [
  {
    id: 'pt-BR',
    name: 'Português (Brasil)',
    country: 'Brasil',
    flag: '🇧🇷',
    language: 'Português',
  },
  {
    id: 'en-US',
    name: 'English (United States)',
    country: 'United States',
    flag: '🇺🇸',
    language: 'English',
  },
  {
    id: 'es-ES',
    name: 'Español (España)',
    country: 'España / América Latina',
    flag: '🇪🇸',
    language: 'Español',
  },
  {
    id: 'fr-FR',
    name: 'Français (France)',
    country: 'France',
    flag: '🇫🇷',
    language: 'Français',
  },
  {
    id: 'de-DE',
    name: 'Deutsch (Deutschland)',
    country: 'Deutschland',
    flag: '🇩🇪',
    language: 'Deutsch',
  },
  {
    id: 'it-IT',
    name: 'Italiano (Italia)',
    country: 'Italia',
    flag: '🇮🇹',
    language: 'Italiano',
  },
];

export interface Translations {
  common: {
    appName: string;
    bookshelfTitle: string;
    save: string;
    cancel: string;
    confirm: string;
    delete: string;
    edit: string;
    close: string;
    back: string;
    loading: string;
    copy: string;
    copied: string;
    search: string;
    total: string;
    filter: string;
    all: string;
    success: string;
    error: string;
  };
  nav: {
    bookshelf: string;
    loans: string;
    search: string;
    stats: string;
    settings: string;
  };
  home: {
    title: string;
    searchPlaceholder: string;
    filterFormatAll: string;
    filterFormatPhysical: string;
    filterFormatEbook: string;
    emptyShelfTitle: string;
    emptyShelfDesc: string;
    addFirstBook: string;
    viewCovers: string;
    viewList: string;
    worksCount: string;
    quickStats: string;
    noResultsFound: string;
    tryClearingFilters: string;
  };
  status: {
    wantToRead: string;
    reading: string;
    read: string;
    abandoned: string;
    none: string;
  };
  format: {
    physical: string;
    ebook: string;
  };
  loans: {
    title: string;
    activeTab: string;
    returnedTab: string;
    newLoan: string;
    borrowerName: string;
    borrowerEmail: string;
    loanDate: string;
    returnDate: string;
    markReturned: string;
    noLoansActive: string;
    noLoansReturned: string;
    lendBook: string;
    contactWhatsApp: string;
  };
  search: {
    title: string;
    subtitle: string;
    inputPlaceholder: string;
    scanBarcode: string;
    manualRegister: string;
    searching: string;
    noResults: string;
    alreadyInShelf: string;
    addToShelf: string;
  };
  settings: {
    title: string;
    languageAndRegion: string;
    languageAndRegionDesc: string;
    currentLanguage: string;
    googleDriveTitle: string;
    googleDriveDesc: string;
    backupJsonTitle: string;
    backupJsonDesc: string;
    exportJson: string;
    importJson: string;
    themeTitle: string;
    lightOak: string;
    darkWalnut: string;
    apkTitle: string;
    apkDesc: string;
    downloadApk: string;
    footerText: string;
  };
  stats: {
    title: string;
    totalBooks: string;
    readBooks: string;
    readingBooks: string;
    wantToReadBooks: string;
    pagesRead: string;
  };
}
