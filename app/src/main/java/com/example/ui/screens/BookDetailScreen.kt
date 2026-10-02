package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
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
import com.example.ui.components.*
import com.example.ui.theme.CormorantFontFamily
import com.example.ui.theme.LocalWoodPalette

@Composable
fun BookDetailScreen(
    book: BookEntity,
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onToggleStatus: () -> Unit
) {
    BackHandler { onBack() }
    val palette = LocalWoodPalette.current
    var isDescExpanded by remember { mutableStateOf(false) }
    var showDeleteConfirmDialog by remember { mutableStateOf(false) }

    if (showDeleteConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmDialog = false },
            containerColor = palette.paperSurface,
            title = {
                Text(
                    text = "Remover Livro",
                    fontFamily = CormorantFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp,
                    color = palette.textOnPaper
                )
            },
            text = {
                Text(
                    text = "Tem certeza que deseja remover \"${book.titulo}\" da sua estante?",
                    color = palette.textOnPaper,
                    fontSize = 15.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteConfirmDialog = false
                        onDelete()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = palette.woodBorder)
                ) {
                    Text("Excluir", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmDialog = false }) {
                    Text("Cancelar", color = palette.textSecondaryOnPaper)
                }
            }
        )
    }

    WoodBackground {
        Column(modifier = Modifier.fillMaxSize()) {
            WoodTopAppBar(
                title = "Detalhes da Obra",
                navigationIcon = {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier.testTag("btn_voltar_detalhes")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Voltar",
                            tint = palette.goldPrimary
                        )
                    }
                },
                actions = {
                    IconButton(
                        onClick = onEdit,
                        modifier = Modifier.testTag("btn_editar_detalhes")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "Editar",
                            tint = palette.goldPrimary
                        )
                    }
                    IconButton(
                        onClick = { showDeleteConfirmDialog = true },
                        modifier = Modifier.testTag("btn_excluir_detalhes")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Excluir",
                            tint = palette.goldPrimary
                        )
                    }
                }
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = 32.dp)
            ) {
                // Seção da Capa sobre Prateleira de Madeira
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 20.dp),
                    contentAlignment = Alignment.BottomCenter
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        BookCoverView(
                            title = book.titulo,
                            author = book.autoresFormatados,
                            coverUrl = book.capaUrl,
                            width = 160.dp,
                            height = 240.dp,
                            elevation = 12.dp
                        )

                        Spacer(modifier = Modifier.height(2.dp))

                        // Prateleira de madeira 3D onde a capa repousa
                        WoodShelf(
                            height = 18.dp,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Cartão Papel Envelhecido com Informações Completas
                PaperCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                ) {
                    // Título e Subtítulo
                    Text(
                        text = book.titulo,
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 26.sp,
                        lineHeight = 30.sp,
                        color = palette.textOnPaper
                    )
                    if (!book.subtitulo.isNullOrBlank()) {
                        Text(
                            text = book.subtitulo,
                            fontFamily = CormorantFontFamily,
                            fontWeight = FontWeight.Medium,
                            fontSize = 18.sp,
                            color = palette.textSecondaryOnPaper
                        )
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = book.autoresFormatados,
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 17.sp,
                        color = palette.woodBorder
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Avaliação e Status
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        if (book.statusEnum == BookStatus.LIDO) {
                            Column {
                                Text(
                                    text = "Avaliação:",
                                    fontSize = 12.sp,
                                    color = palette.textSecondaryOnPaper
                                )
                                StarRatingBar(
                                    rating = book.nota,
                                    starSize = 18.dp,
                                    isOnWood = false,
                                    showLabel = true
                                )
                            }

                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "Lido em:",
                                    fontSize = 12.sp,
                                    color = palette.textSecondaryOnPaper
                                )
                                Text(
                                    text = book.dataLeituraFormatada,
                                    fontFamily = CormorantFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                    color = palette.textOnPaper
                                )
                            }
                        } else {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = palette.woodBorder.copy(alpha = 0.2f),
                                border = androidx.compose.foundation.BorderStroke(1.dp, palette.woodBorder)
                            ) {
                                Text(
                                    text = "Na lista: Quero Ler",
                                    fontFamily = CormorantFontFamily,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 14.sp,
                                    color = palette.textOnPaper,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Metadados (Páginas, Editora, Ano, ISBN)
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(palette.paperSurfaceElevated, RoundedCornerShape(8.dp))
                            .border(1.dp, palette.paperBorder, RoundedCornerShape(8.dp))
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (book.paginas != null && book.paginas > 0) {
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text("Páginas:", fontSize = 13.sp, color = palette.textSecondaryOnPaper)
                                Text("${book.paginas} páginas", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = palette.textOnPaper)
                            }
                        }
                        if (!book.editora.isNullOrBlank()) {
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text("Editora:", fontSize = 13.sp, color = palette.textSecondaryOnPaper)
                                Text(book.editora, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = palette.textOnPaper)
                            }
                        }
                        if (book.anoPublicacao != null) {
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text("Ano de Publicação:", fontSize = 13.sp, color = palette.textSecondaryOnPaper)
                                Text("${book.anoPublicacao}", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = palette.textOnPaper)
                            }
                        }
                        val isbn = book.isbn13 ?: book.isbn10
                        if (!isbn.isNullOrBlank()) {
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text("ISBN:", fontSize = 13.sp, color = palette.textSecondaryOnPaper)
                                Text(isbn, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = palette.textOnPaper)
                            }
                        }
                        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                            Text("Origem dos dados:", fontSize = 13.sp, color = palette.textSecondaryOnPaper)
                            Text(book.origemEnum.label, fontWeight = FontWeight.Medium, fontSize = 13.sp, color = palette.textOnPaper)
                        }
                    }

                    // Gêneros (Chips)
                    if (book.generos.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = "Gêneros:",
                            fontFamily = CormorantFontFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = palette.textOnPaper
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            book.generos.forEach { gen ->
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = palette.paperSurfaceElevated,
                                    border = androidx.compose.foundation.BorderStroke(1.dp, palette.woodBorder.copy(alpha = 0.5f))
                                ) {
                                    Text(
                                        text = gen,
                                        fontSize = 12.sp,
                                        color = palette.textOnPaper,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }
                    }

                    // Observações Pessoais
                    if (!book.observacoes.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = "Suas Observações:",
                            fontFamily = CormorantFontFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = palette.textOnPaper
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = book.observacoes,
                            fontSize = 14.sp,
                            color = palette.textOnPaper,
                            lineHeight = 20.sp,
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(palette.paperSurfaceElevated, RoundedCornerShape(6.dp))
                                .padding(8.dp)
                        )
                    }

                    // Descrição / Sinopse
                    if (!book.descricao.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(14.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { isDescExpanded = !isDescExpanded },
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Sinopse:",
                                fontFamily = CormorantFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = palette.textOnPaper
                            )
                            Icon(
                                imageVector = if (isDescExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                contentDescription = if (isDescExpanded) "Recolher" else "Expandir",
                                tint = palette.woodBorder
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = book.descricao,
                            fontSize = 14.sp,
                            color = palette.textOnPaper,
                            lineHeight = 20.sp,
                            maxLines = if (isDescExpanded) Int.MAX_VALUE else 3
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Botões de Ação na Estante
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (book.statusEnum == BookStatus.QUERO_LER) {
                        Button(
                            onClick = onEdit,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                                .testTag("btn_marcar_como_lido"),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = palette.goldPrimary,
                                contentColor = palette.textOnGold
                            )
                        ) {
                            Text(
                                text = "Marcar como lido",
                                fontFamily = CormorantFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp
                            )
                        }
                    } else {
                        Button(
                            onClick = onEdit,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                                .testTag("btn_editar_leitura"),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = palette.goldPrimary,
                                contentColor = palette.textOnGold
                            )
                        ) {
                            Text(
                                text = "Editar leitura & nota",
                                fontFamily = CormorantFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp
                            )
                        }

                        OutlinedButton(
                            onClick = onToggleStatus,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp)
                                .testTag("btn_mover_quero_ler"),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = palette.goldPrimary
                            ),
                            border = androidx.compose.foundation.BorderStroke(1.dp, palette.goldPrimary)
                        ) {
                            Text(
                                text = "Mover para Quero Ler",
                                fontFamily = CormorantFontFamily,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 16.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
