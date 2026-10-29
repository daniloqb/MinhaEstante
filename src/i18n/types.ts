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
  attachments: {
    manage: string;
    replace: string;
    detach: string;
    verify: string;
    retry: string;
    confirmReplace: string;
    confirmDetach: string;
    previousFile: string;
    newFile: string;
    identical: string;
    different: string;
    positionPreserved: string;
    positionInvalidated: string;
    noPosition: string;
    positionRemoved: string;
    historyPreserved: string;
    retentionNotice: string;
    preparedNotice: string;
    detachNotice: string;
    cancelAction: string;
    detached: string;
    checked: string;
    accessible: string;
    recovered: string;
    reviewing: string;
    recovering: string;
    recover: string;
    missing: string;
    accessHelp: string;
    positionChanged: string;
    title: string;
    ebook: string;
    audiobook: string;
    noEbook: string;
    noAudiobook: string;
    addEbook: string;
    addAudiobook: string;
    prepare: string;
    prepareHint: string;
    backupNotice: string;
    available: string;
    unavailable: string;
    permission: string;
    pending: string;
    unknown: string;
    integrityRecorded: string;
    integrityVerified: string;
    integrityUnknown: string;
    selecting: string;
    configuring: string;
    validating: string;
    preparing: string;
    copying: string;
    verifying: string;
    committing: string;
    confirming: string;
    completed: string;
    cancelled: string;
    cancel: string;
    cancelling: string;
    refresh: string;
    saveFirst: string;
    invalid: string;
    unsupported: string;
    providerUnavailable: string;
    persistenceFailed: string;
    conflict: string;
    failed: string;
    quota: string;
    integrityFailure: string;
    stored: string;
  };
  digitalStorage: { fileUnavailable: string; unavailable: string; quota: string; integrity: string; review: string; persistenceDenied: string; recovering: string; failed: string };
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
    home: string;
    bookshelf: string;
    loans: string;
    search: string;
    stats: string;
    settings: string;
  };
  landingHome: {
    welcome: string;
    welcomeSubtitle: string;
    searchPrompt: string;
    myShelf: string;
    read: string;
    wantToRead: string;
    loans: string;
    yourShelf: string;
    trending: string;
    bestSellers: string;
    becauseYouLike: string;
    recommendedForYou: string;
    newReleases: string;
    continueJourney: string;
    viewAll: string;
    readingPreferences: string;
    selectGenres: string;
    noRecommendations: string;
    refresh: string;
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
    audiobook: string;
    selectionHint: string;
  };
  ownership: {
    label: string;
    description: string;
    owned: string;
    notOwned: string;
    add: string;
    remove: string;
    added: string;
    removed: string;
    records: string;
    registered: string;
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
