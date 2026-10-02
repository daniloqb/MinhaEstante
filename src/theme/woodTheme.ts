export interface WoodPalette {
  isLightOak: boolean;
  woodDark: string; // App bar, nav
  woodMedium: string; // Main background
  woodShelf: string; // Shelf base
  woodShelfHighlight: string;
  woodShelfShadow: string;
  woodBorder: string; // Border filigree
  goldPrimary: string; // Primary gold/brass
  textOnGold: string;
  paperSurface: string; // Aged paper
  paperSurfaceElevated: string;
  paperBorder: string;
  textOnWood: string;
  textSecondaryOnWood: string;
  textOnPaper: string;
  textSecondaryOnPaper: string;
  starGold: string;
  starWood: string;
  errorRustic: string;
}

export const DarkWalnutPalette: WoodPalette = {
  isLightOak: false,
  woodDark: '#2E1A0F',
  woodMedium: '#4A2C1A',
  woodShelf: '#7A4A2A',
  woodShelfHighlight: '#A0683D',
  woodShelfShadow: '#1E110A',
  woodBorder: '#8B5A33',
  goldPrimary: '#E8C98A',
  textOnGold: '#2E1A0F',
  paperSurface: '#F3E6CF',
  paperSurfaceElevated: '#FAF1DF',
  paperBorder: '#DCC8A7',
  textOnWood: '#F5E9D6',
  textSecondaryOnWood: '#D9C3A0',
  textOnPaper: '#2E1A0F',
  textSecondaryOnPaper: '#5C4030',
  starGold: '#E8C98A',
  starWood: '#8A4B12',
  errorRustic: '#E07A5F',
};

export const LightOakPalette: WoodPalette = {
  isLightOak: true,
  woodDark: '#8A5D3B',
  woodMedium: '#D8C2A7',
  woodShelf: '#B5895D',
  woodShelfHighlight: '#D4A77B',
  woodShelfShadow: '#5A3D24',
  woodBorder: '#A67C52',
  goldPrimary: '#D49B45',
  textOnGold: '#2E1A0F',
  paperSurface: '#FAF4EB',
  paperSurfaceElevated: '#FFFFFF',
  paperBorder: '#D9C8B2',
  textOnWood: '#2B1A0E',
  textSecondaryOnWood: '#5C4030',
  textOnPaper: '#2B1A0E',
  textSecondaryOnPaper: '#5C4030',
  starGold: '#D49B45',
  starWood: '#8A4B12',
  errorRustic: '#C0392B',
};

export function getPalette(isLightOak: boolean): WoodPalette {
  return isLightOak ? LightOakPalette : DarkWalnutPalette;
}
