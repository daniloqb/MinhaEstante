# Minha Estante 📚

Aplicativo web React responsivo para registro de leituras e lista de interesse ("Quero Ler"), com funcionamento 100% offline, persistência local no navegador, e identidade visual imersiva de biblioteca clássica em madeira nobre e papel envelhecido.

Reescrito a partir do aplicativo original em Android para React + Vite + TypeScript e Tailwind CSS, preservando integralmente todas as funcionalidades, regras de negócio e estética original.

---

## 🎨 Identidade Visual & Design System

- **Madeira Escura / Nogueira Clássica**: Fundo em `#4A2C1A` com veios de madeira, topo e navegação em `#2E1A0F` com filete de acabamento em latão dourado `#8B5A33`.
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
7. **Estatísticas da Biblioteca**: Gráfico de barras "Livros lidos por ano", total de páginas lidas, média de notas e rankings dos autores e gêneros mais lidos.
8. **Backup e Sincronização**: Exportação e importação em CSV e JSON com download direto de arquivo ou cópia.
9. **Detecção de Duplicatas**: Ao adicionar livro da busca, detecta se a obra já existe na estante por ISBN ou título e oferece opção de abrir o registro existente ou cadastrar como novo.

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

## 🛠️ Execução e Desenvolvimento

### Pré-requisitos
- Node.js 20+ ou 22
- npm

### Como rodar em desenvolvimento
```bash
npm install
npm run dev
```

### Como compilar para produção
```bash
npm run build
```
