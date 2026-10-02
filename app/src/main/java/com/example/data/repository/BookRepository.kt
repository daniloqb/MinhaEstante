package com.example.data.repository

import com.example.data.local.BookDao
import com.example.data.model.BookEntity
import com.example.data.model.BookOrigin
import com.example.data.model.BookStatus
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.StringReader
import java.util.Calendar

data class EstanteStats(
    val totalLidos: Int = 0,
    val totalQueroLer: Int = 0,
    val totalPaginasLidas: Int = 0,
    val paginasLidasAnoAtual: Int = 0,
    val livrosLidosAnoAtual: Int = 0,
    val notaMedia: Float? = null,
    val lidosPorAno: Map<Int, Int> = emptyMap(), // Ano -> Quantidade
    val topAutores: List<Pair<String, Int>> = emptyList(),
    val topGeneros: List<Pair<String, Int>> = emptyList()
)

class BookRepository(private val bookDao: BookDao) {
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val listType = Types.newParameterizedType(List::class.java, BookEntity::class.java)
    private val jsonAdapter = moshi.adapter<List<BookEntity>>(listType)

    fun getAllBooks(): Flow<List<BookEntity>> = bookDao.getAllBooks()

    fun getBooksByStatus(status: BookStatus): Flow<List<BookEntity>> =
        bookDao.getBooksByStatus(status.value)

    fun getBookById(id: Long): Flow<BookEntity?> = bookDao.getBookById(id)

    suspend fun getBookByIdOnce(id: Long): BookEntity? = bookDao.getBookByIdOnce(id)

    suspend fun saveBook(book: BookEntity): Long = withContext(Dispatchers.IO) {
        val updated = book.copy(dataAtualizacao = System.currentTimeMillis())
        bookDao.insertBook(updated)
    }

    suspend fun updateBook(book: BookEntity) = withContext(Dispatchers.IO) {
        val updated = book.copy(dataAtualizacao = System.currentTimeMillis())
        bookDao.updateBook(updated)
    }

    suspend fun deleteBook(book: BookEntity) = withContext(Dispatchers.IO) {
        bookDao.deleteBook(book)
    }

    suspend fun deleteBookById(id: Long) = withContext(Dispatchers.IO) {
        bookDao.deleteBookById(id)
    }

    suspend fun findPotentialDuplicate(isbn13: String?, isbn10: String?, title: String): BookEntity? =
        withContext(Dispatchers.IO) {
            bookDao.findPotentialDuplicate(isbn13, isbn10, title)
        }

    fun computeStats(books: List<BookEntity>): EstanteStats {
        val currentYear = Calendar.getInstance().get(Calendar.YEAR)
        val lidos = books.filter { it.status == BookStatus.LIDO.value }
        val queroLer = books.filter { it.status == BookStatus.QUERO_LER.value }

        val totalPaginasLidas = lidos.sumOf { it.paginas ?: 0 }
        val livrosAnoAtual = lidos.filter { it.anoLeitura == currentYear }
        val paginasAnoAtual = livrosAnoAtual.sumOf { it.paginas ?: 0 }

        val livrosComNota = lidos.filter { it.nota != null }
        val notaMedia = if (livrosComNota.isNotEmpty()) {
            livrosComNota.map { it.nota!!.toFloat() }.average().toFloat()
        } else null

        // Lidos por ano
        val porAno = mutableMapOf<Int, Int>()
        lidos.forEach { book ->
            val ano = book.anoLeitura
            if (ano != null) {
                porAno[ano] = (porAno[ano] ?: 0) + 1
            }
        }
        val sortedPorAno = porAno.toSortedMap()

        // Top Autores
        val autoresMap = mutableMapOf<String, Int>()
        lidos.forEach { book ->
            book.autores.forEach { autor ->
                val trimmed = autor.trim()
                if (trimmed.isNotBlank()) {
                    autoresMap[trimmed] = (autoresMap[trimmed] ?: 0) + 1
                }
            }
        }
        val topAutores = autoresMap.toList().sortedByDescending { it.second }.take(8)

        // Top Gêneros
        val generosMap = mutableMapOf<String, Int>()
        lidos.forEach { book ->
            book.generos.forEach { genero ->
                val trimmed = genero.trim()
                if (trimmed.isNotBlank()) {
                    generosMap[trimmed] = (generosMap[trimmed] ?: 0) + 1
                }
            }
        }
        val topGeneros = generosMap.toList().sortedByDescending { it.second }.take(8)

        return EstanteStats(
            totalLidos = lidos.size,
            totalQueroLer = queroLer.size,
            totalPaginasLidas = totalPaginasLidas,
            paginasLidasAnoAtual = paginasAnoAtual,
            livrosLidosAnoAtual = livrosAnoAtual.size,
            notaMedia = notaMedia,
            lidosPorAno = sortedPorAno,
            topAutores = topAutores,
            topGeneros = topGeneros
        )
    }

