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
5. A Fase 2 foi subdividida: **2.1 — contratos e arquitetura**, **2.2A — seleção e permissões Android SAF**, **2.2B — cópia, integridade e recuperação**, **2.2C — integração de anexos e decisões restantes**, **2.3 — armazenamento Web/PWA**. A 2.1 e a 2.2A forneceram os contratos e seletores. A **2.2B implementa cópia gerenciada, SHA-256, journal, recuperação e associação SQLite**, validados no Android DEV. A interface definitiva e o armazenamento Web continuam pendentes. As seções de resultados anteriores são registros históricos; a seção Fase 2.4 ao final e a seção 28 da arquitetura descrevem o estado atual e os limites dos testes.
6. **Posse independente de formatos implementada antes da Fase 2.1.** O campo persistido `tenho_fisico` foi preservado como única fonte de posse, consultado por `isBookOwned`; não foi criada coluna nova. O controle “Possuo este exemplar” funciona para qualquer modalidade. Os identificadores `todos` e `meus_livros` usam somente posse para a aba visual Meus Livros. Formatos e leitura permanecem independentes; registros sem posse/status são preservados. A suíte anterior à 2.1 possui 308 testes aprovados; a compilação Java Android passou na entrega anterior, mas a validação funcional dessas mudanças em dispositivo permanece separada.

## Modelo funcional — decisões consolidadas
### Modalidades
- Um livro pode ter 1, 2 ou 3 modalidades simultaneamente: `fisico`, `ebook`, `audiolivro`.
- Os seletores são toggle; um clique marca, outro desmarca; nunca deixar zero formatos.
- O mesmo comportamento é obrigatório no cadastro, edição, detalhes e fluxo de inclusão a partir de Explorar.

### Posse
- **Modalidade não significa posse.** Livros podem ter sido lidos sem serem possuídos.
- **Posse não deve ser inferida da inclusão de `fisico`, `ebook` ou `audiolivro`.** A caixa “Possuo este exemplar” é independente e controla a participação na aba Meus Livros.
- Preservar `tenho_fisico` como única propriedade persistida de posse, com abstração `isBookOwned`. Não introduzir `possuo_exemplar` nem migração de renomeação nesta evolução contratual.
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
- **Fase 2.1 (camada contratual criada):** contratos de armazenamento, seleção/configuração explícitas, capacidades, referências opacas, erros, serviço por injeção e plano puro de associação/substituição. Sem I/O real ou integração à interface.
- **Fase 2.2A (implementação criada, validação funcional parcial no aparelho):** plugin Kotlin, seletores SAF, permissões persistíveis, metadados, configuração privada, provedor TypeScript e diagnóstico debug isolado; evidências e cenários pendentes abaixo.
- **Fase 2.2B implementada e testada no Android DEV:** cópia incremental, SHA-256, journal privado durável, recuperação, cancelamento, associação e substituição SQLite; detalhes e pendências abaixo.
- **Fase 2.2C:** interface de anexos, confirmação de substituição/remoção com posições existentes, reconciliação de arquivos já desassociados, limpeza conservadora de journal e testes em outros provedores SAF.
- **Fase 2.3:** provedor Web/PWA, OPFS ou alternativa compatível, quotas, persistência e seleção de origem com ativação do usuário.
- **Fase 3:** associar um e-book e um audiolivro na UI por livro, indicadores e filtros.
- **Fase 4:** backup com inclusão opcional de cada categoria de mídia, restauração de arquivos grandes.
- **Fase 5:** leitor EPUB e visualizador PDF com retomada.
- **Fase 6:** player de áudio, controles e retomada; no Android, avaliar Media3 para segundo plano.
- **Fase 7:** acompanhamento deliberado de leitura, status Lendo, progresso manual/digital, histórico e releituras.
- **Fase 8:** Home/Estatísticas/Continue lendo e refinamentos.
- **Fase 9:** integração, regressão e publicação.

## Resultado da Fase 2.1 — contratos de armazenamento

