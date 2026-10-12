# Guia Completo para Publicação na Google Play Console — Minha Estante

Este documento contém **todos os campos exatos** que você precisa preencher na Google Play Console para criar e publicar o aplicativo **Minha Estante**.

---

## 1. Criação do Aplicativo (Painel Inicial)
* **Nome do aplicativo:** `Minha Estante`
* **Idioma padrão:** `Português (Brasil) – pt-BR`
* **Tipo:** `App` (Aplicativo)
* **Preço:** `Gratuito`
* **Declarações:** Marque as duas caixas de conformidade com as diretrizes e exportação dos EUA.

---

## 2. Detalhes do App (Ficha da Google Play Store)

### Nome do App (Máximo 30 caracteres)
```text
Minha Estante
```
*(13 caracteres)*

### Breve Descrição (Máximo 80 caracteres)
```text
Organize seus livros em estante clássica de madeira, scanner ISBN e backup ZIP.
```
*(78 caracteres)*

### Descrição Completa (Máximo 4000 caracteres)
```text
Minha Estante é o seu organizador e catálogo pessoal definitivo para quem ama livros físicos e digitais.

Com uma elegante estante clássica em acabamento de madeira nobre (carvalho claro ou nogueira escura), o Minha Estante transforma sua coleção em uma experiência visual acolhedora e inspiradora.

PRINCIPAIS RECURSOS:

📚 Estante Visual em Madeira Nobre
• Visualize suas capas padronizadas em proporção 2:3 organizadas em prateleiras realistas de madeira nobre.
• Alternância dinâmica entre estante de madeira clássica e lista compacta detalhada.
• Suporte para livros físicos e e-books com filtros rápidos.
• Persistência ultraveloz em banco relacional SQLite local (suporta dezenas de milhares de obras sem lentidão).

🔍 Cadastro Instantâneo via Código de Barras (ISBN)
• Aponte a câmera do seu smartphone para a contracapa do livro.
• Busca automática instantânea em bases públicas (BrasilAPI, Google Books e Open Library).
• Preenchimento automático de título, autores, editora, ano, número de páginas e capa em alta resolução.

🤝 Controle de Livros Emprestados
• Nunca mais esqueça com quem está aquele seu exemplar favorito.
• Registre o nome do contato, telefone, data de empréstimo e data prevista de devolução.
• Aba dedicada com status de empréstimos em andamento e devoluções.

📊 Metas de Leitura & Estatísticas
• Acompanhe suas páginas lidas por mês e ano.
• Gráficos de autores mais lidos, distribuição de notas (1 a 10) e gêneros favoritos.
• Histórico organizado de leituras concluídas.

💾 Seus Dados São 100% Seus (Backup Completo Portátil em ZIP)
• Exportação e restauração completa em pacote .ZIP (contendo o catálogo e todas as imagens físicas de capa).
• Totalmente funcional mesmo sem internet (100% offline-first).
• Nenhuma dependência de servidores de terceiros ou nuvens instáveis.

🌍 Internacionalização
• Altere idioma e preferências a qualquer momento (Português, Inglês, Espanhol, Francês, Alemão e Italiano).

Livre de anúncios, sem rastreadores intrusivos e feito com carinho para quem aprecia o prazer da leitura.
```

---

## 3. Configuração da Loja (Store Settings)
* **Categoria:** `Livros e referências` (Books & Reference)
* **Tags recomendadas:** `Livros`, `Leitura`, `Biblioteca`, `E-books`, `Produtividade`
* **E-mail de suporte:** `daniloqb@gmail.com`
* **Site / Página web:** `https://daniloqb.github.io/BookNook/` (ou a URL do seu GitHub Pages)
* **Telefone:** *(opcional — pode deixar em branco)*

---

## 4. Recursos Gráficos Obrigatórios

1. **Ícone do App:**
   * Tamanho: `512 x 512 px` (PNG 32-bit com transparência, máx 1MB).
   * Arquivo pronto no projeto: `public/pwa-512x512.png` ou `docs/assets/pwa-512x512.png`.

2. **Imagem de Destaque (Feature Graphic):**
   * Tamanho: `1024 x 500 px` (JPEG ou PNG de até 15MB).
   * Arquivo no projeto: `public/app-icon.jpg` ou arte da estante.

3. **Capturas de Tela (Screenshots de Celular):**
   * Mínimo de 2 capturas de tela (proporção recomendada 9:16 ou 16:9).
   * Sugestão: Faça prints da tela principal com a estante de madeira, da tela de estatísticas e da tela de empréstimos.

---

## 5. Conteúdo do App (Questionários Obrigatórios da Play Console)