    suspend fun exportJson(books: List<BookEntity>): String = withContext(Dispatchers.Default) {
        jsonAdapter.indent("  ").toJson(books)
    }

    suspend fun exportCsv(books: List<BookEntity>): String = withContext(Dispatchers.Default) {
        val sb = StringBuilder()
        sb.append("id,origem,titulo,subtitulo,autores,editora,ano_publicacao,paginas,isbn13,isbn10,generos,status,mes_leitura,ano_leitura,nota,observacoes\n")
        books.forEach { b ->
            fun escape(s: String?): String {
                if (s == null) return ""
                val clean = s.replace("\"", "\"\"")
                return if (clean.contains(",") || clean.contains("\n") || clean.contains("\"")) "\"$clean\"" else clean
            }
            sb.append("${b.id},")
            sb.append("${b.origem},")
            sb.append("${escape(b.titulo)},")
            sb.append("${escape(b.subtitulo)},")
            sb.append("${escape(b.autores.joinToString(";"))},")
            sb.append("${escape(b.editora)},")
            sb.append("${b.anoPublicacao ?: ""},")
            sb.append("${b.paginas ?: ""},")
            sb.append("${escape(b.isbn13)},")
            sb.append("${escape(b.isbn10)},")
            sb.append("${escape(b.generos.joinToString(";"))},")
            sb.append("${b.status},")
            sb.append("${b.mesLeitura ?: ""},")
            sb.append("${b.anoLeitura ?: ""},")
            sb.append("${b.nota ?: ""},")
            sb.append("${escape(b.observacoes)}\n")
        }
        sb.toString()
    }

    suspend fun importJson(jsonContent: String): Int = withContext(Dispatchers.IO) {
        val books = jsonAdapter.fromJson(jsonContent) ?: emptyList()
        val cleaned = books.map { it.copy(id = 0, dataAtualizacao = System.currentTimeMillis()) }
        bookDao.insertAll(cleaned).size
    }

