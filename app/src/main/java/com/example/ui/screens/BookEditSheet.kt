package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.BookEntity
import com.example.data.model.BookStatus
import com.example.ui.components.PaperCard
import com.example.ui.components.StarRatingBar
import com.example.ui.theme.CormorantFontFamily
import com.example.ui.theme.LocalWoodPalette
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookEditSheet(
    book: BookEntity,
    onDismiss: () -> Unit,
    onSave: (BookEntity) -> Unit
) {
    val palette = LocalWoodPalette.current
    val currentYear = remember { Calendar.getInstance().get(Calendar.YEAR) }
    val currentMonth = remember { Calendar.getInstance().get(Calendar.MONTH) + 1 }

    var selectedRating by remember { mutableStateOf(book.nota) }
    var anoText by remember { mutableStateOf(book.anoLeitura?.toString() ?: currentYear.toString()) }
    var mesText by remember { mutableStateOf(book.mesLeitura?.toString() ?: currentMonth.toString()) }
    var isSemData by remember { mutableStateOf(book.anoLeitura == null && book.id != 0L) }
    var observations by remember { mutableStateOf(book.observacoes ?: "") }
    var genresList by remember { mutableStateOf(book.generos) }
    var newGenreInput by remember { mutableStateOf("") }
    var status by remember { mutableStateOf(book.statusEnum) }

    val months = listOf(
        1 to "Jan", 2 to "Fev", 3 to "Mar", 4 to "Abr",
        5 to "Mai", 6 to "Jun", 7 to "Jul", 8 to "Ago",
        9 to "Set", 10 to "Out", 11 to "Nov", 12 to "Dez"
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = palette.paperSurface,
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(vertical = 10.dp)
                    .width(40.dp)
                    .height(4.dp)
                    .background(palette.woodBorder.copy(alpha = 0.5f), RoundedCornerShape(2.dp))
            )
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Título do modal
            Text(
                text = if (status == BookStatus.LIDO) "Registro de Leitura" else "Quero Ler",
                fontFamily = CormorantFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 24.sp,
                color = palette.textOnPaper
            )
            Text(
                text = book.titulo,
                fontFamily = CormorantFontFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 17.sp,
                color = palette.textSecondaryOnPaper
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Seletor de Status (Lido ou Quero Ler)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = status == BookStatus.LIDO,
                    onClick = { status = BookStatus.LIDO },
                    label = { Text("Lido") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = palette.goldPrimary,
                        selectedLabelColor = palette.textOnGold,
                        containerColor = Color.Transparent,
                        labelColor = palette.textOnPaper
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = status == BookStatus.LIDO,
                        borderColor = palette.woodBorder
                    ),
                    modifier = Modifier.weight(1f).testTag("status_chip_lido")
                )
                FilterChip(
                    selected = status == BookStatus.QUERO_LER,
                    onClick = { status = BookStatus.QUERO_LER },
                    label = { Text("Quero Ler") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = palette.goldPrimary,
                        selectedLabelColor = palette.textOnGold,
                        containerColor = Color.Transparent,
                        labelColor = palette.textOnPaper
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = status == BookStatus.QUERO_LER,
                        borderColor = palette.woodBorder
                    ),
                    modifier = Modifier.weight(1f).testTag("status_chip_quero_ler")
                )
            }

            if (status == BookStatus.LIDO) {
                Spacer(modifier = Modifier.height(18.dp))

                // Avaliação 0 a 10
                Text(
                    text = "Sua Avaliação (0 a 10):",
                    fontFamily = CormorantFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = palette.textOnPaper
                )
                Spacer(modifier = Modifier.height(6.dp))
                StarRatingBar(
                    rating = selectedRating,
                    onRatingChanged = { selectedRating = it },
                    starSize = 26.dp,
                    isOnWood = false,
                    showLabel = true,
                    modifier = Modifier.testTag("rating_bar_sheet")
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(
                        onClick = { selectedRating = null },
                        modifier = Modifier.testTag("btn_sem_nota")
                    ) {
                        Text("Limpar nota", color = palette.textSecondaryOnPaper, fontSize = 12.sp)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Data de leitura
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Data da Leitura:",
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = palette.textOnPaper
                    )

                    FilterChip(
                        selected = isSemData,
                        onClick = { isSemData = !isSemData },
                        label = { Text("Sem data", fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = palette.goldPrimary,
                            selectedLabelColor = palette.textOnGold,
                            containerColor = Color.Transparent,
                            labelColor = palette.textSecondaryOnPaper
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            enabled = true,
                            selected = isSemData,
                            borderColor = palette.woodBorder
                        ),
                        modifier = Modifier.testTag("chip_sem_data")
                    )
                }

                if (!isSemData) {
                    Spacer(modifier = Modifier.height(10.dp))

                    val mesNumero = mesText.toIntOrNull()
                    val nomeMesExtenso = when (mesNumero) {
                        1 -> "Janeiro"; 2 -> "Fevereiro"; 3 -> "Março"; 4 -> "Abril"
                        5 -> "Maio"; 6 -> "Junho"; 7 -> "Julho"; 8 -> "Agosto"
                        9 -> "Setembro"; 10 -> "Outubro"; 11 -> "Novembro"; 12 -> "Dezembro"
                        else -> null
                    }

                    // Campos de Texto para Digitar Ano e Mês Livremente
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedTextField(
                            value = anoText,
                            onValueChange = { novo ->
                                anoText = novo.filter { it.isDigit() }.take(4)
                            },
                            label = { Text("Ano da leitura") },
                            placeholder = { Text("Ex: 2024, 2018, 1995") },
                            supportingText = { Text("Digite qualquer ano", fontSize = 11.sp) },
                            singleLine = true,
                            modifier = Modifier.weight(1.2f).testTag("input_ano_leitura"),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = palette.woodBorder,
                                unfocusedBorderColor = palette.woodBorder.copy(alpha = 0.5f),
                                focusedContainerColor = palette.paperSurfaceElevated,
                                unfocusedContainerColor = palette.paperSurfaceElevated
                            )
                        )

                        OutlinedTextField(
                            value = mesText,
                            onValueChange = { novo ->
                                val clean = novo.filter { it.isDigit() }.take(2)
                                mesText = clean
                            },
                            label = { Text("Mês (1 a 12)") },
                            placeholder = { Text("1 a 12") },
                            supportingText = {
                                Text(nomeMesExtenso ?: "Opcional", fontSize = 11.sp, color = palette.woodBorder)
                            },
                            singleLine = true,
                            modifier = Modifier.weight(1f).testTag("input_mes_leitura"),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = palette.woodBorder,
                                unfocusedBorderColor = palette.woodBorder.copy(alpha = 0.5f),
                                focusedContainerColor = palette.paperSurfaceElevated,
                                unfocusedContainerColor = palette.paperSurfaceElevated
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    // Atalhos Rápidos para Facilitar (Ano atual, ano anterior, e meses rápidos)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        SuggestionChip(
                            onClick = { anoText = currentYear.toString() },
                            label = { Text("$currentYear (Atual)", fontSize = 11.sp) },
                            colors = SuggestionChipDefaults.suggestionChipColors(
                                labelColor = palette.textOnPaper
                            ),
                            border = SuggestionChipDefaults.suggestionChipBorder(
                                enabled = true,
                                borderColor = palette.woodBorder.copy(alpha = 0.4f)
                            )
                        )
                        SuggestionChip(
                            onClick = { anoText = (currentYear - 1).toString() },
                            label = { Text("${currentYear - 1}", fontSize = 11.sp) },
                            colors = SuggestionChipDefaults.suggestionChipColors(
                                labelColor = palette.textOnPaper
                            ),
                            border = SuggestionChipDefaults.suggestionChipBorder(
                                enabled = true,
                                borderColor = palette.woodBorder.copy(alpha = 0.4f)
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    // Seletor rápido de meses (opcional caso o usuário queira clicar ao invés de digitar)
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            months.take(6).forEach { (mNum, mName) ->
                                val isSelected = mesText == mNum.toString()
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { mesText = if (isSelected) "" else mNum.toString() },
                                    label = { Text(mName, fontSize = 11.sp) },
                                    modifier = Modifier.weight(1f),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = palette.goldPrimary,
                                        selectedLabelColor = palette.textOnGold,
                                        containerColor = Color.Transparent,
                                        labelColor = palette.textOnPaper
                                    ),
                                    border = FilterChipDefaults.filterChipBorder(
                                        enabled = true,
                                        selected = isSelected,
                                        borderColor = palette.woodBorder
                                    )
                                )
                            }
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            months.drop(6).forEach { (mNum, mName) ->
                                val isSelected = mesText == mNum.toString()
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { mesText = if (isSelected) "" else mNum.toString() },
                                    label = { Text(mName, fontSize = 11.sp) },
                                    modifier = Modifier.weight(1f),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = palette.goldPrimary,
                                        selectedLabelColor = palette.textOnGold,
                                        containerColor = Color.Transparent,
                                        labelColor = palette.textOnPaper
                                    ),
                                    border = FilterChipDefaults.filterChipBorder(
                                        enabled = true,
                                        selected = isSelected,
                                        borderColor = palette.woodBorder
                                    )
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Gêneros editáveis
            Text(
                text = "Gêneros:",
                fontFamily = CormorantFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = palette.textOnPaper
            )
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = newGenreInput,
                    onValueChange = { newGenreInput = it },
                    placeholder = { Text("Novo gênero...", fontSize = 13.sp) },
                    modifier = Modifier.weight(1f).testTag("input_novo_genero"),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = palette.woodBorder,
                        unfocusedBorderColor = palette.woodBorder.copy(alpha = 0.5f),
                        focusedContainerColor = palette.paperSurfaceElevated,
                        unfocusedContainerColor = palette.paperSurfaceElevated
                    )
                )
                IconButton(
                    onClick = {
                        val trimmed = newGenreInput.trim()
                        if (trimmed.isNotBlank() && !genresList.contains(trimmed)) {
                            genresList = genresList + trimmed
                            newGenreInput = ""
                        }
                    },
                    modifier = Modifier
                        .background(palette.woodBorder, RoundedCornerShape(8.dp))
                        .testTag("btn_adicionar_genero")
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Adicionar gênero", tint = Color.White)
                }
            }

            if (genresList.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    genresList.forEach { gen ->
                        InputChip(
                            selected = false,
                            onClick = { genresList = genresList - gen },
                            label = { Text(gen, fontSize = 12.sp) },
                            trailingIcon = {
                                Icon(Icons.Default.Close, contentDescription = "Remover", modifier = Modifier.size(14.dp))
                            },
                            colors = InputChipDefaults.inputChipColors(
                                containerColor = palette.paperSurfaceElevated,
                                labelColor = palette.textOnPaper
                            ),
                            border = InputChipDefaults.inputChipBorder(
                                enabled = true,
                                selected = false,
                                borderColor = palette.woodBorder.copy(alpha = 0.4f)
                            )
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Observações
            Text(
                text = "Observações pessoais:",
                fontFamily = CormorantFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = palette.textOnPaper
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = observations,
                onValueChange = { observations = it },
                placeholder = { Text("Citações favoritas, impressões ou onde leu...", fontSize = 13.sp) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(90.dp)
                    .testTag("input_observacoes"),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = palette.woodBorder,
                    unfocusedBorderColor = palette.woodBorder.copy(alpha = 0.5f),
                    focusedContainerColor = palette.paperSurfaceElevated,
                    unfocusedContainerColor = palette.paperSurfaceElevated
                )
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Botões de Ação
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f).height(48.dp).testTag("btn_cancelar_sheet"),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = palette.textOnPaper
                    ),
                    border = ButtonDefaults.outlinedButtonBorder.copy(
                        brush = androidx.compose.ui.graphics.SolidColor(palette.woodBorder)
                    )
                ) {
                    Text("Cancelar", fontFamily = CormorantFontFamily, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }

                Button(
                    onClick = {
                        val parsedAno = if (isSemData) null else anoText.toIntOrNull()
                        val parsedMes = if (isSemData) null else mesText.toIntOrNull()?.coerceIn(1, 12)
                        val finalBook = book.copy(
                            status = status.value,
                            nota = if (status == BookStatus.LIDO) selectedRating else null,
                            anoLeitura = if (status == BookStatus.LIDO) parsedAno else null,
                            mesLeitura = if (status == BookStatus.LIDO) parsedMes else null,
                            generos = genresList,
                            observacoes = observations.ifBlank { null }
                        )
                        onSave(finalBook)
                    },
                    modifier = Modifier.weight(1f).height(48.dp).testTag("btn_salvar_sheet"),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = palette.goldPrimary,
                        contentColor = palette.textOnGold
                    )
                ) {
                    Text("Salvar na estante", fontFamily = CormorantFontFamily, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }

            Spacer(modifier = Modifier.height(28.dp))
        }
    }
}