- Entrada pública: `src/services/storage/digital/index.ts`. Tipos canônicos de anexo/formato permanecem em `src/types/digitalMedia.ts`; `BookAttachment` e seus repositórios não foram duplicados ou alterados.
- `IDigitalStorageProvider` separa armazenamento de `IDigitalStorageInteraction` (seletores explícitos) e da extensão futura `IDigitalStorageRecovery` (pendências, provisórios e confirmação de resolução do journal).
- `DigitalFileStorageService` valida e normaliza metadados/erros, faz preflight de importação e despacha para provedores injetados. A fábrica recebe a plataforma uma vez; nenhum SDK ou provedor real é inicializado. Sem provedor concreto, retorna `PROVIDER_UNAVAILABLE`.
- `SourceFileReference`, `ManagedFileReference` e `LibraryLocationReference` são distintos e serializáveis; tokens efêmeros de leitura não substituem referências persistidas. URIs são opacas e não são convertidas em caminhos. A localização padrão não é identidade do arquivo.
- `StorageCapabilities` diferencia recurso implementado, disponível no ambiente e disponibilidade do provedor; configuração/permissão e acessibilidade de cada arquivo são consultadas separadamente.
- `SelectedDigitalFile` não contém binários nem significa importação concluída. `StoredDigitalFile` representa o contrato de confirmação recuperável pelo provedor, com tamanho e SHA-256. A validação atual é estrutural; nenhum byte é lido ou copiado por essa camada.
- `StorageResult` distingue sucesso, cancelamento e erro tipado, sem propagar mensagens/caminhos privados da bridge. Contratos permitem cópia nativa ou streams, `AbortSignal` e progresso, sem exigir arquivo inteiro em memória JavaScript.
- `planAttachmentChange` produz apenas um plano e reutiliza o argumento de `IBookAttachmentRepository.create`. Um slot ocupado exige substituição explícita com ID esperado. `IDigitalAttachmentCoordinator` é somente interface futura: não existe associação automática, saga, recuperação executável ou gravação em banco nessa camada.
- Posição visitada não é transferida na substituição. A política permanece marcada para decisão na integração. Exclusão física exige intenção e pertencimento ao registro gerenciado; desassociar/excluir livro não chama automaticamente armazenamento.
- Nenhuma tela, SQLite, migração, mutex, transação, backup ZIP ou capa foi alterada. Os novos testes usam fakes exclusivos de metadados e banco em memória; não comprovam SAF/OPFS.
- Validação da entrega 2.1: **378 testes aprovados em 26 arquivos, zero falhas**, sendo **70 novos** de contrato/arquitetura. A suíte anterior de 308 testes permaneceu aprovada, incluindo restauração/reexportação do backup histórico e persistência SQLite desktop isolada. `npm run lint` passou. Build Web/PWA via Vite passou, com aviso de bundle acima de 500 kB; saída em `/tmp`, sem `cap sync`. Não houve teste SAF/OPFS, dispositivo Android ou importação de mídia real nesta fase.
- Orientações e decisões pendentes estão nas seções 14–22 de `docs/MINHAESTANTE_2_0_ARCHITECTURE.md`: bridge Kotlin, registro/journal durável, confirmação sem pressupor rename atômico, recuperação, validação de conteúdo, concorrência na associação e política de posições.

## Fase 2.2A — implementação e limites de validação

- Plugin local `android/app/src/main/java/com/booknookapp/DigitalLibraryStoragePlugin.kt`,
  política pura `SafPolicy.kt`, registro em `MainActivity`, Kotlin 2.2.20 já presente no
  cache do ambiente e JVM 21. A bridge anterior de backup foi preservada.
- Entrada específica `src/services/storage/digital/android/`: `AndroidSafStorageProvider`
  implementa os contratos da 2.1 e usa bridge Capacitor tipada. Núcleo/serviço continuam
  sem dependência do SDK. Nenhuma composição de produção/tela de livro foi modificada.
- Implementados: seleção explícita de pasta/documento, cancelamento, metadados sem bytes,
  consulta de configuração/concessões, distinção de leitura somente, falta/revogação de
  permissão, pasta ausente e provedor indisponível, além de teste explícito de acesso.
- SharedPreferences privado `digital_library_saf_v1`: registro versionado de tokens UUID
  para árvores/origens e pasta ativa. As URIs permanecem nativas. Troca de pasta preserva
  referências e concessões antigas. Origem somente de sessão não promete sobreviver ao
  encerramento; origem com concessão persistida fica no registro privado.
- Permissões SAF persistidas somente com flags de leitura/escrita realmente concedidas e
  flag persistível; toda consulta revalida concessão e acesso do provedor. Não abre seletor
  automaticamente. Flags/capacidades declaradas não equivalem a teste de escrita efetiva.
- Diagnóstico separado em `diagnostics/`, `src/dev/saf/` e config Vite própria. Plugin
  bloqueia escrita diagnóstica sem debug + applicationId `com.booknookapp.dev`. A operação
  cria/lê/exclui somente arquivo próprio de poucos bytes; falha de limpeza fica explícita.
- Build debug passou a usar sufixo `.dev` e nome MinhaEstante DEV; ID, versão e assinatura
  de produção foram preservados. Banco, preferências e dados privados são separados pelo
  sandbox Android. `scripts/build_android_saf_debug.sh` gera somente diagnóstico temporário,
  sem importar assets pessoais ou executar `cap sync`, e não instala automaticamente.
- Manifest original preservado, sem permissões amplas de armazenamento. Manifest mesclado
  também contém biometria e permissão interna AndroidX já provenientes das dependências.
- Importação, cópia definitiva, streaming, SHA-256, leitura em leitor e exclusão gerenciada
  retornam `UNSUPPORTED_OPERATION`; sem associação a `BookAttachment`, alteração de posse,
  formatos, status, posição ou sessões. Sem alterações em SQLite/transações/migrações,
  backup ZIP, capas ou navegação de produção.
- Ajuste compatível de seleção: tamanho zero pode ser informado como metadado; importação
  conhecida como vazia continua bloqueada. Tamanho desconhecido permanece opcional.
- Verificações locais: **413 testes Vitest aprovados em 27 arquivos** (35 novos de bridge
  simulada), quatro testes JVM (três novos SAF + exemplo), tipos, Web/PWA, diagnóstico e
  Gradle debug aprovados. A regressão do backup histórico permanece aprovada. Testes JVM
  e simulados não comprovam concessões SAF no Android.
- Aparelho físico modelo 22101316G/ruby, Android 14/API 34, ADB autorizado. Primeira instalação
  `.dev` recusada pelo Android; nova tentativa confirmada pelo usuário passou. UIDs separados
  e versão/datas da instalação principal preservados. Diagnóstico aberto, plugin registrado
  e bridge real verificada: configuração ausente, rejeição de URI arbitrária, interação
  implícita, formatos vazios e diagnóstico sem pasta, com os códigos esperados. Seleção,
  cancelamento de pasta/documento, troca de pasta e persistência após `force-stop` DEV
  foram confirmados. O teste explícito escreveu/leu/removeu seu temporário antes e depois
  da reabertura. Os cinco formatos foram selecionados e suas origens reconsultadas com
  descritores de leitura após nova abertura. Duas árvores e seis origens permaneceram
  no registro; nenhum anexo foi associado a livro. Os áudios sintéticos são vazios e só
  validam seleção/metadados/acesso, não conteúdo ou reprodução. Reinício do celular
  requer autorização adicional e não foi executado.
