package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.BookEntity
import com.example.data.model.BookStatus
import com.example.ui.components.*
import com.example.ui.theme.CormorantFontFamily
import com.example.ui.theme.LocalWoodPalette
import com.example.ui.viewmodel.GroupByMode
import com.example.ui.viewmodel.SortOption
import com.example.ui.viewmodel.ViewMode
import kotlin.math.abs

@Composable
fun EstanteMainScreen(
    books: List<BookEntity>,
    statusTab: BookStatus,
    onStatusTabChange: (BookStatus) -> Unit,
    viewMode: ViewMode,
    onViewModeChange: (ViewMode) -> Unit,
    groupBy: GroupByMode,
    onGroupByChange: (GroupByMode) -> Unit,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    selectedYear: Int?,
    onYearFilterChange: (Int?) -> Unit,
    selectedGenre: String?,
    onGenreFilterChange: (String?) -> Unit,
    selectedRatingMin: Int?,
    onRatingFilterChange: (Int?) -> Unit,
    sortOption: SortOption,
    onSortChange: (SortOption) -> Unit,
    onClearFilters: () -> Unit,
    onSelectBook: (BookEntity) -> Unit,
    onEditBook: (BookEntity) -> Unit,
    onDeleteBook: (BookEntity) -> Unit,
    onMoveBookStatus: (BookEntity) -> Unit,
    onAddBookClick: () -> Unit
) {
    val palette = LocalWoodPalette.current
    var isSearchExpanded by remember { mutableStateOf(false) }
    var selectedBookForAction by remember { mutableStateOf<BookEntity?>(null) }
    var showFilterSheet by remember { mutableStateOf(false) }

    // Quick Action Dialog ao clicar longo
    if (selectedBookForAction != null) {
        val targetBook = selectedBookForAction!!
        AlertDialog(
            onDismissRequest = { selectedBookForAction = null },
            containerColor = palette.paperSurface,
            title = {
                Text(
                    text = targetBook.titulo,
                    fontFamily = CormorantFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = palette.textOnPaper
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Escolha uma ação para esta obra:", color = palette.textSecondaryOnPaper, fontSize = 14.sp)
                }
            },
            confirmButton = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Button(
                        onClick = {
                            val b = targetBook
                            selectedBookForAction = null
                            onSelectBook(b)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = palette.goldPrimary, contentColor = palette.textOnGold),
                        modifier = Modifier.fillMaxWidth().testTag("btn_quick_ver_detalhes")
                    ) {
                        Text("Ver Detalhes", fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = {
                            val b = targetBook
                            selectedBookForAction = null
                            onEditBook(b)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = palette.woodBorder, contentColor = Color.White),
                        modifier = Modifier.fillMaxWidth().testTag("btn_quick_editar")
                    ) {
                        Text("Editar Leitura")
                    }

                    OutlinedButton(
                        onClick = {
                            val b = targetBook
                            selectedBookForAction = null
                            onMoveBookStatus(b)
                        },
                        modifier = Modifier.fillMaxWidth().testTag("btn_quick_mover"),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = palette.textOnPaper),
                        border = androidx.compose.foundation.BorderStroke(1.dp, palette.woodBorder)
                    ) {
                        Text(if (targetBook.statusEnum == BookStatus.LIDO) "Mover para Quero Ler" else "Marcar como Lido")
                    }

                    TextButton(
                        onClick = {
                            val b = targetBook
                            selectedBookForAction = null
                            onDeleteBook(b)
                        },
                        modifier = Modifier.fillMaxWidth().testTag("btn_quick_excluir")
                    ) {
                        Text("Excluir da Estante", color = Color(0xFFC0392B))
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedBookForAction = null }) {
                    Text("Cancelar", color = palette.textSecondaryOnPaper)
                }
            }
        )
    }

    // Modal de Filtros Completos
    if (showFilterSheet) {
        AlertDialog(
            onDismissRequest = { showFilterSheet = false },
            containerColor = palette.paperSurface,
            title = {
                Text(
                    text = "Filtrar Estante",
                    fontFamily = CormorantFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp,
                    color = palette.textOnPaper
                )
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Agrupamento:", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = palette.textOnPaper)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        GroupByMode.entries.forEach { mode ->
                            FilterChip(
                                selected = groupBy == mode,
                                onClick = { onGroupByChange(mode) },
                                label = { Text(mode.name.lowercase().replaceFirstChar { it.uppercase() }) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = palette.goldPrimary,
                                    selectedLabelColor = palette.textOnGold
                                )
                            )
                        }
                    }

                    Text("Ordenação:", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = palette.textOnPaper)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(
                            selected = sortOption == SortOption.DATA_LEITURA,
                            onClick = { onSortChange(SortOption.DATA_LEITURA) },
                            label = { Text("Data") },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = palette.woodBorder, selectedLabelColor = Color.White)
                        )
                        FilterChip(
                            selected = sortOption == SortOption.TITULO,
                            onClick = { onSortChange(SortOption.TITULO) },
                            label = { Text("Título") },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = palette.woodBorder, selectedLabelColor = Color.White)
                        )
                        FilterChip(
                            selected = sortOption == SortOption.NOTA,
                            onClick = { onSortChange(SortOption.NOTA) },
                            label = { Text("Nota") },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = palette.woodBorder, selectedLabelColor = Color.White)
                        )
                    }

                    Text("Nota Mínima:", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = palette.textOnPaper)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf(null to "Todas", 7 to "★ 7+", 8 to "★ 8+", 9 to "★ 9+", 10 to "★ 10").forEach { (min, lbl) ->
                            FilterChip(
                                selected = selectedRatingMin == min,
                                onClick = { onRatingFilterChange(min) },
                                label = { Text(lbl) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = palette.goldPrimary,
                                    selectedLabelColor = palette.textOnGold
                                )
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { showFilterSheet = false },
                    colors = ButtonDefaults.buttonColors(containerColor = palette.goldPrimary, contentColor = palette.textOnGold)
                ) {
                    Text("Aplicar")
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    onClearFilters()
                    showFilterSheet = false
                }) {
                    Text("Limpar Filtros", color = palette.textSecondaryOnPaper)
                }
            }
        )
    }

    WoodBackground {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                WoodTopAppBar(
                    title = "Minha Estante",
                    actions = {
                        IconButton(
                            onClick = { isSearchExpanded = !isSearchExpanded },
                            modifier = Modifier.testTag("btn_abrir_busca_interna")
                        ) {
                            Icon(
                                imageVector = if (isSearchExpanded) Icons.Default.Close else Icons.Default.Search,
                                contentDescription = "Pesquisar na estante",
                                tint = palette.goldPrimary
                            )
                        }
                        IconButton(
                            onClick = { showFilterSheet = true },
                            modifier = Modifier.testTag("btn_abrir_filtros")
                        ) {
                            Icon(
                                imageVector = Icons.Default.FilterList,
                                contentDescription = "Filtros",
                                tint = palette.goldPrimary
                            )
                        }
                    }
                )
            },
            floatingActionButton = {
                FloatingActionButton(
                    onClick = onAddBookClick,
                    containerColor = palette.goldPrimary,
                    contentColor = palette.textOnGold,
                    shape = RoundedCornerShape(16.dp),
                    elevation = FloatingActionButtonDefaults.elevation(8.dp),
                    modifier = Modifier.testTag("fab_adicionar_livro")
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Adicionar livro",
                        modifier = Modifier.size(28.dp)
                    )
                }
            }
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                // Barra de Busca Interna Animada
                AnimatedVisibility(visible = isSearchExpanded) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(palette.woodDark)
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = onSearchQueryChange,
                            placeholder = { Text("Pesquisar título, autor ou notas...", fontSize = 13.sp) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().testTag("input_busca_interna"),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = palette.goldPrimary,
                                unfocusedBorderColor = palette.woodBorder,
                                focusedContainerColor = palette.paperSurface,
                                unfocusedContainerColor = palette.paperSurface,
                                focusedTextColor = palette.textOnPaper,
                                unfocusedTextColor = palette.textOnPaper
                            )
                        )
                    }
                }

                // Barra de Controles: "Lidos | Quero Ler" e "Capas | Lista"
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(palette.woodDark.copy(alpha = 0.6f))
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // SegmentedButton: Lidos | Quero ler
                    Row(
                        modifier = Modifier
                            .background(palette.woodDark, RoundedCornerShape(8.dp))
                            .border(1.dp, palette.woodBorder.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                            .padding(2.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .background(
                                    if (statusTab == BookStatus.LIDO) palette.goldPrimary else Color.Transparent,
                                    RoundedCornerShape(6.dp)
                                )
                                .clickable { onStatusTabChange(BookStatus.LIDO) }
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                                .testTag("tab_lidos")
                        ) {
                            Text(
                                text = "Lidos",
                                fontFamily = CormorantFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = if (statusTab == BookStatus.LIDO) palette.textOnGold else palette.textOnWood
                            )
                        }

                        Box(
                            modifier = Modifier
                                .background(
                                    if (statusTab == BookStatus.QUERO_LER) palette.goldPrimary else Color.Transparent,
                                    RoundedCornerShape(6.dp)
                                )
                                .clickable { onStatusTabChange(BookStatus.QUERO_LER) }
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                                .testTag("tab_quero_ler")
                        ) {
                            Text(
                                text = "Quero Ler",
                                fontFamily = CormorantFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = if (statusTab == BookStatus.QUERO_LER) palette.textOnGold else palette.textOnWood
                            )
                        }
                    }

                    // Botão Alternar Modo Capas / Lista
                    Row(
                        modifier = Modifier
                            .background(palette.woodDark, RoundedCornerShape(8.dp))
                            .border(1.dp, palette.woodBorder.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                            .padding(2.dp)
                    ) {
                        IconButton(
                            onClick = { onViewModeChange(ViewMode.CAPAS) },
                            modifier = Modifier.size(32.dp).testTag("btn_modo_capas")
                        ) {
                            Icon(
                                imageVector = Icons.Default.ViewAgenda,
                                contentDescription = "Modo Capas",
                                tint = if (viewMode == ViewMode.CAPAS) palette.goldPrimary else palette.textSecondaryOnWood
                            )
                        }
                        IconButton(
                            onClick = { onViewModeChange(ViewMode.LISTA) },
                            modifier = Modifier.size(32.dp).testTag("btn_modo_lista")
                        ) {
                            Icon(
                                imageVector = Icons.Default.ViewList,
                                contentDescription = "Modo Lista",
                                tint = if (viewMode == ViewMode.LISTA) palette.goldPrimary else palette.textSecondaryOnWood
                            )
                        }
                    }
                }

                // Filtros Rápidos Ativos
                if (selectedYear != null || selectedGenre != null || selectedRatingMin != null || searchQuery.isNotBlank()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Filtros:", fontSize = 11.sp, color = palette.textSecondaryOnWood)

                        if (selectedYear != null) {
                            AssistChip(
                                onClick = { onYearFilterChange(null) },
                                label = { Text(if (selectedYear == -1) "Sem data" else "$selectedYear", fontSize = 11.sp) },
                                trailingIcon = { Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(12.dp)) },
                                colors = AssistChipDefaults.assistChipColors(labelColor = palette.goldPrimary)
                            )
                        }

                        if (selectedGenre != null) {
                            AssistChip(
                                onClick = { onGenreFilterChange(null) },
                                label = { Text(selectedGenre, fontSize = 11.sp) },
                                trailingIcon = { Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(12.dp)) },
                                colors = AssistChipDefaults.assistChipColors(labelColor = palette.goldPrimary)
                            )
                        }

                        if (selectedRatingMin != null) {
                            AssistChip(
                                onClick = { onRatingFilterChange(null) },
                                label = { Text("★ $selectedRatingMin+", fontSize = 11.sp) },
                                trailingIcon = { Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(12.dp)) },
                                colors = AssistChipDefaults.assistChipColors(labelColor = palette.goldPrimary)
                            )
                        }

                        TextButton(onClick = onClearFilters) {
                            Text("Limpar", fontSize = 11.sp, color = palette.goldPrimary)
                        }
                    }
                }

                // Conteúdo Principal da Estante
                if (books.isEmpty()) {
                    EmptyShelfView(
                        statusTab = statusTab,
                        onAddBookClick = onAddBookClick
                    )
                } else if (viewMode == ViewMode.CAPAS) {
                    ShelvesGroupedView(
                        books = books,
                        groupBy = groupBy,
                        onSelectBook = onSelectBook,
                        onLongClickBook = { selectedBookForAction = it }
                    )
                } else {
                    BooksListView(
                        books = books,
                        onSelectBook = onSelectBook,
                        onLongClickBook = { selectedBookForAction = it }
                    )
                }
            }
        }
    }
}

