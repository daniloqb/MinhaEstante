package com.example.data.remote

import com.example.data.model.BookEntity
import com.example.data.model.BookOrigin
import com.example.data.model.BookStatus
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

data class SearchResultBook(
    val origem: BookOrigin,
    val idExterno: String?,
    val titulo: String,
    val subtitulo: String? = null,
    val autores: List<String> = emptyList(),
    val editora: String? = null,
    val anoPublicacao: Int? = null,
    val paginas: Int? = null,
    val isbn10: String? = null,
    val isbn13: String? = null,
    val generos: List<String> = emptyList(),
    val descricao: String? = null,
    val capaUrl: String? = null
) {
    fun toBookEntity(status: BookStatus = BookStatus.LIDO): BookEntity {
        return BookEntity(
            origem = origem.value,
            idExterno = idExterno,
            titulo = titulo,
            subtitulo = subtitulo,
            autores = autores,
            editora = editora,
            anoPublicacao = anoPublicacao,
            paginas = paginas,
            isbn10 = isbn10,
            isbn13 = isbn13,
            generos = generos,
            descricao = descricao,
            capaUrl = capaUrl,
            status = status.value
        )
    }

    val autoresFormatados: String
        get() = if (autores.isEmpty()) "Autor desconhecido" else autores.joinToString(", ")
}

class BookSearchRepository {
    private val moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val googleBooksService: GoogleBooksService by lazy {
        Retrofit.Builder()
            .baseUrl("https://www.googleapis.com/")
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(GoogleBooksService::class.java)
    }

    private val openLibraryService: OpenLibraryService by lazy {
        Retrofit.Builder()
            .baseUrl("https://openlibrary.org/")
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(OpenLibraryService::class.java)
    }

    suspend fun search(query: String, apiKey: String? = null): List<SearchResultBook> = withContext(Dispatchers.IO) {
        val trimmedQuery = query.trim()
        if (trimmedQuery.isBlank()) return@withContext emptyList()

        val cleanIsbn = trimmedQuery.replace("-", "").replace(" ", "")
        val isIsbn = (cleanIsbn.length == 10 || cleanIsbn.length == 13) && cleanIsbn.all { it.isDigit() || it == 'X' || it == 'x' }

        val googleQuery = if (isIsbn) "isbn:$cleanIsbn" else trimmedQuery
        val openLibQuery = if (isIsbn) cleanIsbn else trimmedQuery

        coroutineScope {
            val googleDeferred = async {
                try {
                    val response = googleBooksService.searchBooks(googleQuery, maxResults = 20, apiKey = apiKey?.takeIf { it.isNotBlank() })
                    response.items?.mapNotNull { it.toSearchResult() } ?: emptyList()
                } catch (e: Exception) {
                    emptyList()
                }
            }

            val openLibDeferred = async {
                try {
                    val response = openLibraryService.searchBooks(openLibQuery, limit = 20)
                    response.docs?.mapNotNull { it.toSearchResult() } ?: emptyList()
                } catch (e: Exception) {
                    emptyList()
                }
            }

            val googleResults = googleDeferred.await()
            val openLibResults = openLibDeferred.await()

            mergeAndDeduplicate(googleResults, openLibResults)
        }
    }

