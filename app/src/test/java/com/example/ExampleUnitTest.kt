package com.example

import com.example.data.model.BookEntity
import com.example.data.model.BookOrigin
import com.example.data.model.BookStatus
import com.example.data.repository.BookRepository
import org.junit.Assert.*
import org.junit.Test

class ExampleUnitTest {
    @Test
    fun testStatsComputation() {
        val books = listOf(
            BookEntity(
                id = 1,
                titulo = "Livro 1",
                autores = listOf("Autor A"),
                status = BookStatus.LIDO.value,
                paginas = 200,
                anoLeitura = 2026,
                mesLeitura = 3,
                nota = 9,
                generos = listOf("Ficção")
            ),
            BookEntity(
                id = 2,
                titulo = "Livro 2",
                autores = listOf("Autor A", "Autor B"),
                status = BookStatus.LIDO.value,
                paginas = 300,
                anoLeitura = 2026,
                mesLeitura = 5,
                nota = 10,
                generos = listOf("Ficção", "Clássico")
            ),
            BookEntity(
                id = 3,
                titulo = "Livro 3",
                autores = listOf("Autor C"),
                status = BookStatus.QUERO_LER.value,
                paginas = 150
            )
        )

        // Mock dao is not needed for computeStats
        val repo = BookRepository(object : com.example.data.local.BookDao {
            override fun getAllBooks() = kotlinx.coroutines.flow.emptyFlow<List<BookEntity>>()
            override fun getBooksByStatus(status: String) = kotlinx.coroutines.flow.emptyFlow<List<BookEntity>>()
            override fun getBookById(id: Long) = kotlinx.coroutines.flow.emptyFlow<BookEntity?>()
            override suspend fun getBookByIdOnce(id: Long): BookEntity? = null
            override suspend fun findPotentialDuplicate(isbn13: String?, isbn10: String?, title: String): BookEntity? = null
            override suspend fun insertBook(book: BookEntity) = 1L
            override suspend fun insertAll(books: List<BookEntity>) = listOf(1L)
            override suspend fun updateBook(book: BookEntity) {}
            override suspend fun deleteBook(book: BookEntity) {}
            override suspend fun deleteBookById(id: Long) {}
            override suspend fun deleteAll() {}
        })

        val stats = repo.computeStats(books)
        assertEquals(2, stats.totalLidos)
        assertEquals(1, stats.totalQueroLer)
        assertEquals(500, stats.totalPaginasLidas)
        assertEquals(9.5f, stats.notaMedia ?: 0f, 0.01f)
        assertEquals(2, stats.lidosPorAno[2026])
        assertEquals("Autor A", stats.topAutores.first().first)
        assertEquals(2, stats.topAutores.first().second)
    }

    @Test
    fun testBookEntityHelpers() {
        val book = BookEntity(
            titulo = "Capitães da Areia",
            autores = listOf("Jorge Amado"),
            anoLeitura = 2026,
            mesLeitura = 1,
            origem = BookOrigin.GOOGLE.value
        )
        assertEquals("Jorge Amado", book.autoresFormatados)
        assertEquals("Jan/2026", book.dataLeituraFormatada)
        assertEquals(BookOrigin.GOOGLE, book.origemEnum)
    }
}
