# Guia Completo para Publicação na Google Play Console — BookNook

Este documento contém **todos os campos exatos** que você precisa preencher na Google Play Console para criar e publicar o aplicativo **BookNook**.

---

## 1. Criação do Aplicativo (Painel Inicial)
* **Nome do aplicativo:** `BookNook`
* **Idioma padrão:** `Português (Brasil) – pt-BR`
* **Tipo:** `App` (Aplicativo)
* **Preço:** `Gratuito`
* **Declarações:** Marque as duas caixas de conformidade com as diretrizes e exportação dos EUA.

---

## 2. Detalhes do App (Ficha da Google Play Store)

### Nome do App (Máximo 30 caracteres)
```text
BookNook
```
*(8 caracteres)*

### Breve Descrição (Máximo 80 caracteres)
```text
Organize seus livros com estante de madeira, scanner ISBN e backup no Drive.
```
*(75 caracteres)*

### Descrição Completa (Máximo 4000 caracteres)
```text
BookNook é o seu organizador e catálogo pessoal definitivo para quem ama livros físicos e digitais.

Com uma elegante estante clássica em acabamento de madeira nobre (carvalho claro ou nogueira escura), o BookNook transforma sua coleção em uma experiência visual acolhedora e inspiradora.

PRINCIPAIS RECURSOS:

📚 Estante Visual em Madeira Nobre
• Visualize suas capas padronizadas em proporção 2:3 organizadas em prateleiras realistas.
• Alternância dinâmica entre estante de madeira clássica e lista compacta detalhada.
• Suporte para livros físicos e e-books com filtros rápidos.

🔍 Cadastro Instantâneo via Código de Barras (ISBN)
• Aponte a câmera do seu smartphone para a contracapa do livro.
• Busca automática de título, autores, editora, ano de publicação, quantidade de páginas e capas em alta resolução.

🤝 Controle de Livros Emprestados
• Nunca mais esqueça com quem está aquele seu exemplar favorito.
• Registre o nome do amigo, telefone de contato, data de empréstimo e data prevista de devolução.
• Aba dedicada com status de empréstimos em andamento e devoluções.

📊 Metas de Leitura & Estatísticas
• Acompanhe suas páginas lidas por mês e ano.
• Gráficos de autores mais lidos, distribuição de notas (1 a 10) e gêneros favoritos.
• Histórico organizado de leituras concluídas.

☁️ Seus Dados São 100% Seus (Backup no Google Drive)
• Sincronização segura com um único toque no seu Google Drive pessoal (usando escopo restrito drive.file).
• Exportação e importação completa em arquivos JSON e planilhas CSV (compatível com Excel).
• Totalmente funcional mesmo sem internet (offline-first).

🌍 Internacionalização
• Altere idioma e preferências de exibição a qualquer momento (Português, Inglês, Espanhol, Francês, Alemão e Italiano).

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

* **Arquivo para Upload:** `booknook.aab` (localizado na raiz do projeto e pronto para download em `/booknook.aab`).
* **Package Name:** `com.booknookapp`
* **Version Code:** `1`
* **Version Name:** `1.0.0`
* **Chave de Assinatura (Keystore):**
  * Arquivo gerado: `booknook-release-key.jks`
  * Alias: `booknook`
  * Senha: `booknook123`
  * SHA-1: `E3:94:F7:44:A0:27:1C:34:9D:A5:3B:EB:BF:0E:8A:8C:99:C1:CE:E7`
  * SHA-256: `62:FB:C4:A3:F4:04:CD:84:E8:5C:37:06:F5:57:4C:B1:EF:48:79:02:00:92:F0:8A:E2:11:68:47:B2:61:E3:EF`

---

## 7. Como Ativar o GitHub Pages no seu Repositório

1. Crie seu repositório no GitHub com o nome `BookNook` (ou envie estes arquivos para o seu repositório).
2. No GitHub, abra a aba **Settings** (Configurações) do repositório.
3. No menu lateral esquerdo, clique em **Pages**.
4. Em **Build and deployment > Source**, selecione:
   * **Deploy from a branch**
   * Branch: **main**
   * Pasta: **/docs**
   * Clique em **Save**.
5. Pronto! Em 1 minuto seu site estará no ar no endereço:
   `https://daniloqb.github.io/BookNook/`
   E sua política de privacidade em:
   `https://daniloqb.github.io/BookNook/privacy-policy.html`