- A remoção controlada do PDF sintético revelou cursor nulo classificado incorretamente
  como provedor indisponível. Corrigido: origem sem metadados confere somente descritor,
  sem ler bytes, distinguindo ausência de arquivo de falha de metadados. A atualização
  DEV preservou as preferências; o teste repetido retornou `FILE_NOT_FOUND` real em
  metadados e acesso. O PDF sintético foi restaurado e as seis origens voltaram a passar.
- Pendências nativas: pasta somente leitura, revogação, provedor indisponível e recriação/
  perda do processo durante seletor pendente. Testes simulados/política JVM não substituem
  esses cenários. O encerramento/reabertura após configuração foi efetivamente testado.
- Detalhes, métodos e roteiro manual nas seções 23–24 de `MINHAESTANTE_2_0_ARCHITECTURE.md`.
  Próxima etapa 2.2B: journal, cópia incremental, SHA-256, integridade, progresso/cancelamento
  e recuperação. O registro inicial de seleção não substitui essas garantias.

## Fase 2.2B — implementação e validação Android DEV

- O plugin Kotlin da 2.2A foi ampliado. `DigitalStorageCore.kt` implementa cópia e
  recuperação; `BasicMediaValidation.kt` reconhece estrutura básica dos cinco
  formatos; `AndroidMetadataFiles.kt` usa `AtomicFile` para um journal técnico
  privado, versionado e limitado. Não há nova tabela nem migração SQLite.
- `ContentResolver` lê/escreve em workers com buffer de **64 KiB**, calculando
  SHA-256 incremental. A escrita fecha antes de reabrir e conferir o destino.
  Tamanho observado e hash precisam coincidir; não há Base64 ou binários na bridge,
  banco ou localStorage. Nome físico é UUID; nome original permanece nos metadados.
- Organização na árvore escolhida: `ebooks/` e `audiobooks/`. Cada operação mantém
  sua árvore original; trocar pasta padrão não move os arquivos nem troca sua identidade.
- Journal: `PREPARING`, `CREATING`, `COPYING`, `VERIFYING`, `FILE_READY`, `LINKING`,
  `COMPLETED`, `RECOVERY_REQUIRED`, `DELETING`, `DELETED`, `DISCARDED`.
  Não se presume rename atômico. Documento só é confirmado após hash do destino.
  Se o processo morrer entre criação SAF e gravação da URI privada, `CREATING` sem
  URI permanece pendente: não localizar/apagar por nome presumido.
- `operations.ts` acrescenta a porta de journal e recibos. O provedor TypeScript
  oferece importação, metadados/acesso gerenciado, hash, progresso, cancelamento,
  recuperação e exclusão conservadora pelos contratos existentes.
- `DigitalAttachmentCoordinator.ts` associa arquivos já verificados usando os
  repositórios existentes. O recibo `LINKING` inclui ID/UUID do livro, categoria,
  novo UUID de anexo e identidade esperada do anterior. A transação é curta e
  ocorre depois da cópia. Falha SQLite preserva arquivo novo íntegro, recibo e
  anexo anterior; recuperar reconsulta o banco e é idempotente. Arquivo sem recibo
  é recuperado sem inferir livro.
- O novo método opcional `runIsolatedInTransaction` reutiliza **o mesmo mutex e
  transação nativa existentes** para impedir que coordenadores independentes
  ingressem no contexto transacional de outra chamada. O mecanismo reentrante
  legado, comandos sem transação automática e caminho de rollback foram preservados.
  Não foi criado outro gerenciador de transação.
- Substituir exige intenção/ID esperado; novo anexo tem UUID novo. O antigo vínculo
  volta no rollback e seus bytes são mantidos mesmo após sucesso. Se houver
  `ReaderPosition`, substituir/desassociar é bloqueado com `POSITION_POLICY_REQUIRED`;
  decidir a política na 2.2C. Histórico de sessões não é apagado.
- Desassociar remove somente relação SQLite. Exclusão física exige intenção explícita,
  token próprio conhecido e autorização; nesta fase só permite arquivo que nunca
  recebeu recibo de vínculo. Limpeza de arquivos anteriormente associados fica para
  2.2C. Não apagar origem, documento desconhecido, livro, posse, modalidades ou status.
- Diagnóstico continua exclusivo de `com.booknookapp.dev`, com gate nativo, fontes
  sintéticas e livro isolado. A UI de produção não foi integrada. Não há leitor/player.

**Evidências físicas:** aparelho 22101316G, Android 14/API 34, ADB autorizado.
EPUB/PDF/MP3/M4A/M4B sintéticos não vazios foram copiados, reabertos e verificados;
tracks dos áudios foram reconhecidos nativamente, sem teste de reprodução. EPUB
inválido e extensão PDF com conteúdo EPUB foram rejeitados. E-book e áudio
coexistiram no SQLite DEV e persistiram após encerrar/reabrir; posse, modalidades e
status permaneceram iguais. Substituição com falha injetada no INSERT fez rollback;
recuperação repetida concluiu uma única associação. Concorrência de transações foi
verificada na conexão SQLite nativa: rollback de uma operação não desfez a outra.

