package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.BookEntity
import com.example.data.model.BookOrigin
import com.example.data.model.BookStatus
import com.example.data.remote.SearchResultBook
import com.example.ui.components.*
import com.example.ui.theme.CormorantFontFamily
import com.example.ui.theme.LocalWoodPalette

@Composable
fun SearchScreen(
    searchQuery: String,
    onQueryChange: (String) -> Unit,
    onSearch: (String) -> Unit,
    isLoading: Boolean,
    results: List<SearchResultBook>,
    errorMessage: String?,
    onSelectBookToAdd: (SearchResultBook) -> Unit,
    onOpenManualRegister: () -> Unit
) {
    val palette = LocalWoodPalette.current

    WoodBackground {
        Column(modifier = Modifier.fillMaxSize()) {
            WoodTopAppBar(title = "Buscar Livros")

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp)
            ) {
                Spacer(modifier = Modifier.height(12.dp))

                // Campo de Busca em Papel Envelhecido
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = onQueryChange,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("input_busca_online"),
                    placeholder = {
                        Text(
                            text = "Digite título, autor ou ISBN...",
                            fontSize = 14.sp,
                            color = palette.textSecondaryOnPaper
                        )
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Buscar",
                            tint = palette.woodBorder
                        )
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { onQueryChange("") }) {
                                Icon(
                                    imageVector = Icons.Default.Clear,
                                    contentDescription = "Limpar",
                                    tint = palette.woodBorder
                                )
                            }
                        }
                    },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { onSearch(searchQuery) }),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = palette.goldPrimary,
                        unfocusedBorderColor = palette.woodBorder,
                        focusedContainerColor = palette.paperSurface,
                        unfocusedContainerColor = palette.paperSurface,
                        focusedTextColor = palette.textOnPaper,
                        unfocusedTextColor = palette.textOnPaper
                    )
                )

                // Botão "Buscar" e atalho de ISBN
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Busca simultânea no Google Books e Open Library",
                        fontSize = 11.sp,
                        color = palette.textSecondaryOnWood,
                        modifier = Modifier.weight(1f)
                    )

                    Button(
                        onClick = { onSearch(searchQuery) },
                        modifier = Modifier.testTag("btn_executar_busca"),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = palette.goldPrimary,
                            contentColor = palette.textOnGold
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Buscar", fontFamily = CormorantFontFamily, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Estado de Loading
                if (isLoading) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(top = 40.dp),
                        contentAlignment = Alignment.TopCenter
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = palette.goldPrimary)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Consultando os arquivos da biblioteca...",
                                fontFamily = CormorantFontFamily,
                                fontSize = 18.sp,
                                color = palette.textOnWood
                            )
                        }
                    }
                } else if (errorMessage != null && results.isEmpty()) {
                    // Mensagem de Erro ou Não Encontrado
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        PaperCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(
                                    imageVector = Icons.Default.MenuBook,
                                    contentDescription = null,
                                    tint = palette.woodBorder,
                                    modifier = Modifier.size(48.dp)
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Text(
                                    text = errorMessage,
                                    fontFamily = CormorantFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp,
                                    color = palette.textOnPaper
                                )
                                Spacer(modifier = Modifier.height(14.dp))
                                Button(
                                    onClick = onOpenManualRegister,
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = palette.goldPrimary,
                                        contentColor = palette.textOnGold
                                    ),
                                    modifier = Modifier.testTag("btn_cadastrar_manual_quando_vazio")
                                ) {
                                    Icon(Icons.Default.Add, contentDescription = null)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        "Cadastrar manualmente",
                                        fontFamily = CormorantFontFamily,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                } else if (results.isEmpty() && searchQuery.isBlank()) {
                    // Estado Inicial
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.MenuBook,
                                contentDescription = null,
                                tint = palette.goldPrimary.copy(alpha = 0.7f),
                                modifier = Modifier.size(64.dp)
                            )
                            Text(
                                text = "Encontre qualquer livro por título, autor ou código ISBN",
                                fontFamily = CormorantFontFamily,
                                fontSize = 18.sp,
                                color = palette.textOnWood
                            )
                            WoodShelf(modifier = Modifier.fillMaxWidth())
                            Button(
                                onClick = onOpenManualRegister,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = palette.goldPrimary,
                                    contentColor = palette.textOnGold
                                ),
                                modifier = Modifier.testTag("btn_cadastrar_manual_inicial")
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    "Ou cadastre um livro manualmente",
                                    fontFamily = CormorantFontFamily,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                } else {
                    // Lista de Resultados
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(top = 8.dp, bottom = 24.dp)
                    ) {
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "${results.size} livros encontrados",
                                    fontFamily = CormorantFontFamily,
                                    fontSize = 16.sp,
                                    color = palette.textSecondaryOnWood
                                )
                                TextButton(onClick = onOpenManualRegister) {
                                    Text("+ Cadastro manual", color = palette.goldPrimary, fontSize = 13.sp)
                                }
                            }
                        }

                        items(results) { item ->
                            SearchResultCard(
                                book = item,
                                onClick = { onSelectBookToAdd(item) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SearchResultCard(
    book: SearchResultBook,
    onClick: () -> Unit
) {
    val palette = LocalWoodPalette.current

    PaperCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            BookCoverView(
                title = book.titulo,
                author = book.autoresFormatados,
                coverUrl = book.capaUrl,
                width = 70.dp,
                height = 105.dp,
                elevation = 4.dp
            )

            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    // Selo de Origem (Google Books ou Open Library)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = palette.woodBorder.copy(alpha = 0.2f),
                            border = androidx.compose.foundation.BorderStroke(0.5.dp, palette.woodBorder)
                        ) {
                            Text(
                                text = book.origem.label,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = palette.woodBorder,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }

                        if (book.anoPublicacao != null) {
                            Text(
                                text = "${book.anoPublicacao}",
                                fontFamily = CormorantFontFamily,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                                color = palette.textSecondaryOnPaper
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = book.titulo,
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                        lineHeight = 20.sp,
                        color = palette.textOnPaper,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )

                    if (!book.subtitulo.isNullOrBlank()) {
                        Text(
                            text = book.subtitulo,
                            fontFamily = CormorantFontFamily,
                            fontSize = 13.sp,
                            color = palette.textSecondaryOnPaper,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Text(
                        text = book.autoresFormatados,
                        fontFamily = CormorantFontFamily,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = palette.woodBorder,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (book.paginas != null && book.paginas > 0) {
                        Text(
                            text = "${book.paginas} págs",
                            fontSize = 11.sp,
                            color = palette.textSecondaryOnPaper
                        )
                    } else {
                        Spacer(modifier = Modifier.width(4.dp))
                    }

                    Text(
                        text = "Toque para adicionar →",
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = palette.woodBorder
                    )
                }
            }
        }
    }
}
