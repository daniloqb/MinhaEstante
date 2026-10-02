package com.example.data.local

import androidx.room.TypeConverter
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types

class Converters {
    private val moshi = Moshi.Builder().build()
    private val stringListType = Types.newParameterizedType(List::class.java, String::class.java)
    private val adapter = moshi.adapter<List<String>>(stringListType)

    @TypeConverter
    fun fromStringList(list: List<String>?): String {
        return if (list.isNullOrEmpty()) "[]" else adapter.toJson(list)
    }

    @TypeConverter
    fun toStringList(json: String?): List<String> {
        if (json.isNullOrBlank() || json == "[]") return emptyList()
        return try {
            adapter.fromJson(json) ?: emptyList()
        } catch (_: Exception) {
            // Fallback para strings separadas por vírgula se legado
            json.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        }
    }
}
