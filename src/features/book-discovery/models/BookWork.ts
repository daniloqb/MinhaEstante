export interface BookWork {
  id: string; // ex: 'work_ol_OL12345W' ou hash determinístico de título+autor
  primaryTitle: string;
  alternativeTitles: string[];
  authors: string[];
  originalLanguage?: string | null;
  description?: string | null;
  subjects: string[];
  externalIds: {
    openLibraryWorkKey?: string;
    wikidataId?: string;
    inventaireUri?: string;
  };
  editionIds: string[];
}
