package com.example.data.model

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

enum class BookStatus(val value: String, val label: String) {
    LIDO("lido", "Lido"),
    QUERO_LER("quero_ler", "Quero Ler");

    companion object {
        fun fromValue(value: String): BookStatus =
            entries.find { it.value.equals(value, ignoreCase = true) } ?: LIDO
    }
}

enum class BookOrigin(val value: String, val label: String) {
    GOOGLE("google", "Google Books"),
    OPEN_LIBRARY("openlibrary", "Open Library"),
    MANUAL("manual", "Manual");

    companion object {
        fun fromValue(value: String): BookOrigin =
            entries.find { it.value.equals(value, ignoreCase = true) } ?: MANUAL
    }
}

@Entity(tableName = "livros")
data class BookEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    val origem: String = BookOrigin.MANUAL.value,

    @ColumnInfo(name = "id_externo")
    val idExterno: String? = null,

    val titulo: String,
    val subtitulo: String? = null,

    val autores: List<String> = emptyList(),

    val editora: String? = null,

    @ColumnInfo(name = "ano_publicacao")
    val anoPublicacao: Int? = null,

    val paginas: Int? = null,
    val isbn10: String? = null,
    val isbn13: String? = null,

    val generos: List<String> = emptyList(),

    val descricao: String? = null,

    @ColumnInfo(name = "capa_url")
    val capaUrl: String? = null,

    @ColumnInfo(name = "capa_local_path")
    val capaLocalPath: String? = null,

    val status: String = BookStatus.LIDO.value,

    @ColumnInfo(name = "mes_leitura")
    val mesLeitura: Int? = null, // 1-12

    @ColumnInfo(name = "ano_leitura")
    val anoLeitura: Int? = null,

    val nota: Int? = null, // 0-10, null = sem nota

    val observacoes: String? = null,

    @ColumnInfo(name = "data_cadastro")
    val dataCadastro: Long = System.currentTimeMillis(),

    @ColumnInfo(name = "data_atualizacao")
    val dataAtualizacao: Long = System.currentTimeMillis()
) {
    val statusEnum: BookStatus get() = BookStatus.fromValue(status)
    val origemEnum: BookOrigin get() = BookOrigin.fromValue(origem)

    val autoresFormatados: String
        get() = if (autores.isEmpty()) "Autor desconhecido" else autores.joinToString(", ")

    val generosFormatados: String
        get() = if (generos.isEmpty()) "Geral" else generos.joinToString(", ")

    val dataLeituraFormatada: String
        get() = when {
            anoLeitura != null && mesLeitura != null -> {
                val mesNome = when (mesLeitura) {
                    1 -> "Jan"; 2 -> "Fev"; 3 -> "Mar"; 4 -> "Abr"; 5 -> "Mai"; 6 -> "Jun"
                    7 -> "Jul"; 8 -> "Ago"; 9 -> "Set"; 10 -> "Out"; 11 -> "Nov"; 12 -> "Dez"
                    else -> "$mesLeitura"
                }
                "$mesNome/$anoLeitura"
            }
            anoLeitura != null -> "$anoLeitura"
            else -> "Sem data"
        }
}