PDF de **104.858.276 bytes** passou por cópia, hash de destino e nova verificação.
Cancelamento após cerca de 7 MiB preservou vínculos e permitiu descartar só o parcial
próprio. `force-stop` somente DEV durante cópia, com cerca de 14 MiB no journal,
foi seguido de recuperação dos 100 MiB com mesmo token/hash e sem associação
implícita. Outra chamada com mesmo ID durante cópia retornou `OPERATION_CONFLICT`.
Exclusão de arquivo nunca associado foi idempotente; token/URI desconhecidos,
arquivo já vinculado e ausência de intenção foram recusados. Desassociação removeu
somente o slot escolhido e nova associação restaurou a coexistência.

**Limites:** falhas de leitura/escrita, espaço insuficiente, corrupção transitória
de leitura, tamanho desconhecido, permissão revogada e provedor indisponível foram
exercitados por injeção DEV, com erro esperado, vínculos preservados e recuperação/hash
aprovados após retirar a injeção. Isso não comprova disco realmente cheio,
revogação real ou desconexão física. Pasta somente leitura, outros provedores SAF,
posição existente no Android, reboot e perda de energia permanecem pendentes.
Morte de processo foi real; recuperação com falha de vínculo usou SQLite nativo com
falha de INSERT injetada. Testes JVM/desktop não são descritos como instrumentação.
Os limites de inspeção EPUB/MP4 e a janela `CREATING` estão detalhados na seção 25
da arquitetura, junto à matriz completa de testes.

**Verificação local:** 444 testes Vitest/29 arquivos; 23 testes JVM; TypeScript,
build Vite Web/PWA e Gradle debug. Build Web apresenta aviso de chunk grande já
existente. Sem `cap sync`, release, alteração de versão/assinatura ou commit/push.
O APK DEV usa assets separados e foi auditado sem arquivos pessoais. Existe um
ZIP já rastreado em `public/`, risco preexistente para builds Web comuns: resolver
antes de publicar; não copiar conteúdo privado para relatórios ou novos artefatos.

**Continuidade:** 2.2C deve resolver posição/limpeza/reconciliação e UI de anexos;
Web/PWA precisa de provedor e journal duráveis próprios. Backup permanece ZIP
padrão de livros/capas; mídia futura deve usar duas opções desmarcadas, streaming,
manifesto versionado e restauração que não reutilize tokens SAF de outro aparelho.

## Regras para trabalhar com agentes
- Antes de qualquer tarefa: ler `AGENTS.md`, este documento e código atual. Verificar branch, `git status`, testes e riscos.
- Diferenciar claramente o que foi relatado como concluído, o que está implementado no código e o que foi testado no Android real.
- Aplicar somente o escopo solicitado, sem reescrever o aplicativo.
- Sempre executar testes relevantes e registrar limites de validação.
- Não gerar APK/AAB, não mudar assinatura/versionCode/versionName e não fazer commits/push sem pedido expresso.
- Atualizar este documento apenas quando o usuário confirmar uma mudança de escopo ou uma fase for concluída com evidências.

## Fase 2.2C — atualização de implementação em 26/10/2026

A seção 26 da arquitetura substitui as políticas provisórias de posição e janela
CREATING da 2.2B. O escopo desta entrega é estabilização/segurança, sem interface
definitiva de anexos, leitores, player ou OPFS.

- Substituição idêntica (SHA-256, formato, tamanho e destino verificado) preserva
  IDs do anexo/posição. Conteúdo diferente exige confirmação explícita para
  invalidar posição existente; cascata e novo anexo pertencem à mesma transação.
  Falhas preservam o anexo/posição anterior. Desassociação com posição também exige
  decisão explícita. Sessões, progresso, livro e demais regras não são alterados.
- Journal AtomicFile com mutex explícito; codec v2 compatível com v1. Fingerprint,
  identificador exclusivo e subpasta são persistidos antes da criação SAF. Busca
  conservadora apenas na subpasta registrada; candidato único com identidade,
  tamanho e hash corretos pode ser recuperado. Vazios/renomeados/ambíguos ficam
  pendentes e protegidos. A janela inerente ao SAF **não foi eliminada**.
- Recuperação com recibo reconsulta SQLite. Arquivos preparados sem vínculo também
  revalidam integridade/disponibilidade. Permissão ausente não apaga vínculos.
- Arquivos anteriormente vinculados sem referências atuais entram na fila de
  revisão após recibo COMPLETED. Exclusão física destes permanece protegida,
  aguardando protocolo seguro independente da declaração da WebView e autorização
  explícita. Não há poda automática de journal nem exclusão da origem.
- ZIP pessoal e quatro textos saíram de public após preservação externa privada;
  cópias derivadas foram retiradas. Fixtures padrão agora são sintéticas; a variável
  local `MINHAESTANTE_PRIVATE_BACKUP` permite regressão histórica opcional. Guards
  bloqueiam imports/segredos em publicação e download de pacotes antigos inseguros.
  Rota do keystore removida; injeção de segredo do servidor no bundle removida.
  Histórico Git e distribuições antigas ainda exigem tratamento coordenado.
- Diagnóstico exclusivo DEV permite testar posições, histórico, falhas de INSERT,
  transação/finalização, criação SAF e revogação real. Seletor direciona a pasta
  original quando solicitado por operação DEV; escolher outra árvore não remapeia
  anexos anteriores. A aplicação principal permanece fora dos testes.