    suspend fun importCsv(csvContent: String): Int = withContext(Dispatchers.IO) {
        val reader = BufferedReader(StringReader(csvContent))
        val lines = reader.readLines()
        if (lines.isEmpty()) return@withContext 0

        val headerLine = lines.first()
        val headers = parseCsvLine(headerLine).map { it.trim().lowercase() }

        val titleIdx = headers.indexOfFirst { it.contains("titul") || it.contains("title") || it == "nome" }
        val authorIdx = headers.indexOfFirst { it.contains("autor") || it.contains("author") }
        val yearIdx = headers.indexOfFirst { it.contains("ano_leitura") || it.contains("ano leitura") || it == "ano" }
        val monthIdx = headers.indexOfFirst { it.contains("mes_leitura") || it.contains("mês") || it.contains("mes") }
        val ratingIdx = headers.indexOfFirst { it.contains("nota") || it.contains("rating") || it.contains("estrelas") }
        val statusIdx = headers.indexOfFirst { it.contains("status") }
        val pagesIdx = headers.indexOfFirst { it.contains("pagina") || it.contains("pages") }

        val importedBooks = mutableListOf<BookEntity>()

        for (i in 1 until lines.size) {
            val line = lines[i]
            if (line.isBlank()) continue
            val cols = parseCsvLine(line)

            val title = if (titleIdx >= 0 && titleIdx < cols.size) cols[titleIdx].trim() else ""
            if (title.isBlank()) continue

            val author = if (authorIdx >= 0 && authorIdx < cols.size) cols[authorIdx].trim() else ""
            val authorsList = if (author.isNotBlank()) {
                author.split(";", ",").map { it.trim() }.filter { it.isNotEmpty() }
            } else emptyList()

            val rawYear = if (yearIdx >= 0 && yearIdx < cols.size) cols[yearIdx].trim() else null
            val year = rawYear?.toIntOrNull()

            val rawMonth = if (monthIdx >= 0 && monthIdx < cols.size) cols[monthIdx].trim() else null
            val month = parseMonth(rawMonth)

            val rawRating = if (ratingIdx >= 0 && ratingIdx < cols.size) cols[ratingIdx].trim() else null
            val rating = rawRating?.toIntOrNull()?.coerceIn(0, 10)

            val rawStatus = if (statusIdx >= 0 && statusIdx < cols.size) cols[statusIdx].trim().lowercase() else ""
            val status = if (rawStatus.contains("quero") || rawStatus.contains("wish")) {
                BookStatus.QUERO_LER.value
            } else {
                BookStatus.LIDO.value
            }

            val pages = if (pagesIdx >= 0 && pagesIdx < cols.size) cols[pagesIdx].trim().toIntOrNull() else null

            importedBooks.add(
                BookEntity(
                    titulo = title,
                    autores = authorsList,
                    anoLeitura = year,
                    mesLeitura = month,
                    nota = rating,
                    status = status,
                    paginas = pages,
                    origem = BookOrigin.MANUAL.value
                )
            )
        }

        if (importedBooks.isNotEmpty()) {
            bookDao.insertAll(importedBooks).size
        } else 0
    }

    private fun parseMonth(raw: String?): Int? {
        if (raw.isNullOrBlank()) return null
        val num = raw.toIntOrNull()
        if (num != null && num in 1..12) return num

        val lower = raw.lowercase().trim()
        return when {
            lower.startsWith("jan") -> 1
            lower.startsWith("fev") || lower.startsWith("feb") -> 2
            lower.startsWith("mar") -> 3
            lower.startsWith("abr") || lower.startsWith("apr") -> 4
            lower.startsWith("mai") || lower.startsWith("may") -> 5
            lower.startsWith("jun") -> 6
            lower.startsWith("jul") -> 7
            lower.startsWith("ago") || lower.startsWith("aug") -> 8
            lower.startsWith("set") || lower.startsWith("sep") -> 9
            lower.startsWith("out") || lower.startsWith("oct") -> 10
            lower.startsWith("nov") -> 11
            lower.startsWith("dez") || lower.startsWith("dec") -> 12
            else -> null
        }
    }

    private fun parseCsvLine(line: String): List<String> {
        val result = mutableListOf<String>()
        val current = StringBuilder()
        var inQuotes = false

        var i = 0
        while (i < line.length) {
            val c = line[i]
            if (c == '\"') {
                if (inQuotes && i + 1 < line.length && line[i + 1] == '\"') {
                    current.append('\"')
                    i++
                } else {
                    inQuotes = !inQuotes
                }
            } else if (c == ',' && !inQuotes) {
                result.add(current.toString())
                current.clear()
            } else {
                current.append(c)
            }
            i++
        }
        result.add(current.toString())
        return result
    }
}
