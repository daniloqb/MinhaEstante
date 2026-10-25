# MinhaEstante — contexto de continuidade para agentes de programação

Atualização de contexto: outubro de 2026. Este documento registra decisões do projeto tomadas ao longo do desenvolvimento. O repositório local e os testes representam o estado real do código. Quando o documento descrever uma funcionalidade como planejada, **não** a presuma implementada.

## Objetivo do produto
O MinhaEstante surgiu como catálogo pessoal para registrar obras, posse, status de leitura e avaliações. Na versão 2.0 passará também a ser repositório de arquivos EPUB/PDF e audiolivros e ferramenta de acompanhamento de leitura. **Não** se pretende construir um concorrente direto do Kindle/Audible; o leitor e o player são recursos opcionais. Web/PWA e Android devem continuar utilizáveis.

## Stack e pontos de atenção
- React + TypeScript + Vite + Tailwind; Android via Capacitor e SQLite nativo (`@capacitor-community/sqlite`).
- Serviços de descoberta incluem Google Books, Open Library e outras integrações; não refatorá-los em tarefas não relacionadas.
- Há landing page de descoberta, Estante, Explorar, Estatísticas, Configurações, cadastro, edição, detalhes, filtros, empréstimos e ZIP de backup.
- O README público pode estar desatualizado; confirme o código e `docs/MINHAESTANTE_2_0_ARCHITECTURE.md`.
- Scripts conhecidos no `package.json`: `npm test`, `npm run lint` (TypeScript), `npm run build`; o build pode mascarar falha de sincronização Android, devido a `cap sync android || true`.

## Estado do desenvolvimento reportado pelo usuário
1. Melhorias de usabilidade da versão 1.1 concluídas.
2. MinhaEstante 2.0, Fase 1, reportada concluída: `BookAttachment`, `ReaderPosition`, `ReadingSession`, `ReadingProgress`; quatro tabelas novas e repositórios; migração SQLite v1→v2; campo `Book.uuid`.
3. Após a Fase 1, foram encontradas falhas graves no ZIP: deslocamento de 27 parâmetros para 25 colunas em `bulkInsert`, coerção indevida de `tenho_fisico`, criação do índice `uuid` antes da migração, deduplicação agressiva e capas corrompidas. A IA reportou correções; o usuário validou a recuperação do backup.
4. Depois apareceu no Android o erro `Execute: Failed in beginTransaction Already in transaction`, afetando todas as gravações. Foi enviado um prompt de correção de transações nativas e **o usuário confirmou que a correção funcionou**. Preserve essa estabilidade.
5. A Fase 2 (SAF/arquivos digitais) foi planejada, mas não foi confirmada como implementada.
6. Próxima alteração funcional solicitada, ainda a verificar no código: **posse independente de formatos**. Substituir o conceito de UI "Tenho fisicamente" por **"Possuo este exemplar"**. A aba **Meus Livros** deve conter só registros cuja posse foi marcada explicitamente, sejam físicos, e-books ou audiolivros. Essa mudança ainda deverá ser implementada e testada antes de prosseguir para Fase 2.

## Modelo funcional — decisões consolidadas
### Modalidades
- Um livro pode ter 1, 2 ou 3 modalidades simultaneamente: `fisico`, `ebook`, `audiolivro`.
- Os seletores são toggle; um clique marca, outro desmarca; nunca deixar zero formatos.
- O mesmo comportamento é obrigatório no cadastro, edição, detalhes e fluxo de inclusão a partir de Explorar.

### Posse
- **Modalidade não significa posse.** Livros podem ter sido lidos sem serem possuídos.
- **Posse não deve ser inferida da inclusão de `fisico`, `ebook` ou `audiolivro`.** A caixa “Possuo este exemplar” é independente e controla a participação na aba Meus Livros.
- Preservar valores históricos de `tenho_fisico` e estudar sua migração compatível para propriedade neutra como `possuo_exemplar` sem destruir backups legados.
- `status_leitura` é independente da posse: a pessoa pode marcar Lido, Quero Ler, Lendo ou Abandonado sem possuir o livro.
- Um registro sem posse e sem status não deve ser excluído automaticamente.

### Arquivos digitais
- Até **um** arquivo de e-book (`epub` ou `pdf`) por livro e até **um** arquivo de audiolivro (`mp3`, `m4a` ou `m4b`) por livro. Os dois podem coexistir.
- Anexo digital independe tanto da modalidade quanto da posse.
- Binários fora do SQLite; nele somente metadados, referências opacas e checksums.
- Android: usar SAF (seleção de pasta pelo usuário, permissões persistíveis quando concedidas, tratamento de revogação); evitar `MANAGE_EXTERNAL_STORAGE`; não usar Base64 para arquivos grandes.
- Web/PWA: adaptador próprio, OPFS/IndexedDB conforme suporte e limites.
- A importação, troca e remoção de anexos devem ser seguras ante falhas e interrupções.

