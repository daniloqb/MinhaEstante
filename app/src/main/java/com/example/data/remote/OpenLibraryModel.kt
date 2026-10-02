package com.example.data.remote

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import retrofit2.http.GET
import retrofit2.http.Query

@JsonClass(generateAdapter = true)
data class OpenLibrarySearchResponse(
    @Json(name = "numFound") val numFound: Int? = 0,
    @Json(name = "docs") val docs: List<OpenLibraryDoc>? = null
)

@JsonClass(generateAdapter = true)
data class OpenLibraryDoc(
    @Json(name = "key") val key: String?,
    @Json(name = "title") val title: String?,
    @Json(name = "subtitle") val subtitle: String?,
    @Json(name = "author_name") val authorNames: List<String>?,
    @Json(name = "publisher") val publishers: List<String>?,
    @Json(name = "first_publish_year") val firstPublishYear: Int?,
    @Json(name = "number_of_pages_median") val numberOfPages: Int?,
    @Json(name = "isbn") val isbns: List<String>?,
    @Json(name = "subject") val subjects: List<String>?,
    @Json(name = "cover_i") val coverId: Long?
)

interface OpenLibraryService {
    @GET("search.json")
    suspend fun searchBooks(
        @Query("q") query: String,
        @Query("limit") limit: Int = 20
    ): OpenLibrarySearchResponse
}