    private fun mergeAndDeduplicate(
        googleList: List<SearchResultBook>,
        openLibList: List<SearchResultBook>
    ): List<SearchResultBook> {
        val merged = mutableListOf<SearchResultBook>()
        val seenIsbns = mutableSetOf<String>()
        val seenTitleAuthors = mutableSetOf<String>()

        fun keyTitleAuthor(title: String, authors: List<String>): String {
            val normTitle = title.lowercase().filter { it.isLetterOrDigit() }
            val normAuthor = authors.firstOrNull()?.lowercase()?.filter { it.isLetterOrDigit() } ?: ""
            return "$normTitle|$normAuthor"
        }

        // Primeiro processa os do Google Books (fonte principal)
        for (gBook in googleList) {
            val taKey = keyTitleAuthor(gBook.titulo, gBook.autores)
            var finalBook = gBook

            // Se o Google não tem capa, tentar encontrar nos resultados do OpenLibrary
            if (finalBook.capaUrl == null) {
                val matchingOl = openLibList.find { ol ->
                    (ol.isbn13 != null && (ol.isbn13 == finalBook.isbn13 || ol.isbn13 == finalBook.isbn10)) ||
                    (ol.isbn10 != null && (ol.isbn10 == finalBook.isbn10 || ol.isbn10 == finalBook.isbn13)) ||
                    keyTitleAuthor(ol.titulo, ol.autores) == taKey
                }
                if (matchingOl?.capaUrl != null) {
                    finalBook = finalBook.copy(capaUrl = matchingOl.capaUrl)
                }
            }

            merged.add(finalBook)
            finalBook.isbn13?.let { seenIsbns.add(it) }
            finalBook.isbn10?.let { seenIsbns.add(it) }
            seenTitleAuthors.add(taKey)
        }

        // Agora adiciona os do Open Library que não são duplicatas
        for (olBook in openLibList) {
            val hasSeenIsbn = (olBook.isbn13 != null && seenIsbns.contains(olBook.isbn13)) ||
                              (olBook.isbn10 != null && seenIsbns.contains(olBook.isbn10))
            val taKey = keyTitleAuthor(olBook.titulo, olBook.autores)
            val hasSeenTitleAuthor = seenTitleAuthors.contains(taKey)

            if (!hasSeenIsbn && !hasSeenTitleAuthor) {
                merged.add(olBook)
                olBook.isbn13?.let { seenIsbns.add(it) }
                olBook.isbn10?.let { seenIsbns.add(it) }
                seenTitleAuthors.add(taKey)
            }
        }

        return merged
    }

    private fun GoogleBookVolume.toSearchResult(): SearchResultBook? {
        val info = volumeInfo ?: return null
        val title = info.title?.trim() ?: return null
        if (title.isBlank()) return null

        var isbn10: String? = null
        var isbn13: String? = null
        info.industryIdentifiers?.forEach { id ->
            when (id.type?.uppercase()) {
                "ISBN_13" -> isbn13 = id.identifier
                "ISBN_10" -> isbn10 = id.identifier
            }
        }

        val rawCover = info.imageLinks?.thumbnail ?: info.imageLinks?.smallThumbnail
        val secureCover = rawCover?.replace("http://", "https://")

        val year = info.publishedDate?.take(4)?.toIntOrNull()

        return SearchResultBook(
            origem = BookOrigin.GOOGLE,
            idExterno = id,
            titulo = title,
            subtitulo = info.subtitle,
            autores = info.authors ?: emptyList(),
            editora = info.publisher,
            anoPublicacao = year,
            paginas = info.pageCount,
            isbn10 = isbn10,
            isbn13 = isbn13,
            generos = info.categories?.flatMap { it.split("/", ",").map { c -> c.trim() } }?.distinct() ?: emptyList(),
            descricao = info.description,
            capaUrl = secureCover
        )
    }

    private fun OpenLibraryDoc.toSearchResult(): SearchResultBook? {
        val docTitle = title?.trim() ?: return null
        if (docTitle.isBlank()) return null

        val isbn13 = isbns?.find { it.length == 13 }
        val isbn10 = isbns?.find { it.length == 10 }

        val coverUrl = when {
            coverId != null && coverId > 0 -> "https://covers.openlibrary.org/b/id/$coverId-M.jpg"
            isbn13 != null -> "https://covers.openlibrary.org/b/isbn/$isbn13-M.jpg"
            isbn10 != null -> "https://covers.openlibrary.org/b/isbn/$isbn10-M.jpg"
            else -> null
        }

        return SearchResultBook(
            origem = BookOrigin.OPEN_LIBRARY,
            idExterno = key,
            titulo = docTitle,
            subtitulo = subtitle,
            autores = authorNames ?: emptyList(),
            editora = publishers?.firstOrNull(),
            anoPublicacao = firstPublishYear,
            paginas = numberOfPages,
            isbn10 = isbn10,
            isbn13 = isbn13,
            generos = subjects?.take(5) ?: emptyList(),
            descricao = null,
            capaUrl = coverUrl
        )
    }
}
