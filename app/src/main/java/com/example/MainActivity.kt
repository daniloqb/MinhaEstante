package com.example

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.model.BookEntity
import com.example.data.model.BookOrigin
import com.example.data.model.BookStatus
import com.example.data.remote.SearchResultBook
import com.example.ui.components.WoodShelf
import com.example.ui.screens.*
import com.example.ui.theme.CormorantFontFamily
import com.example.ui.theme.LocalWoodPalette
import com.example.ui.theme.MinhaEstanteTheme
import com.example.ui.viewmodel.EstanteViewModel
import kotlinx.coroutines.launch

enum class MainTab {
    ESTANTE, BUSCAR, ESTATISTICAS, CONFIG
}

class MainActivity : ComponentActivity() {
    private val viewModel: EstanteViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val uiState by viewModel.uiState.collectAsStateWithLifecycle()

            MinhaEstanteTheme(useLightOak = uiState.isLightOak) {
                MainAppContent(
                    viewModel = viewModel
                )
            }
        }
    }
}

@Composable
fun MainAppContent(
    viewModel: EstanteViewModel
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val palette = LocalWoodPalette.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var currentTab by remember { mutableStateOf(MainTab.ESTANTE) }
    var selectedBookDetail by remember { mutableStateOf<BookEntity?>(null) }
    var isManualRegisterOpen by remember { mutableStateOf(false) }
    var bookBeingEditedInSheet by remember { mutableStateOf<BookEntity?>(null) }
    var duplicateConflict by remember { mutableStateOf<Pair<SearchResultBook, BookEntity>?>(null) }

    // Diálogo quando o livro já existe na estante ao tentar adicionar
    if (duplicateConflict != null) {
        val (newBook, existingBook) = duplicateConflict!!
        AlertDialog(
            onDismissRequest = { duplicateConflict = null },
            containerColor = palette.paperSurface,
            title = {
                Text(
                    text = "Livro já cadastrado!",
                    fontFamily = CormorantFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = palette.textOnPaper
                )
            },
            text = {
                Text(
                    text = "\"${existingBook.titulo}\" já consta na sua estante (${existingBook.statusEnum.label}). Deseja abrir a obra existente ou cadastrar como nova?",
                    color = palette.textOnPaper,
                    fontSize = 14.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val book = existingBook
                        duplicateConflict = null
                        selectedBookDetail = book
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = palette.goldPrimary,
                        contentColor = palette.textOnGold
                    )
                ) {
                    Text("Abrir Existente")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        val toAdd = newBook.toBookEntity(BookStatus.LIDO)
                        duplicateConflict = null
                        bookBeingEditedInSheet = toAdd
                    }
                ) {
                    Text("Adicionar mesmo assim", color = palette.textSecondaryOnPaper)
                }
            }
        )
    }

    // Modal Bottom Sheet para Adicionar/Editar detalhes da Leitura
    if (bookBeingEditedInSheet != null) {
        BookEditSheet(
            book = bookBeingEditedInSheet!!,
            onDismiss = { bookBeingEditedInSheet = null },
            onSave = { updatedBook ->
                viewModel.saveBook(updatedBook) { id ->
                    Toast.makeText(context, "Livro salvo na estante!", Toast.LENGTH_SHORT).show()
                }
                bookBeingEditedInSheet = null
                // Se estávamos visualizando os detalhes, atualiza
                if (selectedBookDetail?.id == updatedBook.id) {
                    selectedBookDetail = updatedBook
                }
            }
        )
    }

    // Telas de Nível Superior (Detalhes ou Cadastro Manual)
    when {
        selectedBookDetail != null -> {
            BookDetailScreen(
                book = selectedBookDetail!!,
                onBack = { selectedBookDetail = null },
                onEdit = {
                    bookBeingEditedInSheet = selectedBookDetail
                },
                onDelete = {
                    val toDelete = selectedBookDetail!!
                    viewModel.deleteBook(toDelete)
                    selectedBookDetail = null
                    Toast.makeText(context, "Livro removido da estante", Toast.LENGTH_SHORT).show()
                },
                onToggleStatus = {
                    val current = selectedBookDetail!!
                    val newStatus = if (current.statusEnum == BookStatus.LIDO) BookStatus.QUERO_LER else BookStatus.LIDO
                    val updated = current.copy(status = newStatus.value, dataAtualizacao = System.currentTimeMillis())
                    viewModel.updateBook(updated)
                    selectedBookDetail = updated
                    Toast.makeText(context, "Movido para ${newStatus.label}!", Toast.LENGTH_SHORT).show()
                }
            )
        }
        isManualRegisterOpen -> {
            ManualBookScreen(
                onBack = { isManualRegisterOpen = false },
                onSave = { newBook ->
                    viewModel.saveBook(newBook) {
                        Toast.makeText(context, "Livro adicionado com sucesso!", Toast.LENGTH_SHORT).show()
                    }
                    isManualRegisterOpen = false
                }
            )
        }
        else -> {
            // Scaffold com NavigationBar inferior no tema Madeira Escura
            Scaffold(
                containerColor = palette.woodMedium,
                bottomBar = {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        // Filete de madeira clara sobre a barra de navegação
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(2.dp)
                                .background(palette.woodBorder)
                        )

                        NavigationBar(
                            containerColor = palette.woodDark,
                            tonalElevation = 0.dp,
                            windowInsets = WindowInsets.navigationBars
                        ) {
                            NavigationBarItem(
                                selected = currentTab == MainTab.ESTANTE,
                                onClick = { currentTab = MainTab.ESTANTE },
                                icon = {
                                    Icon(
                                        imageVector = Icons.Default.AutoStories,
                                        contentDescription = "Estante"
                                    )
                                },
                                label = {
                                    Text(
                                        text = "Estante",
                                        fontFamily = CormorantFontFamily,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = palette.textOnGold,
                                    selectedTextColor = palette.goldPrimary,
                                    indicatorColor = palette.goldPrimary,
                                    unselectedIconColor = palette.textSecondaryOnWood,
                                    unselectedTextColor = palette.textSecondaryOnWood
                                ),
                                modifier = Modifier.testTag("nav_estante")
                            )

                            NavigationBarItem(
                                selected = currentTab == MainTab.BUSCAR,
                                onClick = { currentTab = MainTab.BUSCAR },
                                icon = {
                                    Icon(
                                        imageVector = Icons.Default.Search,
                                        contentDescription = "Buscar"
                                    )
                                },
                                label = {
                                    Text(
                                        text = "Buscar",
                                        fontFamily = CormorantFontFamily,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = palette.textOnGold,
                                    selectedTextColor = palette.goldPrimary,
                                    indicatorColor = palette.goldPrimary,
                                    unselectedIconColor = palette.textSecondaryOnWood,
                                    unselectedTextColor = palette.textSecondaryOnWood
                                ),
                                modifier = Modifier.testTag("nav_buscar")
                            )

                            NavigationBarItem(
                                selected = currentTab == MainTab.ESTATISTICAS,
                                onClick = { currentTab = MainTab.ESTATISTICAS },
                                icon = {
                                    Icon(
                                        imageVector = Icons.Default.BarChart,
                                        contentDescription = "Estatísticas"
                                    )
                                },
                                label = {
                                    Text(
                                        text = "Estatísticas",
                                        fontFamily = CormorantFontFamily,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = palette.textOnGold,
                                    selectedTextColor = palette.goldPrimary,
                                    indicatorColor = palette.goldPrimary,
                                    unselectedIconColor = palette.textSecondaryOnWood,
                                    unselectedTextColor = palette.textSecondaryOnWood
                                ),
                                modifier = Modifier.testTag("nav_estatisticas")
                            )

                            NavigationBarItem(
                                selected = currentTab == MainTab.CONFIG,
                                onClick = { currentTab = MainTab.CONFIG },
                                icon = {
                                    Icon(
                                        imageVector = Icons.Default.Settings,
                                        contentDescription = "Configurações"
                                    )
                                },
                                label = {
                                    Text(
                                        text = "Backup",
                                        fontFamily = CormorantFontFamily,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = palette.textOnGold,
                                    selectedTextColor = palette.goldPrimary,
                                    indicatorColor = palette.goldPrimary,
                                    unselectedIconColor = palette.textSecondaryOnWood,
                                    unselectedTextColor = palette.textSecondaryOnWood
                                ),
                                modifier = Modifier.testTag("nav_config")
                            )
                        }
                    }
                }
            ) { innerPadding ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                ) {
                    when (currentTab) {
                        MainTab.ESTANTE -> {
                            EstanteMainScreen(
                                books = uiState.filteredBooks,
                                statusTab = uiState.statusTab,
                                onStatusTabChange = viewModel::setStatusTab,
                                viewMode = uiState.viewMode,
                                onViewModeChange = viewModel::setViewMode,
                                groupBy = uiState.groupBy,
                                onGroupByChange = viewModel::setGroupBy,
                                searchQuery = uiState.textQuery,
                                onSearchQueryChange = viewModel::setTextQuery,
                                selectedYear = uiState.selectedYear,
                                onYearFilterChange = viewModel::setYearFilter,
                                selectedGenre = uiState.selectedGenre,
                                onGenreFilterChange = viewModel::setGenreFilter,
                                selectedRatingMin = uiState.selectedRatingMin,
                                onRatingFilterChange = viewModel::setRatingFilter,
                                sortOption = uiState.sortBy,
                                onSortChange = viewModel::setSortBy,
                                onClearFilters = viewModel::clearFilters,
                                onSelectBook = { selectedBookDetail = it },
                                onEditBook = { bookBeingEditedInSheet = it },
                                onDeleteBook = { viewModel.deleteBook(it) },
                                onMoveBookStatus = { book ->
                                    val nextStatus = if (book.statusEnum == BookStatus.LIDO) BookStatus.QUERO_LER else BookStatus.LIDO
                                    viewModel.updateBook(book.copy(status = nextStatus.value))
                                    Toast.makeText(context, "Movido para ${nextStatus.label}!", Toast.LENGTH_SHORT).show()
                                },
                                onAddBookClick = { currentTab = MainTab.BUSCAR }
                            )
                        }
                        MainTab.BUSCAR -> {
                            SearchScreen(
                                searchQuery = uiState.searchInput,
                                onQueryChange = viewModel::updateSearchInput,
                                onSearch = { viewModel.performOnlineSearch(it) },
                                isLoading = uiState.isSearchLoading,
                                results = uiState.searchResults,
                                errorMessage = uiState.searchError,
                                onSelectBookToAdd = { searchBook ->
                                    scope.launch {
                                        val existing = viewModel.checkDuplicate(
                                            searchBook.isbn13,
                                            searchBook.isbn10,
                                            searchBook.titulo
                                        )
                                        if (existing != null) {
                                            duplicateConflict = searchBook to existing
                                        } else {
                                            bookBeingEditedInSheet = searchBook.toBookEntity(BookStatus.LIDO)
                                        }
                                    }
                                },
                                onOpenManualRegister = { isManualRegisterOpen = true }
                            )
                        }
                        MainTab.ESTATISTICAS -> {
                            StatsScreen(
                                stats = uiState.stats
                            )
                        }
                        MainTab.CONFIG -> {
                            SettingsBackupScreen(
                                currentViewMode = uiState.viewMode,
                                onViewModeChange = viewModel::setViewMode,
                                currentGroupBy = uiState.groupBy,
                                onGroupByChange = viewModel::setGroupBy,
                                isLightOak = uiState.isLightOak,
                                onToggleTheme = viewModel::toggleTheme,
                                apiKey = uiState.googleApiKey,
                                onApiKeyChange = viewModel::setGoogleApiKey,
                                onExportCsv = { viewModel.exportCsv() },
                                onExportJson = { viewModel.exportJson() },
                                onImportCsv = { viewModel.importCsv(it) },
                                onImportJson = { viewModel.importJson(it) }
                            )
                        }
                    }
                }
            }
        }
    }
}