/**
 * Visualização das Prateleiras Clássicas de Madeira em Modo "Capas"
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ShelvesGroupedView(
    books: List<BookEntity>,
    groupBy: GroupByMode,
    onSelectBook: (BookEntity) -> Unit,
    onLongClickBook: (BookEntity) -> Unit
) {
    val groups = remember(books, groupBy) {
        when (groupBy) {
            GroupByMode.ANO -> {
                val map = books.groupBy { it.anoLeitura }
                // Ordenar anos decrescentes, com 'Sem data' (null) no final
                map.entries.sortedWith(
                    compareByDescending<Map.Entry<Int?, List<BookEntity>>> { it.key ?: -1 }
                )
            }
            GroupByMode.AUTOR -> {
                val map = mutableMapOf<String, MutableList<BookEntity>>()
                books.forEach { book ->
                    val author = book.autores.firstOrNull() ?: "Autor desconhecido"
                    map.getOrPut(author) { mutableListOf() }.add(book)
                }
                map.entries.sortedBy { it.key }
            }
            GroupByMode.GENERO -> {
                val map = mutableMapOf<String, MutableList<BookEntity>>()
                books.forEach { book ->
                    val genre = book.generos.firstOrNull() ?: "Geral"
                    map.getOrPut(genre) { mutableListOf() }.add(book)
                }
                map.entries.sortedBy { it.key }
            }
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(top = 8.dp, bottom = 80.dp)
    ) {
        items(groups) { entry ->
            val label = when (groupBy) {
                GroupByMode.ANO -> if (entry.key == null) "Sem data de leitura" else "${entry.key}"
                else -> "${entry.key}"
            }
            val count = entry.value.size
            val sublabel = if (count == 1) "1 livro" else "$count livros"

            ShelfSection(
                shelfLabel = label,
                shelfSublabel = sublabel,
                books = entry.value,
                onSelectBook = onSelectBook,
                onLongClickBook = onLongClickBook
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ShelfSection(
    shelfLabel: String,
    shelfSublabel: String,
    books: List<BookEntity>,
    onSelectBook: (BookEntity) -> Unit,
    onLongClickBook: (BookEntity) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
        // Livros em pé sobre a prateleira com rolagem horizontal
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            books.forEach { book ->
                // Altura orgânica ligeiramente variável (142dp a 166dp) baseada no hash
                val dynamicHeight = remember(book.id, book.titulo) {
                    val variation = (abs(book.titulo.hashCode()) % 5) * 6
                    (142 + variation).dp
                }

                Box(
                    modifier = Modifier
                        .combinedClickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = ripple(),
                            onClick = { onSelectBook(book) },
                            onLongClick = { onLongClickBook(book) }
                        )
                ) {
                    BookCoverView(
                        title = book.titulo,
                        author = book.autoresFormatados,
                        coverUrl = book.capaUrl,
                        width = 100.dp,
                        height = dynamicHeight,
                        elevation = 6.dp
                    )
                }
            }
        }

        // Prateleira de madeira sob os livros com cabeçalho
        WoodShelf(
            height = 16.dp,
            label = shelfLabel,
            sublabel = shelfSublabel
        )
    }
}

/**
 * Visualização da Estante em Modo "Lista" (Cartões em Papel Envelhecido)
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun BooksListView(
    books: List<BookEntity>,
    onSelectBook: (BookEntity) -> Unit,
    onLongClickBook: (BookEntity) -> Unit
) {
    val palette = LocalWoodPalette.current

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(books, key = { it.id }) { book ->
            PaperCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .combinedClickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = ripple(),
                        onClick = { onSelectBook(book) },
                        onLongClick = { onLongClickBook(book) }
                    )
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Mini Capa
                    BookCoverView(
                        title = book.titulo,
                        author = book.autoresFormatados,
                        coverUrl = book.capaUrl,
                        width = 54.dp,
                        height = 80.dp,
                        elevation = 3.dp
                    )

                    // Informações
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
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

                        Text(
                            text = "${book.autoresFormatados} · ${book.generosFormatados}",
                            fontSize = 12.sp,
                            color = palette.textSecondaryOnPaper,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )

                        Spacer(modifier = Modifier.height(2.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            if (book.statusEnum == BookStatus.LIDO) {
                                StarRatingBar(
                                    rating = book.nota,
                                    starSize = 14.dp,
                                    isOnWood = false,
                                    showLabel = true
                                )
                                Text(
                                    text = book.dataLeituraFormatada,
                                    fontFamily = CormorantFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = palette.woodBorder
                                )
                            } else {
                                Text(
                                    text = "Quero Ler",
                                    fontFamily = CormorantFontFamily,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.sp,
                                    color = palette.woodBorder
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Estado Vazio Charmoso com Prateleira de Madeira Clássica
 */
@Composable
fun EmptyShelfView(
    statusTab: BookStatus,
    onAddBookClick: () -> Unit
) {
    val palette = LocalWoodPalette.current

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
                tint = palette.goldPrimary.copy(alpha = 0.6f),
                modifier = Modifier.size(72.dp)
            )

            Text(
                text = if (statusTab == BookStatus.LIDO)
                    "Sua estante de livros lidos está aguardando as primeiras obras."
                else
                    "Sua lista de interesse está vazia. Adicione livros que planeja ler.",
                fontFamily = CormorantFontFamily,
                fontWeight = FontWeight.Medium,
                fontSize = 18.sp,
                lineHeight = 24.sp,
                color = palette.textOnWood,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )

            WoodShelf(modifier = Modifier.fillMaxWidth())

            Button(
                onClick = onAddBookClick,
                colors = ButtonDefaults.buttonColors(
                    containerColor = palette.goldPrimary,
                    contentColor = palette.textOnGold
                ),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.testTag("btn_adicionar_primeiro_livro")
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Adicionar meu primeiro livro",
                    fontFamily = CormorantFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }
        }
    }
}