Consultar `docs/MINHAESTANTE_2_2C_VALIDATION.md` para resultados atuais, limites reais
e roteiro manual. A próxima fase Web/OPFS pode reutilizar contratos e política de
posições, mas precisa de registro/journal duráveis próprios, quotas e testes reais
no navegador. A política definitiva de descarte e outros provedores SAF continuam
pendentes; não ampliar permissões Android ou pressupor que Web prova Android.

## Fase 2.3 — OPFS em 26/10/2026

Estado: **IMPLEMENTADA COM VALIDAÇÃO PENDENTE**. Ver seção 27 da arquitetura e
`docs/MINHAESTANTE_2_3_OPFS_VALIDATION.md` para evidências/limites atuais.

Web possui provider OPFS, journal IndexedDB e metadados de domínio duráveis.
`createWebDigitalLibrary` reutiliza serviço/coordenador/repositórios da 2.2C e oferece
recuperação inicial. App verifica em segundo plano apenas a biblioteca OPFS já
configurada, sem abrir seletor ou criar namespace implicitamente. O navegador usa snapshot versionado/CAS no IndexedDB;
Android continua no SQLite existente. Não há nova UI definitiva de anexos/leitura.

Intenção e fingerprint precedem mídia; staging/committed usam UUIDs internos, cópia e
SHA-256 incrementais. Confirmar metadados é separado de confirmar bytes. Recuperar
consulta o estado persistido, preserva parciais/divergências e não escolhe livro sem
recibo. Conteúdo idêntico pode reutilizar bytes e preserva identidade/posição; troca
diferente/desassociação seguem confirmação explícita e não apagam histórico deliberado.

Web Locks protege OPFS entre abas. CAS protege o snapshot, inclusive com fallback
seguro de metadados sem Web Locks; OPFS fica explicitamente indisponível nesse caso.
Quota/persistência têm diagnóstico e resultados explícitos; não há fallback de mídia
para memória/localStorage. Lote Web agora atualiza sem clearAll e sem excluir livros
não listados, protegendo anexos/posições. Remoções precisam de fluxo explícito.

Validação: **505 Vitest/31 arquivos**, **32 JVM**, TypeScript e Web/PWA aprovados.
Matrizes reais: Chromium 32 verificações, Chrome Android físico 32, Firefox 31.
Chromium também passou por reload em cópia de 40 MiB, reabertura de perfil, duas abas
e quota real reduzida. Persistência foi negada no Chromium/Chrome Android e tratada;
a solicitação interativa Firefox permanece pendente. Safari/PWA instalada ausentes.
Não chamar testes simulados de navegador real nem JVM de instrumentação Android.

Staging/recibos seguem retidos, sem exclusão física automática; descarte/compactação
segura e testes de evicção/perda de energia continuam pendentes. Validação de formato
é estrutural, sem leitor/player ou prova de reprodução. Não houve APK/AAB, alteração
Kotlin/assinatura/permissões, cap sync, commit ou push. Pendências de histórico e
pacotes antigos da 2.2C continuam separadas e suas proteções foram preservadas.

## Fase 2.4 — integração e conformidade multiplataforma (26/10/2026)

Estado atual: implementação integrada e apta a receber a interface da Fase 3 nos
ambientes ensaiados; publicação bloqueada por privacidade histórica. Relatório e
matriz vigentes: [MINHAESTANTE_2_4_CROSS_PLATFORM_VALIDATION.md](MINHAESTANTE_2_4_CROSS_PLATFORM_VALIDATION.md).
As seções anteriores preservam os resultados de cada entrega, sem presumir encerradas
pendências Android da 2.2C por causa da implementação Web posterior.

- `platform.ts` concentra a seleção lazy SAF Android / OPFS Web e injeção explícita;
  `composeDigitalLibrary.ts` reutiliza serviço/coordenador; `startup.ts` centraliza a
  recuperação. Sem provider duplicado na composição, registro nativo na importação
  do seletor ou fallback silencioso para memória. Acesso revogado não dispara cópia.
- Auditoria confirmou catálogo/anexos/posições/sessões Web duráveis em IndexedDB pelo
  adaptador da 2.3. Testes PWA optativos usam o mesmo banco/namespace da aplicação,
  apenas em origens/perfis de teste. SQLite nativo e esquema ficaram preservados.
- 531 Vitest/33 arquivos, 32 JVM, TypeScript e builds Web/PWA/debug aprovados.
  Backup privado externo: nove testes, 215 livros/207 capas/141 possuídos/97 lidos.
  Mesma suíte runtime: 48/48 em cada SAF Android físico, Chromium, Chrome Android
  físico e Firefox; doubles não foram contabilizados como evidência física.
- Nativo: encerramento/reabertura preservou UUID, EPUB+MP3, posições e histórico;
  SHA dos dois anexos aprovado. Morte durante cópia de 100 MiB e recuperação duas
  vezes, concorrência do mesmo anexo e regressão real SQLite também aprovadas.
- PWA desktop realmente instalada: 48 checks na revisão final, fechar/relançar a
  instalação, offline na mesma sessão e atualizações de SW preservaram dados/hash.
  PWA Android instalada/reaberta pelo usuário através do ícone: standalone real,
  EPUB+MP3/posições/UUID preservados, offline com shell e hashes aprovados; atualização
  do SW mobile em primeiro plano também preservou o snapshot e o hash.
- Firefox: 48 checks, reload/hash/quota aprovados; pedido persist pendente em headless,
  sem simular concessão. Safari real ausente; roteiro/capability checks no relatório.
- Quota real reduzida e duas abas novamente ensaiadas no Chromium: domínio intacto,
  erro explícito/novo acesso após quota restaurada; conflito preservou posição vencedora.
