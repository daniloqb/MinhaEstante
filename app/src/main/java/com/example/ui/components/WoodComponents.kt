package com.example.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.ui.theme.CormorantFontFamily
import com.example.ui.theme.LocalWoodPalette
import kotlin.math.abs

/**
 * Fundo com textura realista e sutil de veios de madeira
 */
@Composable
fun WoodBackground(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    val palette = LocalWoodPalette.current

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(palette.woodMedium)
            .drawBehind {
                val width = size.width
                val height = size.height

                // Base gradient vertical
                drawRect(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            palette.woodMedium,
                            palette.woodDark.copy(alpha = 0.85f),
                            palette.woodMedium
                        )
                    )
                )

                // Veios de madeira orgânicos sutis
                val lineSpacing = 32f
                var x = 0f
                var i = 0
                while (x < width + 100f) {
                    val path = Path()
                    path.moveTo(x, 0f)
                    val waveAmp = if (i % 3 == 0) 12f else 6f
                    val controlY1 = height * 0.33f
                    val controlY2 = height * 0.66f
                    val shift = if (i % 2 == 0) waveAmp else -waveAmp

                    path.cubicTo(
                        x + shift, controlY1,
                        x - shift, controlY2,
                        x + (shift * 0.5f), height
                    )

                    drawPath(
                        path = path,
                        color = Color.Black.copy(alpha = if (i % 4 == 0) 0.08f else 0.04f),
                        style = Stroke(width = if (i % 3 == 0) 2.5f else 1.2f)
                    )

                    // Linha tênue de reflexo de veio
                    drawPath(
                        path = path,
                        color = palette.goldPrimary.copy(alpha = 0.015f),
                        style = Stroke(width = 0.8f)
                    )

                    x += lineSpacing + ((i * 17) % 23)
                    i++
                }
            },
        content = content
    )
}

/**
 * Prateleira clássica de madeira com brilho superior chanfrado e sombra inferior
 */
@Composable
fun WoodShelf(
    modifier: Modifier = Modifier,
    height: Dp = 16.dp,
    label: String? = null,
    sublabel: String? = null
) {
    val palette = LocalWoodPalette.current

    Column(modifier = modifier.fillMaxWidth()) {
        // Se houver título da prateleira (ex: "2026 · 9 livros")
        if (label != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = label,
                    fontFamily = CormorantFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = palette.goldPrimary
                )
                if (sublabel != null) {
                    Text(
                        text = sublabel,
                        fontFamily = CormorantFontFamily,
                        fontSize = 15.sp,
                        color = palette.textSecondaryOnWood
                    )
                }
            }
        }

        // Barra da prateleira 3D
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(height)
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            palette.woodShelfHighlight, // Borda superior iluminada
                            palette.woodShelf,          // Madeira da prateleira
                            palette.woodDark            // Base escura
                        )
                    )
                )
        ) {
            // Filete dourado sutil no topo da prateleira
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.5.dp)
                    .background(palette.goldPrimary.copy(alpha = 0.45f))
            )
        }

        // Sombra projetada abaixo da prateleira
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            palette.woodShelfShadow.copy(alpha = 0.7f),
                            Color.Transparent
                        )
                    )
                )
        )
    }
}

/**
 * Cores ricas para capas geradas quando não há imagem online
 */
private val VintageBookCovers = listOf(
    Color(0xFF2C3E50), // Azul noite
    Color(0xFF4A1521), // Borgonha profundo
    Color(0xFF1E3F20), // Verde floresta clássico
    Color(0xFF5D4037), // Couro marrom
    Color(0xFF423144), // Ameixa escura
    Color(0xFF37474F), // Ardósia
    Color(0xFF6B3A1C)  // Terracota clássico
)

/**
 * Capa de livro com efeito de lombada 3D, sombra e fallback gerado estilizado
 */
@Composable
fun BookCoverView(
    title: String,
    author: String? = null,
    coverUrl: String? = null,
    modifier: Modifier = Modifier,
    width: Dp = 100.dp,
    height: Dp = 150.dp,
    elevation: Dp = 6.dp,
    onClick: (() -> Unit)? = null
) {
    val palette = LocalWoodPalette.current
    val normalizedUrl = remember(coverUrl) {
        coverUrl?.takeIf { it.isNotBlank() }?.let {
            if (it.startsWith("http://")) it.replace("http://", "https://") else it
        }
    }

    val coverBgColor = remember(title) {
        val hash = abs(title.hashCode())
        VintageBookCovers[hash % VintageBookCovers.size]
    }

    val clickModifier = if (onClick != null) {
        Modifier.clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = ripple()
        ) { onClick() }
    } else Modifier

    Surface(
        modifier = modifier
            .width(width)
            .height(height)
            .shadow(elevation, RoundedCornerShape(topStart = 2.dp, topEnd = 6.dp, bottomEnd = 6.dp, bottomStart = 2.dp))
            .clip(RoundedCornerShape(topStart = 2.dp, topEnd = 6.dp, bottomEnd = 6.dp, bottomStart = 2.dp))
            .then(clickModifier)
            .testTag("book_cover_${title.take(10)}"),
        color = coverBgColor
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            if (normalizedUrl != null) {
                AsyncImage(
                    model = normalizedUrl,
                    contentDescription = "Capa do livro $title",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            } else {
                // Capa gerada clássica com ornamentos em dourado
                GeneratedVintageCover(title = title, author = author, bgColor = coverBgColor)
            }

            // Sombra da lombada (spine shadow) no lado esquerdo para efeito 3D de livro real
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(10.dp)
                    .background(
                        brush = Brush.horizontalGradient(
                            colors = listOf(
                                Color.Black.copy(alpha = 0.55f),
                                Color.Black.copy(alpha = 0.15f),
                                Color.Transparent
                            )
                        )
                    )
            )

            // Brilho fino na borda da lombada
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(1.5.dp)
                    .background(Color.White.copy(alpha = 0.25f))
            )
        }
    }
}

