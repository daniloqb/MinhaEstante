package com.example.data.remote

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import retrofit2.http.GET
import retrofit2.http.Query

@JsonClass(generateAdapter = true)
data class GoogleBooksResponse(
    @Json(name = "totalItems") val totalItems: Int? = 0,
    @Json(name = "items") val items: List<GoogleBookVolume>? = null
)

@JsonClass(generateAdapter = true)
data class GoogleBookVolume(
    @Json(name = "id") val id: String,
    @Json(name = "volumeInfo") val volumeInfo: GoogleVolumeInfo?
)

@JsonClass(generateAdapter = true)
data class GoogleVolumeInfo(
    @Json(name = "title") val title: String?,
    @Json(name = "subtitle") val subtitle: String?,
    @Json(name = "authors") val authors: List<String>?,
    @Json(name = "publisher") val publisher: String?,
    @Json(name = "publishedDate") val publishedDate: String?,
    @Json(name = "description") val description: String?,
    @Json(name = "industryIdentifiers") val industryIdentifiers: List<GoogleIdentifier>?,
    @Json(name = "pageCount") val pageCount: Int?,
    @Json(name = "categories") val categories: List<String>?,
    @Json(name = "imageLinks") val imageLinks: GoogleImageLinks?
)

@JsonClass(generateAdapter = true)
data class GoogleIdentifier(
    @Json(name = "type") val type: String?,
    @Json(name = "identifier") val identifier: String?
)

@JsonClass(generateAdapter = true)
data class GoogleImageLinks(
    @Json(name = "smallThumbnail") val smallThumbnail: String?,
    @Json(name = "thumbnail") val thumbnail: String?
)

interface GoogleBooksService {
    @GET("books/v1/volumes")
    suspend fun searchBooks(
        @Query("q") query: String,
        @Query("maxResults") maxResults: Int = 20,
        @Query("key") apiKey: String? = null
    ): GoogleBooksResponse
}
