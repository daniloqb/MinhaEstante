package com.example.data.local

import androidx.room.*
import com.example.data.model.BookEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface BookDao {
    @Query("SELECT * FROM livros ORDER BY ano_leitura DESC, mes_leitura DESC, data_cadastro DESC")
    fun getAllBooks(): Flow<List<BookEntity>>

    @Query("SELECT * FROM livros WHERE status = :status ORDER BY ano_leitura DESC, mes_leitura DESC, data_cadastro DESC")
    fun getBooksByStatus(status: String): Flow<List<BookEntity>>

    @Query("SELECT * FROM livros WHERE id = :id")
    fun getBookById(id: Long): Flow<BookEntity?>

    @Query("SELECT * FROM livros WHERE id = :id")
    suspend fun getBookByIdOnce(id: Long): BookEntity?

    @Query("SELECT * FROM livros WHERE (isbn13 IS NOT NULL AND isbn13 = :isbn13) OR (isbn10 IS NOT NULL AND isbn10 = :isbn10) OR (LOWER(titulo) = LOWER(:title)) LIMIT 1")
    suspend fun findPotentialDuplicate(isbn13: String?, isbn10: String?, title: String): BookEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBook(book: BookEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(books: List<BookEntity>): List<Long>

    @Update
    suspend fun updateBook(book: BookEntity)

    @Delete
    suspend fun deleteBook(book: BookEntity)

    @Query("DELETE FROM livros WHERE id = :id")
    suspend fun deleteBookById(id: Long)

    @Query("DELETE FROM livros")
    suspend fun deleteAll()
}
