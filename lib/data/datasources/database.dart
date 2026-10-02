import 'package:drift/drift.dart';

/// Tabela de Livros
class Livros extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get origem => text()(); // 'google' | 'openlibrary' | 'manual'
  TextColumn get idExterno => text().nullable()();
  TextColumn get titulo => text()();
  TextColumn get subtitulo => text().nullable()();
  TextColumn get editora => text().nullable()();
  IntColumn get anoPublicacao => integer().nullable()();
  IntColumn get paginas => integer().nullable()();
  TextColumn get isbn10 => text().nullable()();
  TextColumn get isbn13 => text().nullable()();
  TextColumn get descricao => text().nullable()();
  TextColumn get capaUrl => text().nullable()();
  TextColumn get capaLocalPath => text().nullable()();
  TextColumn get status => text()(); // 'lido' | 'quero_ler'
  IntColumn get mesLeitura => integer().nullable()(); // 1 a 12
  IntColumn get anoLeitura => integer().nullable()();
  IntColumn get nota => integer().nullable()(); // 0 a 10 (null = sem nota)
  TextColumn get observacoes => text().nullable()();
  DateTimeColumn get dataCadastro => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get dataAtualizacao => dateTime().withDefault(currentDateAndTime)();
}

/// Tabela de Autores
class Autores extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get nome => text().unique()();
}

/// Relação N:N Livros <-> Autores
class LivroAutores extends Table {
  IntColumn get livroId => integer().references(Livros, #id)();
  IntColumn get autorId => integer().references(Autores, #id)();

  @override
  Set<Column> get primaryKey => {livroId, autorId};
}

/// Tabela de Gêneros
class Generos extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get nome => text().unique()();
}

/// Relação N:N Livros <-> Gêneros
class LivroGeneros extends Table {
  IntColumn get livroId => integer().references(Livros, #id)();
  IntColumn get generoId => integer().references(Generos, #id)();

  @override
  Set<Column> get primaryKey => {livroId, generoId};
}
