package com.example.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.repository.EstanteStats
import com.example.ui.components.PaperCard
import com.example.ui.components.StarRatingBar
import com.example.ui.components.WoodBackground
import com.example.ui.components.WoodTopAppBar
import com.example.ui.theme.CormorantFontFamily
import com.example.ui.theme.LocalWoodPalette
import java.util.Calendar

@Composable
fun StatsScreen(
    stats: EstanteStats
) {
    val palette = LocalWoodPalette.current
    val currentYear = Calendar.getInstance().get(Calendar.YEAR)

    WoodBackground {
        Column(modifier = Modifier.fillMaxSize()) {
            WoodTopAppBar(title = "Estatísticas de Leitura")

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Grandes Números em Cormorant Garamond
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    BigNumberCard(
                        title = "Livros Lidos",
                        value = "${stats.totalLidos}",
                        subtitle = "Total registrado",
                        modifier = Modifier.weight(1f)
                    )
                    BigNumberCard(
                        title = "Lidos em $currentYear",
                        value = "${stats.livrosLidosAnoAtual}",
                        subtitle = "Neste ano",
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    BigNumberCard(
                        title = "Páginas Lidas",
                        value = "${stats.totalPaginasLidas}",
                        subtitle = "${stats.paginasLidasAnoAtual} em $currentYear",
                        modifier = Modifier.weight(1f)
                    )
                    BigNumberCard(
                        title = "Nota Média",
                        value = stats.notaMedia?.let { String.format(java.util.Locale.US, "%.1f", it) } ?: "-",
                        subtitle = if (stats.notaMedia != null) "de 10 pontos" else "Sem notas",
                        modifier = Modifier.weight(1f)
                    )
                }

                // Gráfico de Barras: Livros Lidos por Ano
                PaperCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Livros Lidos por Ano",
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = palette.textOnPaper
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    if (stats.lidosPorAno.isEmpty()) {
                        Text(
                            text = "Cadastre livros com data de leitura para ver o gráfico.",
                            fontSize = 14.sp,
                            color = palette.textSecondaryOnPaper,
                            modifier = Modifier.padding(vertical = 20.dp)
                        )
                    } else {
                        BooksPerYearBarChart(
                            data = stats.lidosPorAno,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                        )
                    }
                }

                // Ranking de Autores Mais Lidos
                PaperCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Autores Mais Lidos",
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = palette.textOnPaper
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    if (stats.topAutores.isEmpty()) {
                        Text(
                            text = "Nenhum autor registrado ainda.",
                            fontSize = 14.sp,
                            color = palette.textSecondaryOnPaper
                        )
                    } else {
                        val maxCount = stats.topAutores.maxOfOrNull { it.second } ?: 1
                        stats.topAutores.forEach { (autor, count) ->
                            RankingRow(
                                title = autor,
                                count = count,
                                maxCount = maxCount,
                                label = if (count == 1) "livro" else "livros"
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                }

                // Ranking de Gêneros Mais Lidos
                PaperCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Gêneros Mais Lidos",
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = palette.textOnPaper
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    if (stats.topGeneros.isEmpty()) {
                        Text(
                            text = "Nenhum gênero registrado ainda.",
                            fontSize = 14.sp,
                            color = palette.textSecondaryOnPaper
                        )
                    } else {
                        val maxCount = stats.topGeneros.maxOfOrNull { it.second } ?: 1
                        stats.topGeneros.forEach { (genero, count) ->
                            RankingRow(
                                title = genero,
                                count = count,
                                maxCount = maxCount,
                                label = if (count == 1) "livro" else "livros"
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
fun BigNumberCard(
    title: String,
    value: String,
    subtitle: String,
    modifier: Modifier = Modifier
) {
    val palette = LocalWoodPalette.current

    PaperCard(modifier = modifier) {
        Text(
            text = title,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = palette.textSecondaryOnPaper
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            fontFamily = CormorantFontFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 36.sp,
            color = palette.woodBorder
        )
        Text(
            text = subtitle,
            fontSize = 11.sp,
            color = palette.textSecondaryOnPaper
        )
    }
}

@Composable
fun BooksPerYearBarChart(
    data: Map<Int, Int>,
    modifier: Modifier = Modifier
) {
    val palette = LocalWoodPalette.current

    val entries = data.entries.toList().takeLast(7)
    val maxVal = (entries.maxOfOrNull { it.value } ?: 1).coerceAtLeast(1)

    Canvas(modifier = modifier.padding(vertical = 8.dp)) {
        val totalWidth = size.width
        val chartHeight = size.height - 30.dp.toPx()
        val barCount = entries.size
        val barWidth = (totalWidth / (barCount * 1.6f)).coerceIn(24.dp.toPx(), 44.dp.toPx())
        val spacing = (totalWidth - (barCount * barWidth)) / (barCount + 1)

        val textPaint = android.graphics.Paint().apply {
            color = android.graphics.Color.parseColor("#5C4030")
            textSize = 12.sp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isAntiAlias = true
        }

        val countPaint = android.graphics.Paint().apply {
            color = android.graphics.Color.parseColor("#2E1A0F")
            textSize = 13.sp.toPx()
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            textAlign = android.graphics.Paint.Align.CENTER
            isAntiAlias = true
        }

        entries.forEachIndexed { index, entry ->
            val count = entry.value
            val barHeight = ((count.toFloat() / maxVal) * (chartHeight - 20.dp.toPx())).coerceAtLeast(6.dp.toPx())
            val left = spacing + index * (barWidth + spacing)
            val top = chartHeight - barHeight

            // Desenhar Barra com chanfro dourado/madeira clássico
            drawRoundRect(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        palette.goldPrimary,
                        palette.woodBorder,
                        palette.woodShelf
                    ),
                    startY = top,
                    endY = chartHeight
                ),
                topLeft = Offset(left, top),
                size = Size(barWidth, barHeight),
                cornerRadius = CornerRadius(4.dp.toPx(), 4.dp.toPx())
            )

            // Contagem em cima da barra
            drawIntoCanvas { canvas ->
                canvas.nativeCanvas.drawText(
                    count.toString(),
                    left + barWidth / 2f,
                    top - 6.dp.toPx(),
                    countPaint
                )
            }

            // Rótulo do Ano embaixo da barra
            drawIntoCanvas { canvas ->
                canvas.nativeCanvas.drawText(
                    entry.key.toString(),
                    left + barWidth / 2f,
                    size.height - 4.dp.toPx(),
                    textPaint
                )
            }
        }
    }
}

@Composable
fun RankingRow(
    title: String,
    count: Int,
    maxCount: Int,
    label: String
) {
    val palette = LocalWoodPalette.current
    val fraction = (count.toFloat() / maxCount).coerceIn(0.08f, 1f)

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                fontFamily = CormorantFontFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                color = palette.textOnPaper,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = "$count $label",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = palette.textSecondaryOnPaper
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Barra de progresso customizada estilo madeira dourada
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .background(palette.paperBorder.copy(alpha = 0.5f), RoundedCornerShape(4.dp))
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fraction)
                    .fillMaxHeight()
                    .background(
                        brush = Brush.horizontalGradient(
                            colors = listOf(palette.woodBorder, palette.goldPrimary)
                        ),
                        shape = RoundedCornerShape(4.dp)
                    )
            )
        }
    }
}