### Leitura e audição
- Leitor EPUB/PDF e player de áudio opcionais, offline para arquivos localmente disponíveis.
- Guardar automaticamente última posição visitada por anexo (CFI para EPUB, página para PDF, segundos para áudio).
- **Abrir um arquivo não inicia automaticamente o estado Lendo nem mede leitura efetiva.**
- Acompanhamento é deliberado, incluindo livros físicos sem anexo; pode registrar páginas, percentual ou tempo acompanhado conforme modalidade.
- Releituras devem criar novas sessões sem apagar histórico anterior.
- A futura Home mostrará “Continue lendo” e a Estante terá filtro por anexos.

### Backup
- Backup atual (ZIP de registros/capas) permanece padrão, leve, sem binários EPUB/PDF/áudio.
- Quando a função futura chegar, oferecer dois checkboxes opcionais **desmarcados**: “Incluir arquivos de e-books” e “Incluir arquivos de audiolivros”.
- Metadados de vínculo e progresso devem ser preservados na evolução do esquema, com tratamento explícito para mídia não incluída/restauração em outro aparelho.
- Backup com áudios grandes necessita mecanismo incremental que não faça múltiplas cópias inteiras na memória.
- Compatibilidade do ZIP legado é obrigatória; manifesto do backup tem versionamento independente do esquema SQLite.

## Regressões históricas que não podem voltar
O usuário testou restauração com um ZIP histórico contendo 215 livros, 207 capas, 141 livros possuídos e 74 não possuídos, 97 lidos, 3 Quero Ler e 115 status nenhum. Os formatos do arquivo eram legados, com `formato` e `tenho_fisico`, sem exigir `formatos` nem `uuid`.

- Não forçar `tenho_fisico = true` porque o formato contém `fisico`.
- Não presumir posse de e-book/audiolivro porque o formato está selecionado.
- Verificar alinhamento de colunas e placeholders em INSERT/UPDATE/bulkInsert.
- Não mesclar registros distintos automaticamente por igualdade aproximada de título/autor durante restore de substituição.
- Preservar capas realmente extraídas do ZIP.
- Testar restauração → reexportação → restauração, inclusive UUIDs, status, notas e posse.
- Em Android, não abrir transações automáticas dentro de transações explícitas; serializar operações concorrentes e não executar dentro da transação pertencente a outra operação.
- Não limpar banco ou reinstalar o app para solucionar corrupção; proteger os dados.
- Evitar adicionar o backup pessoal original a um repositório público; usar fixtures sintéticas nos testes distribuídos.

## Fases de desenvolvimento restantes (planejadas)
- **Próximo ajuste corretivo:** independência posse/formato, etiqueta “Possuo este exemplar”, aba Meus Livros baseada apenas na posse, atualização consistente de cadastro, edição, detalhes, pesquisa, filtros, home e backups.
- **Fase 2:** infraestrutura de arquivos Android SAF e provedor Web/PWA; importação, cópia incremental, referência, checksum, substituição e remoção seguros. Sem UI definitiva de leitor.
- **Fase 3:** associar um e-book e um audiolivro na UI por livro, indicadores e filtros.
- **Fase 4:** backup com inclusão opcional de cada categoria de mídia, restauração de arquivos grandes.
- **Fase 5:** leitor EPUB e visualizador PDF com retomada.
- **Fase 6:** player de áudio, controles e retomada; no Android, avaliar Media3 para segundo plano.
- **Fase 7:** acompanhamento deliberado de leitura, status Lendo, progresso manual/digital, histórico e releituras.
- **Fase 8:** Home/Estatísticas/Continue lendo e refinamentos.
- **Fase 9:** integração, regressão e publicação.

## Regras para trabalhar com agentes
- Antes de qualquer tarefa: ler `AGENTS.md`, este documento e código atual. Verificar branch, `git status`, testes e riscos.
- Diferenciar claramente o que foi relatado como concluído, o que está implementado no código e o que foi testado no Android real.
- Aplicar somente o escopo solicitado, sem reescrever o aplicativo.
- Sempre executar testes relevantes e registrar limites de validação.
- Não gerar APK/AAB, não mudar assinatura/versionCode/versionName e não fazer commits/push sem pedido expresso.
- Atualizar este documento apenas quando o usuário confirmar uma mudança de escopo ou uma fase for concluída com evidências.
