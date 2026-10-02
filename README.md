# Minha Estante 📚

Aplicativo Android nativo para registro de leituras e lista de interesse ("Quero Ler"), com funcionamento 100% offline, armazenamento local via SQLite (Room), e identidade visual imersiva de biblioteca clássica em madeira nobre e papel envelhecido.

---

## 🎨 Identidade Visual & Design System

- **Madeira Escura / Nogueira Clássica**: Fundo em `#4A2C1A` com veios desenhados por `Canvas` procedural, topo e navegação em `#2E1A0F` com filete de acabamento em latão dourado `#8B5A33`.
- **Prateleiras 3D**: Prateleiras chanfradas (`#7A4A2A`) com reflexo dourado superior e sombra projetada inferior.
- **Lombadas e Capas Realistas**: Capas com sombra lateral simulando lombada e cantos arredondados. Quando não há imagem de capa, uma capa clássica ornamental em serifada com moldura em latão dourado é gerada dinamicamente.
- **Cartões em Papel Envelhecido**: Superfície em `#F3E6CF` com bordas suaves e tipografia elegante.
- **Tipografia**:
  - **Cormorant Garamond**: Títulos, cabeçalhos das prateleiras, nomes dos livros e grandes números estatísticos.
  - **Source Sans 3**: Textos corridos, rótulos, botões e campos de entrada.
- **Tema Alternativo "Carvalho Claro"**: Opção nas configurações com madeira clara (`#C8A27A` / `#A67C52`).

---

## 🚀 Funcionalidades

1. **Estante (Modo Capas)**: Livros em pé sobre prateleiras de madeira, com rolagem horizontal dentro de cada prateleira e rolagem vertical entre prateleiras. Agrupamento por Ano (com "Sem data" no final), Autor ou Gênero.
2. **Estante (Modo Lista)**: Lista vertical em cartões de papel envelhecido com miniatura, título, autores, gêneros, avaliação em estrelas e data da leitura.
3. **Busca Unificada nas APIs**: Consulta simultânea na **Google Books API** e **Open Library**, com remoção inteligente de duplicatas por ISBN ou título+autor, e fallback de capas.
4. **Cadastro Manual**: Formulário completo para inclusão de livros físicos ou raros, com pré-visualização em tempo real da capa gerada.
5. **Detalhes da Obra**: Visão do livro em pé sobre a prateleira, metadados (editora, ano, páginas, ISBN), sinopse expansível e observações pessoais.
6. **Avaliação 0 a 10**: Seletor de 10 estrelas douradas interativas, suporte a "Sem nota" e seletor rápido de mês/ano.
7. **Estatísticas da Biblioteca**: Gráfico de barras "Livros lidos por ano" desenhado em Canvas, total de páginas lidas, média de notas e rankings dos autores e gêneros mais lidos.
8. **Backup e Sincronização**: Exportação e importação em CSV e JSON com compartilhamento nativo do Android.

---

## 📋 Formato do CSV para Importação

O app aceita planilhas no formato CSV padrão. Exemplo:

```csv
titulo,autor,ano,mes,nota,paginas,status
Dom Casmurro,Machado de Assis,2026,5,10,256,lido
Cem Anos de Solidão,Gabriel García Márquez,2026,2,10,448,lido
Grande Sertão: Veredas,João Guimarães Rosa,,,624,quero_ler
```

- **Mês**: aceita números (`1` a `12`) ou abreviações (`jan`, `fev`, `mar`, etc.). Deixar em branco para "sem data".
- **Ano**: ano com 4 dígitos (ex: `2026`).
- **Status**: `lido` ou `quero_ler`.

---

## 🛠️ Como Compilar e Gerar APK

### Pré-requisitos
- JDK 17 ou superior
- Android SDK (API 34/36)
- Gradle 8+

### Como Rodar em Debug
```bash
gradle :app:installDebug
```

### Como Gerar o APK de Release
```bash
gradle :app:assembleRelease
```
O APK final será gerado em:
`app/build/outputs/apk/release/app-release-unsigned.apk` (ou assinado se configurada a keystore).

### Como Gerar Keystore e Assinar o Release
Para gerar sua chave de assinatura:
```bash
keytool -genkey -v -keystore minha-chave.jks -keyalg RSA -keysize 2048 -validity 10000 -alias estante
```
Em seguida, defina as variáveis de ambiente antes do build:
```bash
export KEYSTORE_PATH="caminho/para/minha-chave.jks"
export STORE_PASSWORD="sua_senha_store"
export KEY_PASSWORD="sua_senha_key"
gradle :app:assembleRelease
```