### A. Política de Privacidade
* **URL:** `https://daniloqb.github.io/BookNook/privacy-policy.html`
*(Hospedada gratuitamente no seu GitHub Pages no repositório)*

### B. Acesso ao App (App Access)
* Selecionar: **"Todas as funcionalidades estão disponíveis sem restrições especiais"** (não há paywall nem necessidade de login para usar a estante).

### C. Anúncios (Ads)
* Selecionar: **"Não, meu app não contém anúncios"**.

### D. Classificação de Conteúdo (IARC)
* Categoria: **Utilitário, Produtividade, Comunicação ou Outros**.
* Questionário:
  * O app compartilha a localização física do usuário? **Não**
  * O app permite compra de bens digitais? **Não**
  * Contém linguagem forte, violência ou nudez? **Não**
  * É um navegador web aberto? **Não**
* **Resultado esperado:** Livre / PEGI 3 / Everyone.

### E. Público-Alvo e Conteúdo (Target Audience)
* Selecionar faixas etárias: **13 a 15 anos**, **16 a 17 anos**, **18 anos ou mais**.
* O app é voltado intencionalmente para crianças? **Não**.

### F. Aplicativo de Notícias
* Selecionar: **"Não"**.

### G. Aplicativos de Covid-19 / Rastreamento
* Selecionar: **"Não"**.

### H. Segurança dos Dados (Data Safety)
* **O seu app coleta ou compartilha algum dado de usuário relevante?**
  * Responda: **Não** (todos os dados ficam gravados localmente no aparelho do usuário e o backup no Google Drive é uma conexão direta do usuário com a conta dele sem passar por servidores seus).
* **Os dados em trânsito são criptografados?** **Sim** (o tráfego para APIs de capas e Google Drive ocorre via HTTPS).
* **O usuário pode solicitar a exclusão dos dados?** **Sim** (botão "Limpar Todos os Dados" nas configurações e exclusão direta no aparelho).

### I. Recursos Financeiros
* Selecionar: **"O app não oferece recursos financeiros"**.

---

## 6. Produção / Lançamento do Pacote (.AAB)

* **Arquivo para Upload:** `minha-estante.aab` / `booknook.aab` (gerado na raiz do projeto).
* **Package Name (Application ID):** `com.booknookapp`
* **Version Code:** `18`
* **Version Name:** `1.0.18`
* **SDK Mínimo:** `24` (Android 7.0+)
* **SDK Alvo:** `36` (Android 16)
* **Chave de Assinatura (Keystore):**
  * Arquivo padrão: `booknook-release-key.jks` (gerenciado de forma segura via variáveis de ambiente `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`)
  * Alias: `booknook`
  * SHA-1: `E3:94:F7:44:A0:27:1C:34:9D:A5:3B:EB:BF:0E:8A:8C:99:C1:CE:E7`
  * SHA-256: `62:FB:C4:A3:F4:04:CD:84:E8:5C:37:06:F5:57:4C:B1:EF:48:79:02:00:92:F0:8A:E2:11:68:47:B2:61:E3:EF`

---

## 7. Como Ativar o GitHub Pages no seu Repositório

1. No seu repositório no GitHub, abra a aba **Settings** (Configurações).
2. No menu lateral esquerdo, clique em **Pages**.
3. Em **Build and deployment > Source**, selecione:
   * **Deploy from a branch**
   * Branch: **main**
   * Pasta: **/docs**
   * Clique em **Save**.
4. Em 1 minuto seu site estará no ar com a política de privacidade em:
   `https://daniloqb.github.io/MinhaEstante/privacy-policy.html`

---

## 8. Notas da Versão (Release Notes — v1.0.18)

*(Limite de 500 caracteres por idioma no Google Play Console)*

### Formato direto com tags para o Google Play Console:
```xml
<pt-BR>
🎉 Bem-vindo ao Minha Estante 1.0.18!
• Banco de dados relacional SQLite ultraveloz para acervos de milhares de livros
• Armazenamento físico de capas offline no dispositivo (sem links quebrados)
• Backup completo portátil em arquivo ZIP com catálogo e imagens
• Scanner instantâneo de código de barras (ISBN) com câmera
• Navegação com estante realista em madeira nobre e lista detalhada
• 100% privado, sem anúncios e sem rastreadores
</pt-BR>
<en-US>
🎉 Welcome to Minha Estante 1.0.18!
• High-performance SQLite database supporting thousands of books
• Offline local cover image storage in private app directory
• Portable full ZIP backup with book catalog and cover images
• Instant camera barcode scanner for book ISBNs
• Realistic hardwood bookshelf view and detailed list
• 100% private, ad-free and tracker-free
</en-US>
```
