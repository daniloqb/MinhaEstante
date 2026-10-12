# Minha Estante — Especificação do Formato Oficial de Backup Portátil (.ZIP)

> **Documento de Arquitetura e Especificação Técnica**  
> Identificador da Aplicação: `com.booknookapp`  
> Versão do Formato: `1`  
> Versão do Esquema de Dados: `2` (Minha Estante v3.9+)

---

## 1. Visão Geral

O sistema de backup da Minha Estante utiliza um contêiner `.zip` autocontido e padronizado, projetado para portabilidade total e sem dependências de caminhos absolutos de sistema operacional entre **Android**, **iOS** e **Web**.

O pacote consolida os dados estruturados bibliográficos (SQLite) e todos os arquivos binários de capas físicas locais (WebP, JPEG e PNG).

---

## 2. Estrutura do Pacote ZIP

```
MinhaEstante_Backup_AAAA-MM-DD.zip
│
├── manifest.json       # Metadados de integridade, contagem e identificação do aplicativo
├── books.json          # Dump serializado e tipado de todos os livros da biblioteca
└── covers/             # Diretório com os arquivos binários de capas locais
    ├── cover_1_171000_abc123.jpg
    ├── cover_2_171000_def456.webp
    └── cover_3_171000_ghi789.png
```

---

## 3. Especificação dos Arquivos

### 3.1 `manifest.json`

O arquivo `manifest.json` é a primeira entidade lida pelo deserializador para verificação de compatibilidade e integridade:

```json
{
  "appId": "com.booknookapp",
  "appName": "Minha Estante",
  "version": 1,
  "schemaVersion": 2,
  "createdAt": "2026-10-11T22:00:00.000Z",
  "booksCount": 204,
  "coversCount": 182,
  "platform": "cross-platform"
}
```

#### Dicionário de Campos do Manifesto:
* **`appId`** *(string, obrigatório)*: Identificador canônico do aplicativo (`com.booknookapp`).
* **`appName`** *(string, obrigatório)*: Nome amigável do software (`Minha Estante`).
* **`version`** *(number, obrigatório)*: Versão da especificação do arquivo ZIP (atualmente `1`).
* **`schemaVersion`** *(number, obrigatório)*: Versão do esquema do modelo de dados (`2`).
* **`createdAt`** *(string ISO-8601, obrigatório)*: Timestamp UTC do momento da geração.
* **`booksCount`** *(number, obrigatório)*: Quantidade exata de livros contidos em `books.json`.
* **`coversCount`** *(number, obrigatório)*: Quantidade de arquivos binários contidos na pasta `covers/`.
* **`platform`** *(string)*: `cross-platform`.

---

### 3.2 `books.json`

Arquivo JSON contendo uma lista de objetos `Book` com todos os campos normalizados da persistência SQLite.

**Regra Crítica de Portabilidade:** O campo `capaLocalPath` dentro do backup **NUNCA** deve conter caminhos físicos absolutos (`/data/user/0/...` ou `file://...`). Ele deve conter exclusivamente referências relativas portáteis sob o diretório `covers/` (ex: `"covers/cover_1_171000_abc123.jpg"`).

```json
[
  {
    "id": 1,
    "origem": "manual",
    "idExterno": null,
    "titulo": "Dom Casmurro",
    "subtitulo": "Edição Crítica",
    "autores": ["Machado de Assis"],
    "editora": "Garnier",
    "anoPublicacao": 1899,
    "paginas": 256,
    "isbn10": null,
    "isbn13": "9788535914849",
    "generos": ["Literatura Brasileira", "Romance Clássico"],
    "descricao": "Um dos maiores clássicos da literatura brasileira...",
    "capaUrl": null,
    "capaLocalPath": "covers/cover_1_171000_abc123.jpg",
    "formato": "fisico",
    "tenho_fisico": true,
    "status_leitura": "lido",
    "emprestimo": null,
    "mesLeitura": 5,
    "anoLeitura": 2024,
    "nota": 10,
    "observacoes": "Exemplar de capa dura em perfeito estado.",
    "dataCadastro": 1715000000000,
    "dataAtualizacao": 1715000000000
  }
]
```

---

### 3.3 Pasta `covers/`

Contém os arquivos binários das capas dos livros:
* Nomes de arquivo sanitizados: `cover_<id>_<timestamp>_<hash>.<ext>`.
* Formatos aceitos: JPEG (`.jpg`, `.jpeg`), WebP (`.webp`), PNG (`.png`).
* Não são permitidos arquivos executáveis, scripts ou arquivos fora da pasta `covers/`.

---

## 4. Regras de Segurança e Validação

1. **Proteção contra Zip-Slip / Path Traversal**:
   - Todo caminho extraído do ZIP é sanitizado.
   - Entradas contendo `..`, barras iniciais (`/` ou `\`) ou caminhos absolutos são rejeitadas e registradas como avisos de auditoria, impedindo gravação arbitrária no sistema de arquivos do dispositivo.
2. **Validação de Magic Bytes**:
   - As imagens não são aceitas apenas pela extensão do arquivo. O sistema valida os primeiros bytes do arquivo binário (ex: `FF D8 FF` para JPEG, `89 50 4E 47` para PNG, `RIFF...WEBP` para WebP). Arquivos corrompidos ou com payloads inesperados são descartados.
3. **Resiliência a Imagens Ausentes**:
   - Se uma capa referenciada em `books.json` não estiver presente no arquivo ZIP, o livro é restaurado normalmente e o sistema emite um aviso no relatório, mantendo a exibição do placeholder temático vintage.
4. **Rollback Automático (Atomicidade no Modo 'Substituir')**:
   - Antes de limpar a biblioteca atual no modo 'Substituir', é criado um snapshot em memória dos livros existentes. Em caso de exceção ou corrupção fatal durante a inserção, a biblioteca anterior é restaurada imediatamente.

---

## 5. Modos de Restauração

* **Substituir Biblioteca (Recomendado)**:
  - Limpa os registros do banco de dados e aplica o estado idêntico ao do backup.
  - Substitui as capas locais correspondentes.
  - Ideal para trocar de smartphone ou restaurar uma cópia completa.
* **Mesclar com Biblioteca Atual**:
  - Preserva os livros preexistentes no aparelho.
  - Adiciona os livros do backup com novos IDs sequenciais, evitando sobreposição e mantendo as capas de ambos.

---

## 6. Compatibilidade com Backups Legados (JSON e CSV)

* **JSON Legado (v1)**:
  - O importador reconhece formatos de versões anteriores do app (inclusive arrays brutos ou objetos com campo `{ books: [...] }`).
  - Detecta capas antigas serializadas em Base64 e as converte automaticamente para arquivos físicos persistentes no `Directory.Data/covers/`, limpando o Base64 pesado do banco SQLite.
  - Mapeia campos antigos (`categoria: "Meus Livros"`, `status: "lido"`) para os novos campos booleanos independentes (`tenho_fisico: true`, `status_leitura: "lido"`).
* **Exportação CSV**:
  - Gera arquivo delimitado por vírgula em codificação UTF-8 com todos os metadados bibliográficos úteis para análise em Excel, Google Planilhas ou LibreOffice Calc.