- Retenção ganhou consulta somente de leitura. Staging/versões/recibos permanecem;
  nenhuma limpeza automática. Custo pode superar duas cópias por conteúdo.
- Pendências SAF: cancelamento efetivo do seletor, somente leitura, provedor removível,
  reboot e candidato completo sem URI continuam sem nova comprovação física.
  Evicção/perda de energia/documento definitivamente ausente não foram provocados.
- Há cinco commits com imports privados e 21 pacotes antigos afetados preservados;
  proteções HTTP/build continuam. Não reescrever histórico nem redistribuir pacotes.
  Plano de saneamento e investigação de eventual exposição de assinatura é externo.
- Fase 3 pode usar seleção/importação/progresso/associação/substituição/desassociação,
  consulta de acesso e erros tipados. `readAccess` nativo continua indisponível e exige
  capability gate. Nenhum leitor/player ou UI de anexos foi criado. Backup ZIP não
  inclui mídias; restauração de EPUB/PDF/áudio continua reservada à Fase 4.

APK debug DEV foi compilado/atualizado com autorização expressa desta tarefa;
produção preservou versão/data de atualização. Sem release, cap sync, alterações de
versão/assinatura, limpeza de dados, reboot, commit ou push.

## Interface inicial da Fase 3 — DEV (27/10/2026)

Registro da entrega 3.1; a evolução de gerenciamento está na seção 3.2 abaixo.

A interface em desenvolvimento nos detalhes de livro salvo permite adicionar um
e-book e um audiolivro usando a composição da Fase 2.4. Permanece restrita a DEV
local ou Android com gate nativo de debug; o build público exclui seu chunk.
Categorias ocupadas são somente consultadas. Não há substituição/desassociação,
filtros, leitor/player nem encerramento da Fase 3 nesta entrega.

Continuação validada com 570 testes, TypeScript e builds Web/PWA público e DEV.
Ensaio Chrome headless com OPFS/IndexedDB reais confirmou PDF+MP3 e persistência
após reload; conclusão do seletor injetada, sem comprovação gráfica/nativa.
Ensaio adicional no Android 14 físico confirmou o seletor SAF gráfico (seleções feitas
pelo usuário), cancelamento do seletor, EPUB+MP3 pela interface, dois recibos completos,
SHA-256 e preservação de UUID/metadados após encerrar/reabrir o processo DEV. Rollback
e concorrência SQLite nativos também passaram. Assets atuais foram carregados apenas
em runtime pelo cache DEV, sem atualizar pacote ou persistir configuração do servidor;
produção permaneceu com a mesma versão/data de atualização. A largura real de 392 px
CSS foi inspecionada sem overflow horizontal. Perda de acesso pela nova interface,
cancelamento durante cópia maior, outros navegadores e acessibilidade continuam pendentes.
Sem APK/AAB, cap sync, alteração SQL ou teste de backup pessoal nesta continuação.
Detalhes: [MINHAESTANTE_3_ATTACHMENTS_DEV_VALIDATION.md](MINHAESTANTE_3_ATTACHMENTS_DEV_VALIDATION.md).

## Fase 3.2 — gerenciamento DEV (27/10/2026)

Slots ocupados agora permitem substituir com confirmação, desassociar sem excluir
bytes e verificar acesso/SHA explicitamente. Conteúdo idêntico preserva ID/posição;
diferente exige confirmação da invalidação quando há posição. Sessões, progresso
deliberado, livro, posse, modalidades e status permanecem independentes. Cópias
preparadas canceladas ficam no journal, sem intenção de associação automática.

Serviço, coordenador, journal e provedores anteriores foram reutilizados. O contrato
do coordenador aceita expectativas opcionais de UUID/referência/provedor/timestamp
e categoria na desassociação para rejeitar confirmações desatualizadas. Não há SQL,
migração, backend ou mecanismo físico de limpeza novos. Não foi improvisada uma
reautorização por troca da pasta ativa: a interface orienta e permite nova verificação;
reautorização direcionada segura permanece uma decisão contratual futura.

612 Vitest/34 arquivos (42 novos, 81 de interface/gate), 32 JVM reexecutados,
TypeScript e builds público/DEV/Gradle debug aprovados. A mesma suíte de 22 checks
da seção real passou em SAF/SQLite Android físico, Chrome desktop, Chrome Android
e Firefox; conclusão do seletor foi injetada nesses cenários, mas I/O/transações
foram reais. SAF manual adicional confirmou troca idêntica de MP3 e preservou a
posição de áudio. Duas abas reais Chrome desktop/Android preservaram o vencedor.
PWA desktop instalada passou em standalone, offline, fechamento/reabertura de janela
e processo. Foco inicial, retorno, Tab/Escape e geometria foram ensaiados no WebView.

APK debug com interface efetivamente empacotada foi compilado e atualizado somente
em `com.booknookapp.dev`, conforme pedido explícito da fase, após conferir assinatura
debug idêntica. Snapshot sintético anterior preservado, sem limpeza de dados ou
alteração de versão/assinatura de produção. O build público continua sem o módulo.

Detalhes, matriz e limites: [MINHAESTANTE_3_2_ATTACHMENTS_MANAGEMENT.md](MINHAESTANTE_3_2_ATTACHMENTS_MANAGEMENT.md).
Apta a seguir para a Fase 3.3; Safari, leitores de tela, reautorização direcionada e
novos cenários SAF/PWA mobile permanecem pendentes. ZIP sem mídia, retenção conservadora
e bloqueio de publicação por privacidade histórica preservados. Sem release/commit/push.

