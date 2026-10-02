package com.example.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.AppDatabase
import com.example.data.model.BookEntity
import com.example.data.model.BookOrigin
import com.example.data.model.BookStatus
import com.example.data.remote.BookSearchRepository
import com.example.data.remote.SearchResultBook
import com.example.data.repository.BookRepository
import com.example.data.repository.EstanteStats
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

enum class ViewMode { CAPAS, LISTA }
enum class GroupByMode { ANO, AUTOR, GENERO }
enum class SortOption { DATA_LEITURA, TITULO, AUTOR, NOTA, DATA_CADASTRO }

data class EstanteUiState(
    val books: List<BookEntity> = emptyList(),
    val filteredBooks: List<BookEntity> = emptyList(),
    val statusTab: BookStatus = BookStatus.LIDO,
    val viewMode: ViewMode = ViewMode.CAPAS,
    val groupBy: GroupByMode = GroupByMode.ANO,
    val sortBy: SortOption = SortOption.DATA_LEITURA,
    val textQuery: String = "",
    val selectedYear: Int? = null,
    val selectedGenre: String? = null,
    val selectedAuthor: String? = null,
    val selectedRatingMin: Int? = null,
    val isLightOak: Boolean = false,
    val stats: EstanteStats = EstanteStats(),
    val isSearchLoading: Boolean = false,
    val searchResults: List<SearchResultBook> = emptyList(),
    val searchError: String? = null,
    val searchInput: String = "",
    val googleApiKey: String = ""
)

class EstanteViewModel(application: Application) : AndroidViewModel(application) {
    private val database = AppDatabase.getDatabase(application)
    private val bookRepository = BookRepository(database.bookDao())
    private val searchRepository = BookSearchRepository()

