package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

@Immutable
data class WoodPalette(
    val woodDark: Color = WoodDark,
    val woodMedium: Color = WoodMedium,
    val woodShelf: Color = WoodShelf,
    val woodShelfHighlight: Color = WoodShelfHighlight,
    val woodShelfShadow: Color = WoodShelfShadow,
    val woodBorder: Color = WoodBorder,
    val goldPrimary: Color = GoldBrassPrimary,
    val textOnGold: Color = TextOnGold,
    val paperSurface: Color = PaperSurface,
    val paperSurfaceElevated: Color = PaperSurfaceElevated,
    val paperBorder: Color = PaperBorder,
    val textOnWood: Color = TextOnWood,
    val textSecondaryOnWood: Color = TextSecondaryOnWood,
    val textOnPaper: Color = TextOnPaper,
    val textSecondaryOnPaper: Color = TextSecondaryOnPaper,
    val starGold: Color = StarGold,
    val starWood: Color = StarWood,
    val isLightOak: Boolean = false
)

val LocalWoodPalette = staticCompositionLocalOf { WoodPalette() }

private val WalnutColorScheme = darkColorScheme(
    primary = GoldBrassPrimary,
    onPrimary = TextOnGold,
    primaryContainer = WoodBorder,
    onPrimaryContainer = GoldBrassPrimary,
    secondary = GoldBrassPrimary,
    onSecondary = TextOnGold,
    secondaryContainer = WoodShelf,
    onSecondaryContainer = TextOnWood,
    background = WoodMedium,
    onBackground = TextOnWood,
    surface = PaperSurface,
    onSurface = TextOnPaper,
    surfaceVariant = PaperSurfaceElevated,
    onSurfaceVariant = TextSecondaryOnPaper,
    outline = WoodBorder,
    outlineVariant = PaperBorder,
    error = ErrorRustic,
    onError = Color.White
)

private val OakColorScheme = lightColorScheme(
    primary = WoodBorder,
    onPrimary = Color.White,
    primaryContainer = OakMedium,
    onPrimaryContainer = OakText,
    secondary = OakShelf,
    onSecondary = Color.White,
    background = OakLightBackground,
    onBackground = OakText,
    surface = PaperSurfaceElevated,
    onSurface = OakText,
    surfaceVariant = PaperSurface,
    onSurfaceVariant = OakTextSecondary,
    outline = OakDark,
    error = ErrorRustic
)

@Composable
fun MinhaEstanteTheme(
    useLightOak: Boolean = false,
    content: @Composable () -> Unit
) {
    val palette = if (useLightOak) {
        WoodPalette(
            woodDark = OakDark,
            woodMedium = OakLightBackground,
            woodShelf = OakShelf,
            woodShelfHighlight = Color(0xFFDCC19F),
            woodShelfShadow = Color(0xFF7A5430),
            woodBorder = OakDark,
            goldPrimary = WoodBorder,
            textOnGold = Color.White,
            paperSurface = PaperSurfaceElevated,
            paperSurfaceElevated = Color.White,
            paperBorder = OakMedium,
            textOnWood = OakText,
            textSecondaryOnWood = OakTextSecondary,
            textOnPaper = OakText,
            textSecondaryOnPaper = OakTextSecondary,
            starGold = StarWood,
            starWood = StarWood,
            isLightOak = true
        )
    } else {
        WoodPalette()
    }

    val colorScheme = if (useLightOak) OakColorScheme else WalnutColorScheme

    CompositionLocalProvider(LocalWoodPalette provides palette) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = EstanteTypography,
            content = content
        )
    }
}
