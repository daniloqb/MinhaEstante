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
  woodDark: '#201007',
  woodMedium: '#3D2214',
  woodShelf: '#6E3F21',
  woodShelfHighlight: '#94582E',
  woodShelfShadow: '#150A04',
  woodBorder: '#8B5A33',
  goldPrimary: '#E8C98A',
  textOnGold: '#221006',
  paperSurface: '#F3E6CF',
  paperSurfaceElevated: '#FAF1DF',
  paperBorder: '#D0BA95',
  textOnWood: '#FDF8F0',
  textSecondaryOnWood: '#DFCAAE',
  textOnPaper: '#221006',
  textSecondaryOnPaper: '#523422',
  starGold: '#E8C98A',
  starWood: '#8A4B12',
  errorRustic: '#C93B2B',
};

export const LightOakPalette: WoodPalette = {
  isLightOak: true,
  woodDark: '#362012', // Rich dark chestnut oak for header and nav to ensure >8:1 contrast
  woodMedium: '#D8C2A7',
  woodShelf: '#B5895D',
  woodShelfHighlight: '#D4A77B',
  woodShelfShadow: '#5A3D24',
  woodBorder: '#8A5D3B',
  goldPrimary: '#E8C98A', // High contrast brass gold
  textOnGold: '#26160B',
  paperSurface: '#FAF4EB',
  paperSurfaceElevated: '#FFFFFF',
  paperBorder: '#D9C8B2',
  textOnWood: '#FDF8F0', // High contrast cream on woodDark (>12:1)
  textSecondaryOnWood: '#DFCAAE', // (>7.5:1 on woodDark)
  textOnPaper: '#22150C', // Deep ink on paper (>14:1)
  textSecondaryOnPaper: '#543825', // Warm wood secondary (>7.5:1 on paper)
  starGold: '#D4881E',
  starWood: '#8A4B12',
  errorRustic: '#B82E20',
};

export function getPalette(isLightOak: boolean): WoodPalette {
  return isLightOak ? LightOakPalette : DarkWalnutPalette;
}