@Composable
private fun GeneratedVintageCover(
    title: String,
    author: String?,
    bgColor: Color
) {
    val palette = LocalWoodPalette.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgColor)
            .padding(6.dp)
    ) {
        // Moldura dourada ornamental clássica
        Box(
            modifier = Modifier
                .fillMaxSize()
                .border(1.dp, palette.goldPrimary.copy(alpha = 0.6f), RoundedCornerShape(2.dp))
                .padding(4.dp)
                .border(0.5.dp, palette.goldPrimary.copy(alpha = 0.3f), RoundedCornerShape(2.dp))
                .padding(6.dp)
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                // Título em serifada clássica
                Text(
                    text = title,
                    fontFamily = CormorantFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    lineHeight = 16.sp,
                    color = palette.goldPrimary,
                    textAlign = TextAlign.Center,
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth()
                )

                // Autor na parte inferior
                if (!author.isNullOrBlank()) {
                    Text(
                        text = author,
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Normal,
                        fontSize = 10.sp,
                        lineHeight = 13.sp,
                        color = Color.White.copy(alpha = 0.85f),
                        textAlign = TextAlign.Center,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}

/**
 * Cartão de papel envelhecido (#F3E6CF) com borda de filete e sombra suave
 */
@Composable
fun PaperCard(
    modifier: Modifier = Modifier,
    shape: RoundedCornerShape = RoundedCornerShape(10.dp),
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val palette = LocalWoodPalette.current

    val clickModifier = if (onClick != null) {
        Modifier.clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = ripple()
        ) { onClick() }
    } else Modifier

    Surface(
        modifier = modifier
            .shadow(4.dp, shape)
            .clip(shape)
            .border(1.dp, palette.woodBorder.copy(alpha = 0.35f), shape)
            .then(clickModifier),
        color = palette.paperSurface,
        shape = shape
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            content = content
        )
    }
}

/**
 * Avaliação com 10 estrelas interativas ou visualização (0 a 10)
 */
@Composable
fun StarRatingBar(
    rating: Int?, // 0 a 10, ou null para "Sem nota"
    onRatingChanged: ((Int?) -> Unit)? = null,
    modifier: Modifier = Modifier,
    starSize: Dp = 20.dp,
    isOnWood: Boolean = false,
    showLabel: Boolean = true
) {
    val palette = LocalWoodPalette.current
    val starColor = if (isOnWood) palette.starGold else palette.starWood
    val inactiveColor = if (isOnWood) Color.White.copy(alpha = 0.25f) else Color(0xFFC7B39B)
    val textColor = if (isOnWood) palette.textOnWood else palette.textOnPaper

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 10 estrelas
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            for (i in 1..10) {
                val isFilled = rating != null && rating >= i
                val icon = if (isFilled) Icons.Filled.Star else Icons.Outlined.Star
                val tint = if (isFilled) starColor else inactiveColor

                Icon(
                    imageVector = icon,
                    contentDescription = "Nota $i",
                    tint = tint,
                    modifier = Modifier
                        .size(starSize)
                        .then(
                            if (onRatingChanged != null) {
                                Modifier.clickable(
                                    interactionSource = remember { MutableInteractionSource() },
                                    indication = ripple(bounded = false)
                                ) {
                                    // Se clicar na mesma nota atual, remove (fica sem nota)
                                    if (rating == i) onRatingChanged(null) else onRatingChanged(i)
                                }
                            } else Modifier
                        )
                )
            }
        }

        if (showLabel) {
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (rating != null) "$rating/10" else "Sem nota",
                fontFamily = CormorantFontFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                color = textColor
            )
        }
    }
}

/**
 * TopAppBar no estilo Madeira Escura com título em Cormorant dourado e filete inferior de 3dp
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WoodTopAppBar(
    title: String,
    modifier: Modifier = Modifier,
    navigationIcon: @Composable () -> Unit = {},
    actions: @Composable RowScope.() -> Unit = {}
) {
    val palette = LocalWoodPalette.current

    Column(modifier = modifier.fillMaxWidth()) {
        TopAppBar(
            title = {
                Text(
                    text = title,
                    fontFamily = CormorantFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    color = palette.goldPrimary
                )
            },
            navigationIcon = navigationIcon,
            actions = actions,
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = palette.woodDark,
                titleContentColor = palette.goldPrimary,
                navigationIconContentColor = palette.goldPrimary,
                actionIconContentColor = palette.goldPrimary
            ),
            windowInsets = WindowInsets.statusBars
        )

        // Filete inferior de 3 dp em madeira / latão
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(3.dp)
                .background(
                    brush = Brush.horizontalGradient(
                        colors = listOf(
                            palette.woodBorder,
                            palette.goldPrimary.copy(alpha = 0.8f),
                            palette.woodBorder
                        )
                    )
                )
        )
    }
}