## Fase 3.3 — validação da experiência (28/10/2026)

Relatório vigente: [MINHAESTANTE_3_3_UX_VALIDATION.md](MINHAESTANTE_3_3_UX_VALIDATION.md).
Validação funcional concluída no escopo ensaiado, com pendências explícitas;
publicação continua bloqueada. As seções anteriores são evidências históricas.

- 614 Vitest/35 arquivos, incluindo dois testes novos de capas acionáveis/decorativas;
  81 de interface/gate preservados. 32 JVM efetivamente reexecutados no baseline,
  TypeScript e builds público/DEV/Android debug aprovados, sem cap sync.
- Correções localizadas: reflow de textos/fontes ampliadas nos anexos/dialogs;
  Voltar cancela o diálogo antes dos detalhes; capas da Estante tornam-se acionáveis
  por teclado, sem mudar visual. Não há nova regra de domínio, SQL ou migração.
- 22 checks da seção real em Android SAF/SQLite empacotado, Chrome desktop/Android,
  Firefox e PWAs desktop/Android instaladas. Conclusão do seletor injetada, com I/O,
  SHA e transações reais, distinguida de interações manuais no relatório.
- 91 checks adicionais de integração/teclado no App Chrome/WebView; 432 combinações
  de idioma/largura/fonte/estado em cada Chrome, Firefox e WebView. Foco/aria/CDP
  não substituem leitor de tela. TalkBack/Orca e paisagem física permanecem manuais.
- APK somente DEV atualizado por `install -r`, assinatura debug idêntica e 31/2.0-31
  preservados. Snapshot anterior intacto; force-stop/reabertura preservou dois anexos,
  duas posições, obra e histórico, com SHA novamente aprovado e servidor `public`.
  Voltar físico usado pelo usuário cancelou só o diálogo, com snapshot idêntico.
- Revogação SAF real apenas da pasta de teste DEV mostrou permissão necessária,
  sem apagar metadados. O usuário reconcedeu acesso à mesma pasta pelo seletor
  oficial comum; snapshot e hashes preservados. Isso não cria recuperação dirigida:
  [proposta separada](MINHAESTANTE_3_3_REAUTHORIZATION_PROPOSAL.md), sem implementação.
- PWA Android instalada/fechada/reaberta pelo usuário confirmou standalone e dados.
  Offline emulado com sessão CDP contínua permitiu reload, SHA, troca e desassociação;
  rede restaurada. PWA desktop também passou por fechar/relançar e atualização de SW.
- Duas operações Web de 32 MiB comprovaram cancelamento durante cópia e navegação
  entre obras sem misturar progresso/vínculos; arquivos preparados continuam retidos.
- Safari, leitores de tela reais, outros provedores SAF, novos ensaios de cópia longa
  nativa/perda de energia e revisão linguística humana permanecem pendentes.
  ZIP padrão sem mídia; fase 4 não implementada. `readAccess` nativo ainda ausente
  exige decisão para exportação incremental futura.

Cinco commits de inclusão/alteração privada e 21 pacotes antigos afetados continuam
como bloqueios de publicação; a recontagem também distinguiu 12 árvores alcançáveis
que contêm o diretório. Não houve expurgo, release, limpeza de dados, commit ou push.

## Fase 4.1 — contratos do Backup v2 (29/10/2026)

Arquitetura e auditoria efetiva em
[MINHAESTANTE_4_1_BACKUP_V2_ARCHITECTURE.md](MINHAESTANTE_4_1_BACKUP_V2_ARCHITECTURE.md).
Implementação restrita a tipos, validadores e planejamento puros em
`src/services/storage/backupV2/`, sem integração à UI/ZIP, SQLite, SAF/OPFS ou journals.

- ZIP padrão **inalterado**: já possui manifest.json (version:1), books.json e covers/.
  Somente seleção explícita de pelo menos uma categoria usará o futuro v2; as duas
  opções recomeçam falsas a cada fluxo. Não inferir seleção por modalidade/posse.
- V2 identifica format/backupVersion:2, mantém nomes bibliográficos, acrescenta
  reading.json e media/ebooks|audiobooks/<attachment-id>.<ext>. Manifesto com hashes
  por payload, contagens, omissões e reconhecimento explícito de falhas selecionadas.
- Projeção de anexo exclui referências físicas. Restauração futura só planeja vínculo
  com novo StoredDigitalFile verificado no destino. Posição exige conteúdo/formato/hash
  correspondente; sessões/progresso são independentes de transportar mídia.
- Auditoria encontrou limites legados: merge ZIP substitui coincidências por UUID,
  ISBN13 ou origem+idExterno e reconstrói lista com clearAll; snapshot/compensação só
  de livros em replace, sem rollback integral de arquivos/histórico. Esses fluxos
  foram preservados, não promovidos a garantia segura de restore digital.
- Contratos validam versão, estrutura, FKs lógicas, paths, duplicatas, hashes, tamanhos,
  inventário bruto/limites e orçamento observado. Não leem ZIP/binários nem substituem
  verificação real, validação do parser ZIP e finalização do destino.
- Estratégia proposta: ZIP Kotlin nativo no Android; streaming Web com sink compatível
  e prova técnica de biblioteca (zip.js candidata, não instalada). ZIP64/múltiplos GiB
  não aprovados; tetos configuráveis de segurança não representam capacidade real.
- Journal coordenador composto, checkpoints e commit curto planejados, sem implementar
  journal novo. Merge/replace v2 e política de conflito/histórico exigem decisões antes
  da 4.3. Não reaproveitar tokens SAF/OPFS de outra instalação.