    private val _uiState = MutableStateFlow(EstanteUiState())
    val uiState: StateFlow<EstanteUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            bookRepository.getAllBooks().collect { allBooks ->
                val stats = bookRepository.computeStats(allBooks)
                _uiState.update { state ->
                    val filtered = applyFilters(allBooks, state)
                    state.copy(
                        books = allBooks,
                        filteredBooks = filtered,
                        stats = stats
                    )
                }
            }
        }
    }

    fun setStatusTab(status: BookStatus) {
        _uiState.update { state ->
            val newState = state.copy(statusTab = status)
            newState.copy(filteredBooks = applyFilters(state.books, newState))
        }
    }

    fun setViewMode(mode: ViewMode) {
        _uiState.update { it.copy(viewMode = mode) }
    }

    fun setGroupBy(groupBy: GroupByMode) {
        _uiState.update { it.copy(groupBy = groupBy) }
    }

    fun setSortBy(sortOption: SortOption) {
        _uiState.update { state ->
            val newState = state.copy(sortBy = sortOption)
            newState.copy(filteredBooks = applyFilters(state.books, newState))
        }
    }

    fun setTextQuery(query: String) {
        _uiState.update { state ->
            val newState = state.copy(textQuery = query)
            newState.copy(filteredBooks = applyFilters(state.books, newState))
        }
    }

    fun setYearFilter(year: Int?) {
        _uiState.update { state ->
            val newState = state.copy(selectedYear = if (state.selectedYear == year) null else year)
            newState.copy(filteredBooks = applyFilters(state.books, newState))
        }
    }

    fun setGenreFilter(genre: String?) {
        _uiState.update { state ->
            val newState = state.copy(selectedGenre = if (state.selectedGenre == genre) null else genre)
            newState.copy(filteredBooks = applyFilters(state.books, newState))
        }
    }

    fun setAuthorFilter(author: String?) {
        _uiState.update { state ->
            val newState = state.copy(selectedAuthor = if (state.selectedAuthor == author) null else author)
            newState.copy(filteredBooks = applyFilters(state.books, newState))
        }
    }

    fun setRatingFilter(ratingMin: Int?) {
        _uiState.update { state ->
            val newState = state.copy(selectedRatingMin = if (state.selectedRatingMin == ratingMin) null else ratingMin)
            newState.copy(filteredBooks = applyFilters(state.books, newState))
        }
    }

    fun clearFilters() {
        _uiState.update { state ->
            val newState = state.copy(
                textQuery = "",
                selectedYear = null,
                selectedGenre = null,
                selectedAuthor = null,
                selectedRatingMin = null
            )
            newState.copy(filteredBooks = applyFilters(state.books, newState))
        }
    }

    fun toggleTheme() {
        _uiState.update { it.copy(isLightOak = !it.isLightOak) }
    }

    fun setGoogleApiKey(key: String) {
        _uiState.update { it.copy(googleApiKey = key) }
    }

    // Online Search
    fun updateSearchInput(query: String) {
        _uiState.update { it.copy(searchInput = query) }
    }

    fun performOnlineSearch(query: String = _uiState.value.searchInput) {
        if (query.isBlank()) return
        viewModelScope.launch {
            _uiState.update { it.copy(isSearchLoading = true, searchError = null) }
            try {
                val results = searchRepository.search(query, _uiState.value.googleApiKey)
                _uiState.update {
                    it.copy(
                        isSearchLoading = false,
                        searchResults = results,
                        searchError = if (results.isEmpty()) "Nenhum livro encontrado para \"$query\"" else null
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSearchLoading = false,
                        searchError = "Erro ao buscar livros na internet. Verifique sua conexão e tente novamente."
                    )
                }
            }
        }
    }

    // Book Management
    fun saveBook(book: BookEntity, onComplete: ((Long) -> Unit)? = null) {
        viewModelScope.launch {
            val id = bookRepository.saveBook(book)
            onComplete?.invoke(id)
        }
    }

    fun updateBook(book: BookEntity) {
        viewModelScope.launch {
            bookRepository.updateBook(book)
        }
    }

    fun deleteBook(book: BookEntity) {
        viewModelScope.launch {
            bookRepository.deleteBook(book)
        }
    }

    fun moveQueroLerToLido(book: BookEntity, rating: Int?, mes: Int?, ano: Int?, observacoes: String?) {
        val updated = book.copy(
            status = BookStatus.LIDO.value,
            nota = rating,
            mesLeitura = mes,
            anoLeitura = ano,
            observacoes = observacoes ?: book.observacoes,
            dataAtualizacao = System.currentTimeMillis()
        )
        updateBook(updated)
    }

    suspend fun checkDuplicate(isbn13: String?, isbn10: String?, title: String): BookEntity? {
        return bookRepository.findPotentialDuplicate(isbn13, isbn10, title)
    }

    suspend fun exportJson(): String {
        return bookRepository.exportJson(_uiState.value.books)
    }

    suspend fun exportCsv(): String {
        return bookRepository.exportCsv(_uiState.value.books)
    }

    suspend fun importJson(json: String): Int {
        return bookRepository.importJson(json)
    }

    suspend fun importCsv(csv: String): Int {
        return bookRepository.importCsv(csv)
    }

    private fun applyFilters(allBooks: List<BookEntity>, state: EstanteUiState): List<BookEntity> {
        var list = allBooks.filter { it.status == state.statusTab.value }

        // Filtro texto
        if (state.textQuery.isNotBlank()) {
            val query = state.textQuery.lowercase().trim()
            list = list.filter { book ->
                book.titulo.lowercase().contains(query) ||
                book.autores.any { it.lowercase().contains(query) } ||
                (book.observacoes?.lowercase()?.contains(query) == true) ||
                (book.descricao?.lowercase()?.contains(query) == true)
            }
        }

        // Filtro Ano
        if (state.selectedYear != null) {
            list = if (state.selectedYear == -1) {
                list.filter { it.anoLeitura == null }
            } else {
                list.filter { it.anoLeitura == state.selectedYear }
            }
        }

        // Filtro Gênero
        if (state.selectedGenre != null) {
            list = list.filter { book -> book.generos.any { it.equals(state.selectedGenre, ignoreCase = true) } }
        }

        // Filtro Autor
        if (state.selectedAuthor != null) {
            list = list.filter { book -> book.autores.any { it.equals(state.selectedAuthor, ignoreCase = true) } }
        }

        // Filtro Nota
        if (state.selectedRatingMin != null) {
            list = list.filter { (it.nota ?: -1) >= state.selectedRatingMin }
        }

        // Ordenação
        list = when (state.sortBy) {
            SortOption.DATA_LEITURA -> list.sortedWith(
                compareByDescending<BookEntity> { it.anoLeitura ?: -1 }
                    .thenByDescending { it.mesLeitura ?: -1 }
                    .thenByDescending { it.dataCadastro }
            )
            SortOption.TITULO -> list.sortedBy { it.titulo.lowercase() }
            SortOption.AUTOR -> list.sortedBy { it.autores.firstOrNull()?.lowercase() ?: "" }
            SortOption.NOTA -> list.sortedByDescending { it.nota ?: -1 }
            SortOption.DATA_CADASTRO -> list.sortedByDescending { it.dataCadastro }
        }

        return list
    }
}
