package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
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
import com.example.data.model.BookOrigin
import com.example.data.model.BookStatus
import com.example.ui.components.*
import com.example.ui.theme.CormorantFontFamily
import com.example.ui.theme.LocalWoodPalette
import java.util.Calendar

@Composable
fun ManualBookScreen(
    initialBook: BookEntity? = null,
    onBack: () -> Unit,
    onSave: (BookEntity) -> Unit
) {
    BackHandler { onBack() }
    val palette = LocalWoodPalette.current
    val currentYear = remember { Calendar.getInstance().get(Calendar.YEAR) }
    val currentMonth = remember { Calendar.getInstance().get(Calendar.MONTH) + 1 }

    var titulo by remember { mutableStateOf(initialBook?.titulo ?: "") }
    var subtitulo by remember { mutableStateOf(initialBook?.subtitulo ?: "") }
    var autoresStr by remember { mutableStateOf(initialBook?.autores?.joinToString(", ") ?: "") }
    var editora by remember { mutableStateOf(initialBook?.editora ?: "") }
    var anoPublicacaoStr by remember { mutableStateOf(initialBook?.anoPublicacao?.toString() ?: "") }
    var paginasStr by remember { mutableStateOf(initialBook?.paginas?.toString() ?: "") }
    var isbnStr by remember { mutableStateOf(initialBook?.isbn13 ?: initialBook?.isbn10 ?: "") }
    var generosStr by remember { mutableStateOf(initialBook?.generos?.joinToString(", ") ?: "") }
    var descricao by remember { mutableStateOf(initialBook?.descricao ?: "") }
    var capaUrl by remember { mutableStateOf(initialBook?.capaUrl ?: "") }

    var status by remember { mutableStateOf(initialBook?.statusEnum ?: BookStatus.LIDO) }
    var selectedRating by remember { mutableStateOf(initialBook?.nota) }
    var isSemData by remember { mutableStateOf(initialBook?.anoLeitura == null && initialBook != null) }
    var anoLeituraStr by remember { mutableStateOf(initialBook?.anoLeitura?.toString() ?: currentYear.toString()) }
    var mesLeituraStr by remember { mutableStateOf(initialBook?.mesLeitura?.toString() ?: currentMonth.toString()) }
    var observacoes by remember { mutableStateOf(initialBook?.observacoes ?: "") }

    var tituloError by remember { mutableStateOf(false) }

    WoodBackground {
        Column(modifier = Modifier.fillMaxSize()) {
            WoodTopAppBar(
                title = if (initialBook == null) "Cadastrar Livro" else "Editar Livro",
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("btn_voltar_manual")) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Voltar",
                            tint = palette.goldPrimary
                        )
                    }
                },
                actions = {
                    IconButton(
                        onClick = {
                            if (titulo.isBlank()) {
                                tituloError = true
                            } else {
                                val autoresList = autoresStr.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                                val generosList = generosStr.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                                val finalBook = (initialBook ?: BookEntity(
                                    titulo = titulo.trim(),
                                    origem = BookOrigin.MANUAL.value
                                )).copy(
                                    titulo = titulo.trim(),
                                    subtitulo = subtitulo.ifBlank { null },
                                    autores = autoresList,
                                    editora = editora.ifBlank { null },
                                    anoPublicacao = anoPublicacaoStr.toIntOrNull(),
                                    paginas = paginasStr.toIntOrNull(),
                                    isbn13 = if (isbnStr.length >= 13) isbnStr.trim() else null,
                                    isbn10 = if (isbnStr.length < 13 && isbnStr.isNotBlank()) isbnStr.trim() else null,
                                    generos = generosList,
                                    descricao = descricao.ifBlank { null },
                                    capaUrl = capaUrl.ifBlank { null },
                                    status = status.value,
                                    nota = if (status == BookStatus.LIDO) selectedRating else null,
                                    anoLeitura = if (status == BookStatus.LIDO && !isSemData) anoLeituraStr.toIntOrNull() else null,
                                    mesLeitura = if (status == BookStatus.LIDO && !isSemData) mesLeituraStr.toIntOrNull()?.coerceIn(1, 12) else null,
                                    observacoes = observacoes.ifBlank { null },
                                    dataAtualizacao = System.currentTimeMillis()
                                )
                                onSave(finalBook)
                            }
                        },
                        modifier = Modifier.testTag("btn_salvar_manual_topo")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Salvar",
                            tint = palette.goldPrimary
                        )
                    }
                }
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Pré-visualização da Capa em Tempo Real
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        BookCoverView(
                            title = if (titulo.isNotBlank()) titulo else "Título da Obra",
                            author = if (autoresStr.isNotBlank()) autoresStr else "Autor do Livro",
                            coverUrl = capaUrl.ifBlank { null },
                            width = 110.dp,
                            height = 165.dp,
                            elevation = 8.dp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Pré-visualização da capa",
                            fontSize = 11.sp,
                            color = palette.textSecondaryOnWood
                        )
                    }
                }

                // Formulário em Cartão Papel Envelhecido
                PaperCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Dados Bibliográficos",
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = palette.textOnPaper
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Título (Obrigatório)
                    OutlinedTextField(
                        value = titulo,
                        onValueChange = {
                            titulo = it
                            if (it.isNotBlank()) tituloError = false
                        },
                        label = { Text("Título da obra *") },
                        isError = tituloError,
                        supportingText = {
                            if (tituloError) Text("O título é obrigatório", color = palette.woodBorder)
                        },
                        modifier = Modifier.fillMaxWidth().testTag("input_titulo"),
                        colors = outlinedFieldColors(palette)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = subtitulo,
                        onValueChange = { subtitulo = it },
                        label = { Text("Subtítulo (opcional)") },
                        modifier = Modifier.fillMaxWidth().testTag("input_subtitulo"),
                        colors = outlinedFieldColors(palette)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = autoresStr,
                        onValueChange = { autoresStr = it },
                        label = { Text("Autor(es) (separados por vírgula)") },
                        placeholder = { Text("Ex: Machado de Assis, José de Alencar") },
                        modifier = Modifier.fillMaxWidth().testTag("input_autores"),
                        colors = outlinedFieldColors(palette)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = editora,
                            onValueChange = { editora = it },
                            label = { Text("Editora") },
                            modifier = Modifier.weight(1.2f).testTag("input_editora"),
                            colors = outlinedFieldColors(palette)
                        )
                        OutlinedTextField(
                            value = anoPublicacaoStr,
                            onValueChange = { anoPublicacaoStr = it.filter { c -> c.isDigit() } },
                            label = { Text("Ano") },
                            placeholder = { Text("2024") },
                            modifier = Modifier.weight(0.8f).testTag("input_ano_pub"),
                            colors = outlinedFieldColors(palette)
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = paginasStr,
                            onValueChange = { paginasStr = it.filter { c -> c.isDigit() } },
                            label = { Text("Páginas") },
                            placeholder = { Text("Ex: 320") },
                            modifier = Modifier.weight(1f).testTag("input_paginas"),
                            colors = outlinedFieldColors(palette)
                        )
                        OutlinedTextField(
                            value = isbnStr,
                            onValueChange = { isbnStr = it },
                            label = { Text("ISBN (10 ou 13)") },
                            modifier = Modifier.weight(1f).testTag("input_isbn"),
                            colors = outlinedFieldColors(palette)
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = generosStr,
                        onValueChange = { generosStr = it },
                        label = { Text("Gêneros (separados por vírgula)") },
                        placeholder = { Text("Ficção, Clássico, Filosofia") },
                        modifier = Modifier.fillMaxWidth().testTag("input_generos"),
                        colors = outlinedFieldColors(palette)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = capaUrl,
                        onValueChange = { capaUrl = it },
                        label = { Text("URL da Capa (opcional)") },
                        placeholder = { Text("https://...") },
                        modifier = Modifier.fillMaxWidth().testTag("input_capa_url"),
                        colors = outlinedFieldColors(palette)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = descricao,
                        onValueChange = { descricao = it },
                        label = { Text("Sinopse / Descrição") },
                        modifier = Modifier.fillMaxWidth().height(100.dp).testTag("input_descricao"),
                        colors = outlinedFieldColors(palette)
                    )
                }

                // Cartão de Estado e Leitura
                PaperCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Status na Estante",
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = palette.textOnPaper
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FilterChip(
                            selected = status == BookStatus.LIDO,
                            onClick = { status = BookStatus.LIDO },
                            label = { Text("Lido") },
                            modifier = Modifier.weight(1f),
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
                            )
                        )
                        FilterChip(
                            selected = status == BookStatus.QUERO_LER,
                            onClick = { status = BookStatus.QUERO_LER },
                            label = { Text("Quero Ler") },
                            modifier = Modifier.weight(1f),
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
                            )
                        )
                    }

                    if (status == BookStatus.LIDO) {
                        Spacer(modifier = Modifier.height(14.dp))

                        Text(
                            text = "Avaliação:",
                            fontFamily = CormorantFontFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                            color = palette.textOnPaper
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        StarRatingBar(
                            rating = selectedRating,
                            onRatingChanged = { selectedRating = it },
                            starSize = 24.dp
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Data de Leitura:",
                                fontFamily = CormorantFontFamily,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 16.sp,
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
                                )
                            )
                        }

                        if (!isSemData) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedTextField(
                                    value = anoLeituraStr,
                                    onValueChange = { anoLeituraStr = it.filter { c -> c.isDigit() }.take(4) },
                                    label = { Text("Ano de Leitura") },
                                    placeholder = { Text("Ex: 2024, 2015, 1980") },
                                    supportingText = { Text("Qualquer ano sem limites", fontSize = 11.sp) },
                                    modifier = Modifier.weight(1.2f),
                                    colors = outlinedFieldColors(palette)
                                )
                                OutlinedTextField(
                                    value = mesLeituraStr,
                                    onValueChange = { mesLeituraStr = it.filter { c -> c.isDigit() }.take(2) },
                                    label = { Text("Mês (1-12)") },
                                    placeholder = { Text("1 a 12") },
                                    supportingText = { Text("Opcional (1 a 12)", fontSize = 11.sp) },
                                    modifier = Modifier.weight(1f),
                                    colors = outlinedFieldColors(palette)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = observacoes,
                        onValueChange = { observacoes = it },
                        label = { Text("Observações pessoais") },
                        placeholder = { Text("Anotações, impressões...") },
                        modifier = Modifier.fillMaxWidth().height(80.dp).testTag("input_manual_obs"),
                        colors = outlinedFieldColors(palette)
                    )
                }

                // Botão Salvar Principal
                Button(
                    onClick = {
                        if (titulo.isBlank()) {
                            tituloError = true
                        } else {
                            val autoresList = autoresStr.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                            val generosList = generosStr.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                            val finalBook = (initialBook ?: BookEntity(
                                titulo = titulo.trim(),
                                origem = BookOrigin.MANUAL.value
                            )).copy(
                                titulo = titulo.trim(),
                                subtitulo = subtitulo.ifBlank { null },
                                autores = autoresList,
                                editora = editora.ifBlank { null },
                                anoPublicacao = anoPublicacaoStr.toIntOrNull(),
                                paginas = paginasStr.toIntOrNull(),
                                isbn13 = if (isbnStr.length >= 13) isbnStr.trim() else null,
                                isbn10 = if (isbnStr.length < 13 && isbnStr.isNotBlank()) isbnStr.trim() else null,
                                generos = generosList,
                                descricao = descricao.ifBlank { null },
                                capaUrl = capaUrl.ifBlank { null },
                                status = status.value,
                                nota = if (status == BookStatus.LIDO) selectedRating else null,
                                anoLeitura = if (status == BookStatus.LIDO && !isSemData) anoLeituraStr.toIntOrNull() else null,
                                mesLeitura = if (status == BookStatus.LIDO && !isSemData) mesLeituraStr.toIntOrNull()?.coerceIn(1, 12) else null,
                                observacoes = observacoes.ifBlank { null },
                                dataAtualizacao = System.currentTimeMillis()
                            )
                            onSave(finalBook)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .testTag("btn_salvar_manual_base"),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = palette.goldPrimary,
                        contentColor = palette.textOnGold
                    )
                ) {
                    Text(
                        text = "Salvar na Estante",
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun outlinedFieldColors(palette: com.example.ui.theme.WoodPalette) =
    OutlinedTextFieldDefaults.colors(
        focusedBorderColor = palette.woodBorder,
        unfocusedBorderColor = palette.woodBorder.copy(alpha = 0.5f),
        focusedContainerColor = palette.paperSurfaceElevated,
        unfocusedContainerColor = palette.paperSurfaceElevated,
        focusedLabelColor = palette.woodBorder,
        unfocusedLabelColor = palette.textSecondaryOnPaper
    )
