package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.data.model.BookEntity
import com.example.data.model.BookOrigin
import com.example.data.model.BookStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(entities = [BookEntity::class], version = 1, exportSchema = false)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun bookDao(): BookDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "minha_estante.db"
                )
                .fallbackToDestructiveMigration()
                .addCallback(object : Callback() {
                    override fun onCreate(db: SupportSQLiteDatabase) {
                        super.onCreate(db)
                        // Pré-popular com alguns clássicos para a estante já abrir viva e encantadora
                        INSTANCE?.let { database ->
                            CoroutineScope(Dispatchers.IO).launch {
                                populateInitialBooks(database.bookDao())
                            }
                        }
                    }
                })
                .build()
                INSTANCE = instance
                instance
            }
        }

        private suspend fun populateInitialBooks(dao: BookDao) {
            val sampleBooks = listOf(
                BookEntity(
                    titulo = "Dom Casmurro",
                    subtitulo = "Edição comemorativa",
                    autores = listOf("Machado de Assis"),
                    editora = "Garnier",
                    anoPublicacao = 1899,
                    paginas = 256,
                    isbn13 = "9788535902778",
                    generos = listOf("Literatura Brasileira", "Romance", "Clássico"),
                    descricao = "Uma das maiores obras-primas da literatura em língua portuguesa. Narra a história de Bento Santiago e sua obsessão ciumenta por Capitu, os 'olhos de ressaca'.",
                    capaUrl = "https://covers.openlibrary.org/b/isbn/9788535902778-M.jpg",
                    status = BookStatus.LIDO.value,
                    mesLeitura = 5,
                    anoLeitura = 2026,
                    nota = 10,
                    observacoes = "Releitura magnífica! A prosa irônica de Machado continua insuperável.",
                    origem = BookOrigin.MANUAL.value
                ),
                BookEntity(
                    titulo = "Cem Anos de Solidão",
                    autores = listOf("Gabriel García Márquez"),
                    editora = "Record",
                    anoPublicacao = 1967,
                    paginas = 448,
                    isbn13 = "9788501012074",
                    generos = listOf("Realismo Mágico", "Ficção", "Clássico Latino"),
                    descricao = "A épica saga da família Buendía na mítica aldeia de Macondo, tecida entre milagres, guerras e solidão.",
                    capaUrl = "https://covers.openlibrary.org/b/isbn/9788501012074-M.jpg",
                    status = BookStatus.LIDO.value,
                    mesLeitura = 2,
                    anoLeitura = 2026,
                    nota = 10,
                    observacoes = "Obra arrebatadora do início ao fim.",
                    origem = BookOrigin.MANUAL.value
                ),
                BookEntity(
                    titulo = "O Nome da Rosa",
                    autores = listOf("Umberto Eco"),
                    editora = "Record",
                    anoPublicacao = 1980,
                    paginas = 544,
                    isbn13 = "9788501017369",
                    generos = listOf("Mistério", "Ficção Histórica", "Filosofia"),
                    descricao = "Durante a última semana de novembro de 1327, em um mosteiro franciscano no norte da Itália, o frade Guilherme de Baskerville investiga assassinatos misteriosos ligados a uma biblioteca labiríntica.",
                    capaUrl = "https://covers.openlibrary.org/b/isbn/9788501017369-M.jpg",
                    status = BookStatus.LIDO.value,
                    mesLeitura = 11,
                    anoLeitura = 2025,
                    nota = 9,
                    observacoes = "A descrição da biblioteca clássica é deslumbrante.",
                    origem = BookOrigin.MANUAL.value
                ),
                BookEntity(
                    titulo = "A Metamorfose",
                    autores = listOf("Franz Kafka"),
                    editora = "Companhia das Letras",
                    anoPublicacao = 1915,
                    paginas = 104,
                    isbn13 = "9788571646858",
                    generos = listOf("Ficção", "Existencialismo", "Clássico"),
                    descricao = "Gregor Samsa acorda certa manhã transformado em um inseto monstruoso.",
                    capaUrl = "https://covers.openlibrary.org/b/isbn/9788571646858-M.jpg",
                    status = BookStatus.LIDO.value,
                    mesLeitura = 8,
                    anoLeitura = 2025,
                    nota = 9,
                    observacoes = "Curto e perturbador.",
                    origem = BookOrigin.MANUAL.value
                ),
                BookEntity(
                    titulo = "Grande Sertão: Veredas",
                    autores = listOf("João Guimarães Rosa"),
                    editora = "Companhia das Letras",
                    anoPublicacao = 1956,
                    paginas = 624,
                    isbn13 = "9788535931983",
                    generos = listOf("Literatura Brasileira", "Romance"),
                    descricao = "O monólogo de Riobaldo, ex-jagunço que relembra sua vida pelas veredas do sertão e seu sentimento por Diadorim.",
                    capaUrl = "https://covers.openlibrary.org/b/isbn/9788535931983-M.jpg",
                    status = BookStatus.QUERO_LER.value,
                    origem = BookOrigin.MANUAL.value
                ),
                BookEntity(
                    titulo = "O Retrato de Dorian Gray",
                    autores = listOf("Oscar Wilde"),
                    editora = "Penguin",
                    anoPublicacao = 1890,
                    paginas = 280,
                    isbn13 = "9788563560377",
                    generos = listOf("Ficção Gótica", "Clássico"),
                    descricao = "A busca eterna pela juventude e a degeneração da alma humana.",
                    capaUrl = "https://covers.openlibrary.org/b/isbn/9788563560377-M.jpg",
                    status = BookStatus.QUERO_LER.value,
                    origem = BookOrigin.MANUAL.value
                )
            )
            dao.insertAll(sampleBooks)
        }
    }
}