Validação: **722 Vitest / 36 arquivos, 108 testes novos**, preservando os 614 anteriores;
TypeScript e Web/PWA aprovados, com aviso conhecido de bundle >500 kB. Build por Vite
em `/tmp`, sem `npm run build` composto/cap sync. Nenhum JVM/Gradle ou teste físico
Android/SAF/OPFS novo nesta fase; evidências históricas permanecem separadas.
Backup privado não foi aberto. Fases 4.2/4.3 continuam sem exportação/restauração real
de mídias. Sem APK/AAB, migração, dependência nova, versão/assinatura, commit ou push.
Publicação continua bloqueada pelo histórico privado já documentado.


## Fase 4.2A — prova técnica ZIP incremental (29/10/2026)

Implementação exclusivamente experimental; detalhes, hashes, matriz e comandos em
[MINHAESTANTE_4_2A_ZIP_STREAMING_INTEROP.md](MINHAESTANTE_4_2A_ZIP_STREAMING_INTEROP.md).
Não há exportação pública v2 ou restauração de mídias. ZIP legado e domínio preservados.

- Kotlin debug: ZipOutputStream, 64 KiB, SHA/CRC incrementais, ContentResolver SAF;
  DEV atualizado por install -r com autorização explícita, ID/certificado/assets auditados.
- Web: zip.js 2.24.0 devDependency isolada, entradas sequenciais, Streams→OPFS ou sink
  externo detectado; provedores/journal existentes e namespace exclusivo sintético.
- Interoperabilidade ZipFile↔zip.js aprovada no JVM e Android físico; seis ZIPs dos
  browsers reais lidos no aparelho. ZipInputStream não aprovado no JDK21 ensaiado.
- Progressão 1/16/64/128 MiB em Chrome, Firefox e Chrome Android; SAF físico com PDF
  de cerca de 100 MiB. ZIP64 estrutural e 65.536 entradas comprovados, >4 GiB pendente.
- SAF externo e Chrome desktop pequeno aprovados. Firefox sem picker; externo Chrome
  Android parcial por ZIP_FORMAT na reabertura. OPFS não comprova entrega externa.
- Sem worker, houve pausas de segundos na thread principal: resolver antes da 4.2B.
  Definir também porta de fonte gerenciada, snapshot, destino/journal e política de parcial.
- 761 Vitest (39 novos), 47 JVM (15 novos), TypeScript, builds Web/PWA, experimental
  e APK debug DEV aprovados. Cancelamentos/falhas injetados não são provas físicas.
- Hash SQLite DEV preservado; app principal manteve versão/data. Sem SQL, migração,
  leitura de backup pessoal, release, versionamento/assinatura principal, commit/push.
  Safari, PWA instalada, perda de energia, outros provedores SAF e >4 GiB pendentes.

4.2B pode ser desenvolvida com essas restrições; ainda não foi implementada. Publicação
continua bloqueada pelo histórico privado, sem saneamento automático nesta fase.

## Fase 4.2B — exportação real exclusivamente DEV (30/10/2026)

O registro acima é histórico. Estado atual e matriz de destinos:
[MINHAESTANTE_4_2B_BACKUP_EXPORT.md](MINHAESTANTE_4_2B_BACKUP_EXPORT.md).

- Coordenador sobre catálogo/repositórios reais, snapshot curto coerente, projeção
  imutável e revalidação de livros, vínculos e leitura antes de confirmar. Sem SQL,
  esquema ou migração novos e sem transação aberta durante transferência de mídia.
- Dois checkboxes independentes/desmarcados; ambas falsas chamam o v1 existente.
  Manifesto/reading da 4.1, capas, EPUB/PDF/áudio selecionados, SHA/CRC e verificação
  obrigatória do destino antes de sucesso. Nenhuma alteração de posse/status/formatos.
- Kotlin/SAF nativo com buffers limitados e cópia privada informada para ZipFile;
  Web com zip.js 2.24.0 em Worker, handle/File, backpressure, ACKs, progresso e cancelamento.
  Journal próprio; identificar inconclusivas e reiniciar com novo ID, sem retomar/escrever
  automaticamente. Não há parcialidade silenciosa nem exclusão de documentos externos.
- Android DEV físico passou com PDF de 100 MiB, três seleções, cancelamento e falhas
  controladas de escrita/finalização/verificação; SQLite com hash idêntico e transação
  de snapshot concorrente realmente ensaiada. Corrigido CAS que não liberava ownership
  quando a bridge produzia outra instância String com o mesmo ID; três regressões JVM.
- Chrome/Firefox OPFS reais até 128 MiB, Workers responsivos; Chrome desktop externo
  e PWA desktop instalada com destino externo, reabertura e offline OPFS aprovados no
  escopo descrito. Firefox externo indisponível. Chrome Android externo reproduziu
  readback de zero bytes após close e continua bloqueado. Safari/PWA Android específicos
  e payload >4 GiB continuam pendentes; não afirmar compatibilidade universal.
- 821 Vitest, 58 JVM na validação completa, TypeScript e builds público/DEV/debug;
  15 ZIPs reais lidos por JVM e Python independentes, três SAF também pelo leitor Web.
  A constante foi movida ao ponto do import para impedir Worker órfão/precache no build
  público. DEV atualizado sem mudar 31/2.0-31/certificado; instalação principal intacta.

Restauração v2 continua reservada à 4.3. Publicação bloqueada; sem release/commit/push.
