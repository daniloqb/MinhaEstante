# MinhaEstante 2.0 — Fase 4.2B: exportação real DEV

Data: 30/10/2026. Branch: `feature/posse-independente`. Alterações locais das fases
4.1, 4.2A e da execução interrompida preservadas. Sem commit, push ou release.

## 1. Resultado e escopo

Exportação v2 integrada ao catálogo real e à tela de backup **somente DEV**.
Opções independentes, inicialmente desmarcadas, selecionam e-books e audiolivros.
Sem opções, chama-se o exportador v1 existente, sem alterar seu formato, serializador,
destino ou restauração. Não foi implementada restauração v2.

O v2 usa snapshot coerente, manifesto/reading da 4.1, streaming sequencial, SHA-256,
reabertura com CRC/hash, cancelamento, relatório e journal independente. Uma mídia
selecionada inacessível ou divergente aborta o fluxo; não há parcialidade silenciosa.
Sucesso significa destino reaberto e verificado **e** snapshot revalidado.

Esta entrega não certifica plataformas universalmente. Firefox só tem OPFS interno
verificado; exportação externa Web móvel continua bloqueada. Limites de 16/256 GiB
são propostas contratuais, não capacidades comprovadas.

## 2. Arquivos e responsabilidades

| Arquivo/grupo | Responsabilidade |
| --- | --- |
| `src/services/storage/backupV2/export/BackupV2ExportCoordinator.ts` | Preparar, revalidar, bloquear concorrência, conferir recibo, confirmar e relatar |
| `export/catalog.ts` | Consultar livros, anexos, posições, sessões e progresso por repositórios em snapshot curto |
| `export/prepare.ts` | Projeção imutável, capas, descritores, hashes, limites e validação 4.1 |
| `export/journal.ts` | Checkpoints duráveis próprios via IndexedDB; recuperação somente de identificação |
| `export/runtime.ts`, `export/types.ts` | Composição DEV e portas entre coordenador e plataformas |
| `web/WebExportDestination.ts`, `web/messages.ts` | Handles/Files clonados para Worker; checkpoints com ACK, progresso, cancelamento e término |
| `web/export.worker.ts` | ZIP, hashing e readback fora da thread principal |
| `zip/streamingZip.ts` | Codec compartilhado com a prova 4.2A; zip.js fixado em 2.24.0 |
| `android/NativeExportDestination.ts` | Bridge tipada; somente JSON/capas pequenos atravessam JS |
| `android/app/src/debug/java/com/booknookapp/BackupV2ExportPlugin.kt` | SAF, associação gerenciada, leitura/escrita nativa, mutex, journal e readback |
| `android/app/src/debug/java/com/booknookapp/BackupExportReadback.kt` | Cópia de verificação limitada pelo tamanho realmente escrito |
| `android/app/src/debug/java/com/booknookapp/BackupExportOwnership.kt` | CAS correto entre instâncias String distintas recebidas pela bridge |
| `src/components/BackupExportGate.tsx`, `BackupExportSection.tsx` | Gate de compilação e ambiente, opções/prévia/progresso/cancelamento/relatório |
| `backupV2/i18n/messages.ts` | Mensagens em pt-BR/en-US/es-ES/fr-FR/de-DE/it-IT |
| `src/dev/backupExport/main.tsx`, `diagnostics/backup-export.html` | Catálogo sintético separado e diagnóstico DEV |
| `scripts/validate_backup_export.mjs` | Matriz real CDP/BiDi, teclado/layout e falhas controladas |
| `scripts/verify_backup_export_artifacts.py` | Leitor independente zipfile, CRC/SHA e referências, sem extrair |
| `vite.backup-export-dev.config.ts` | Entrada explícita DEV e transferência de artefatos sintéticos para raiz marcada em /tmp |

Modificações pequenas em arquivos existentes: `SettingsBackupScreen.tsx` inclui o gate;
`MainActivity.java` registra por reflexão apenas o companion debug/ID DEV;
`database/{types,databaseService,webPersistentDatabaseAdapter}.ts` expõe leitura coerente;
`digital/web/WebOpfsStorageProvider.ts` abre File gerenciado sem hashing pesado na UI;
`scripts/build_android_saf_debug.sh` aceita o config DEV; `validate_installed_pwa.mjs`
ganha modo de backup. Documentos de contexto/arquitetura recebem adendos.

Contratos, planejamento e validadores da 4.1 foram reutilizados sem relaxar suas regras.
O antigo `experimental/streamingProof.ts` reexporta o codec promovido, preservando o
harness 4.2A. Não existe uma segunda engine ZIP Web nem novo mecanismo de associação.

Testes criados para a 4.2B: `src/__tests__/backup_v2_export.test.ts`,
`backup_v2_worker_protocol.test.ts`, `backup_v2_export_ui.test.tsx`, e os JVM
`BackupExportReadbackTest.kt`, `BackupExportOwnershipTest.kt`,
`BackupV2ExportInteropTest.kt`. Os testes de contratos e ZIP 4.1/4.2A já locais foram
preservados. `native_sqlite_transaction.test.ts` recebeu duas regressões simuladas
para execução global concorrente ao snapshot; o ensaio físico correspondente é separado.
Package.json/lockfile com zip.js já estavam alterados pela fase anterior;
esta retomada não atualizou versões de dependências.

## 3. Compatibilidade v1 e isolamento público

`backupService.ts`, bridge legada, importador, `books.json` v1 e manifesto `version:1`
permanecem inalterados. Desmarcar ambas as opções usa `legacyExport`; qualquer opção
marcada usa v2 mesmo sem anexos na categoria. A restauração v1 rejeita o discriminador
v2 existente; o ZIP novo não finge ser v1.

O gate testa a constante de compilação **no ponto do import dinâmico**. A auditoria
encontrou que importar uma constante de outro módulo permitia ao Vite emitir um Worker
órfão no build público e listá-lo no service worker. Isso foi corrigido e o build
público reconstruído, conferindo JS, nomes de assets e precache. A proteção anterior
de anexos, localhost e ID Android DEV permanece; estado React não habilita produção.

## 4. Snapshot e concorrência

Web carrega **uma revisão persistida** de domínio do IndexedDB em uma instância privada
do interpretador existente; ler não executa CAS/commit nem escreve o domínio.
Android usa o caminho estabelecido de transação isolada e mutex, com callbacks
restritos a repositórios. A transação termina antes de capas, seletor ou qualquer I/O
de mídia. Não há alteração de SQL de domínio, de esquema ou migração nova.

A leitura nativa reutiliza o mesmo executor de begin/commit/rollback e mutex, mas não
publica seu contexto no campo de reentrância global do adaptador. Somente os repositórios
que receberam o contexto podem participar. Um `execute` ou `runInTransaction` global
concorrente aguarda a leitura terminar, sem ser incorporado ao snapshot. O caminho de
reentrância das transações de escrita existentes conserva o comportamento anterior.

Livros, anexos, posições, sessões e progresso são clonados; a projeção preparada é
congelada. Um digest canônico registra todo o estado consultado, incluindo vínculos,
referências gerenciadas e timestamps. Revalida-se após preparação, antes da escrita e
antes de confirmar; Web também antes de finalizar o diretório central. Android
revalida o catálogo após o recibo nativo, podendo deixar um ZIP íntegro externamente
que será relatado como falha/conflito, nunca como snapshot confirmado.

Não se bloqueiam alterações normais ao catálogo por minutos. Mudança concorrente
detectada exige nova preparação. A comparação final é uma fronteira de observação,
não uma promessa de impedir edições posteriores à conclusão.

Web Locks bloqueia exportações entre abas; guardas em processo rejeitam submissões
simultâneas. Repetir o mesmo ID não abandona o destino da primeira chamada. Kotlin
possui ownership de processo desde o seletor até a confirmação. A destruição do
WebView cancela/drena o escritor antes de liberar ownership.

O teste físico encontrou um defeito que os testes de codec não cobriam: após confirmar
o primeiro ZIP, `AtomicReference.compareAndSet(id, null)` recebia uma String de outra
chamada da bridge. Igualdade textual não basta ao CAS; o segundo backup recebia
CONFLICT. O helper agora compara o texto e usa a referência armazenada no CAS. Foram
adicionados três testes JVM, e a matriz completa/falhas foi repetida fisicamente.

## 5. ZIP v2, mídia e histórico

```text
books.json
reading.json
covers/<book-uuid>.png|jpg|webp
media/ebooks/<attachment-id>.epub|pdf
media/audiobooks/<attachment-id>.mp3|m4a|m4b
manifest.json
```

Manifesto por último; leitores procuram por nome. Inclui formato, backupVersion 2,
backupId/data/opções, contagens, descritores de todos os payloads e mídias portáveis.
Não leva SAF URI, token OPFS, bookId de vínculo, provedor ou caminho absoluto.
`books.json` mantém os dados bibliográficos e UUIDs; capas usam caminhos do ZIP,
e URLs locais/data URLs de exibição não são publicadas. URLs https remotas continuam
metadados; não se faz download de capas externas durante exportação.

Mídias são incluídas por categoria do anexo, nunca inferidas de modalidade ou posse.
Tamanho/SHA são conhecidos do arquivo gerenciado; a leitura efetiva precisa confirmar
ambos. Omissões por escolha preservam metadados portáveis e aparecem por nome no
relatório. Arquivo selecionado sem tamanho/checksum válido ou inacessível aborta.

`reading.json` conserva sessões deliberadas e progresso de todas as obras do snapshot.
Sessões usam `bookUuid`; posições visitadas aparecem somente para mídia incluída.
Nenhuma sessão é iniciada/encerrada; nenhum status, posse, modalidade ou progresso
é atualizado pela exportação. Validação referencial usa o contrato 4.1 existente.

## 6. Android nativo e destino SAF

`ACTION_CREATE_DOCUMENT` conserva a escolha explícita de destino; ContentResolver
abre fonte e saída, sem permissões amplas, caminho absoluto, seek ou rename presumidos.
O plugin resolve mídia pelo journal gerenciado confirmado, revalidando ID do anexo,
bookId, formato, tamanho/hash e concessão persistida da árvore. Os bytes da mídia
nunca atravessam JavaScript. Somente JSON até 1 MiB e capas até 2 MiB são staged.

`ZipOutputStream`/DEFLATE nível 1, `InputStream`/`OutputStream`, SHA incremental e
buffers de 64 KiB reutilizam a engine testada na 4.2A. O hash lido deve corresponder
ao snapshot antes de o manifesto poder finalizar a saída.

Após fechar, relê-se o **documento SAF**, copiando incrementalmente para cache privado
da operação para permitir `ZipFile`. A cópia é informada na prévia e limitada aos
bytes escritos: provedor que cresce/trunca não pode gerar cópia ilimitada nem sucesso.
Hash/tamanho do ZIP relido devem ser idênticos aos escritos, e todas as entradas são
conferidas por tamanho, SHA e CRC. `ZipInputStream` não é o critério de interoperabilidade.

Espaço privado é estimado antes de escrever; não garante quota do provedor externo.
Temporários privados ficam retidos por operação para inspeção; não há limpeza de
originais nem de documentos externos. Isso consome espaço e é uma limitação explícita.

## 7. Worker Web e destinos

O seletor desktop é chamado diretamente no gesto depois da prévia. A thread principal
entrega ao Worker o handle autorizado e Files/Blobs de fontes gerenciadas; não envia
uma fila de chunks nem transfere um WritableStream presumidamente suportado.
O Worker cria o writable, usa entradas sequenciais com backpressure, buffer de entrada
64 KiB, `bufferedWrite:false`, e zip.js sem Workers internos adicionais.

O Worker faz SHA das fontes, escreve/fecha, reabre o handle, compara hash/tamanho de
todo o ZIP e confere manifesto/inventário/CRC/hashes/reading. Checkpoints duráveis e
revalidação usam mensagens com ACK. Só o coordenador pode anunciar conclusão.
Progresso é limitado a cerca de 10 atualizações/s e fronteiras de etapa.

Cancelar envia mensagem cooperativa; se o Worker não responder, há término em até
5 s. Falhas de clone, comunicação, ACK e runtime encerram a Promise e liberam o
Worker. Esse prazo não equivale a fsync/rollback garantido do provedor externo;
o resultado permanece cancelado/inconclusivo, com possível arquivo parcial.

OPFS interno foi validado como **destino de teste**, sem apresentá-lo ao usuário como
backup externo. Firefox sem seletor fica desabilitado para entrega de mídia. Não
há fallback Blob/download ilimitado. Navegadores móveis ficam bloqueados mesmo
quando anunciam File System Access; Safari não foi homologado.

## 8. Chrome Android e investigação ZIP_FORMAT

A falha da 4.2A continua bloqueadora; não se atribui culpa ao zip.js sem comparação.
O harness 4.2A disponível acrescenta diagnóstico que gera ZIP OPFS válido, publica os
mesmos bytes externamente e compara tamanho/SHA/EOCD/readback imediatamente e após
atrasos. O companion DEV também possui inspeção somente dos nomes sintéticos
`minhaestante-synthetic-external-42b*.zip` na árvore de teste já autorizada, via
ContentResolver e ZipFile independente. Nenhuma varredura de pastas pessoais.

A investigação física deve comparar ZIP interno, arquivo visto pelo browser e o
documento visto pelo ContentResolver, distinguindo truncamento/publicação e provedor.
Sem essa prova, mantém-se a exportação Web externa móvel bloqueada. OPFS aprovado
ou simples retorno de `close()` não removem esse bloqueio.

Resultado físico desta retomada:

| Observação | Bytes | SHA-256 / estrutura |
| --- | ---: | --- |
| OPFS interno | 4.519 | `1c63141b3bc1a67724a98cbee6fa54cc3ba3dc91240187a4e3375c423a320375`, válido |
| Handle externo Chrome, 0/500/1500 ms | 0 em todas | SHA de vazio, sem EOCD, inválido |
| Mesmo documento selecionado explicitamente em SAF | 4.519 | Mesmo SHA do OPFS; EOCD, 7 entradas, CRC e ZipFile aprovados |

Os bytes internos já verificados foram copiados diretamente, sem nova construção ZIP
externa. O arquivo externo real é íntegro nesse ensaio, enquanto o handle do Chrome
expõe um File de zero bytes. Isso localiza a inconsistência no caminho de reabertura
Chrome/provedor desse ambiente; não demonstra defeito do zip.js nem perda dos bytes
no documento salvo. Ainda não há correção homologada no fluxo Worker Web, portanto
a exportação externa móvel permanece desabilitada. Reabrir por seleção de novo handle
é uma hipótese para trabalho futuro, não uma capacidade implementada.

A inspeção nativa usou ACTION_OPEN_DOCUMENT somente leitura, impôs nome sintético e
limite de 128 KiB antes de ler conteúdo e retornou só tamanho/SHA/validade. A seleção
de um backup com outro nome foi recusada sem ler bytes. A varredura anterior da árvore
de teste não encontrou o documento em sua raiz e não foi ampliada para pastas pessoais.
O diagnóstico foi feito por botão/manual sem acessar o socket de abas pessoais.

## 9. Progresso, falhas, cancelamento e recuperação

Prévia: livros/capas, quantidades selecionadas, entradas, bytes conhecidos, tamanhos
desconhecidos, omissões, estimativa de quota/cache e limites DEV. A UI mostra etapa,
arquivo atual, contadores, bytes de entrada/saída e tempo. Verificação sem total usa
progresso indeterminado. Os seis idiomas incluem o aviso de restauração indisponível.

Relatório distingue verificado, falhou e cancelado; falha de reabertura significa
integridade não confirmada, sem sucesso degradado. Lista solicitadas/incluídas,
omitidas por escolha e arquivos sem inclusão confirmada. Erros de espaço, conflito,
indisponibilidade e plataforma têm mensagens próprias. Foco retorna após reabilitar
o botão, inclusive em cancelamento; checkboxes, status live e progress são semânticos.

`outputClosed` diferencia escrita encerrada de confirmação final. Worker/journal e
recibo de erro nativo propagam essa fronteira; os seis idiomas mostram explicitamente
“gravação encerrada, backup não confirmado”. Um estado fechado não vira sucesso.

Journal `backup-export:v1:` separado do journal de importação; guarda digest e etapas
sem bytes, URI ou lista de livros pessoais. Companion mantém recibo SAF privado com
destino para diagnóstico, devolvendo somente ID/etapa. Não há retomada incremental:
operações inconclusivas são identificadas, nunca regravadas automaticamente. Reiniciar
exige novo plano/backupId. ZIP parcial não é considerado backup válido nem removido.

## 10. Limites e desempenho

Teto conservador DEV Web: 129 MiB totais, entrada de mídia até 134.218.405 bytes;
Android: 101 MiB totais, mídia até 104.858.276 bytes. JSON até 1 MiB, capa até 2 MiB,
até 10.000 entradas incluindo manifesto. São limites de validação atual, não os
16/256 GiB propostos. O overhead ZIP pode aumentar a saída; quota não é reserva.
ZIP64 estrutural/65.536 entradas ficam na prova 4.2A, sem alegar payload >4 GiB.

Matriz Web integrada com PDFs pseudoaleatórios de 1 e 128 MiB, EPUB e MP3 sintéticos:

| Ambiente / padding | ZIP e-books / áudio / ambos (bytes) | Verificação+exportação no Worker (s) | Maior ping da UI |
| --- | --- | --- | --- |
| Chrome 1 MiB | 1.054.857 / 45.633 / 1.096.759 | 0,294 / 0,111 / 0,303 | 1,3 ms |
| Chrome 128 MiB | 134.224.016 / 45.633 / 134.265.919 | 20,875 / 0,106 / 20,664 | 6,1 ms |
| Firefox 1 MiB | 1.054.858 / 45.634 / 1.096.761 | 0,366 / 0,133 / 0,433 | 4,3 ms |
| Firefox 128 MiB | 134.224.020 / 45.633 / 134.265.921 | 27,127 / 0,165 / 25,255 | 7,5 ms |
| Android SAF 100 MiB, PDF sintético com zeros | 461.669 / 2.697 / 462.219 | 0,702 / 0,124 / 0,854 nativo | 48,6 ms via CDP |

Esses tempos incluem hash do ZIP e leitura integral de validação, excluindo seed e
prévia. Não são benchmark universal. Picos absolutos de heap/RSS não foram medidos
novamente; não se apresentam métricas antigas como medição desta fase. Não se retém
ZIP/mídias completos em RAM; metadados e capas pequenas ainda crescem com a seleção.
Há espaço para fontes gerenciadas, resultados e, no SAF, a cópia de verificação.

## 11. Evidências automatizadas e reais

Baseline efetivamente reexecutado na retomada: **808 Vitest/40 arquivos**, TypeScript,
builds Web público/DEV e **49 JVM**, sem falhas. O número JVM observado difere dos
47 do relatório histórico; a execução atual é a referência, sem reescrever o passado.

Final local: **821 Vitest/40 arquivos**, treze adicionais nesta retomada e 60 em relação
aos 761 da 4.2A. Cobrem seleção/v1, snapshot, referências, checksum, sessões/progresso,
posição omitida, concorrência, submissão duplicada, recibo falso, journal, cancelamento,
falhas do Worker/ACK, UI e seis idiomas; regressões anteriores continuam aprovadas.
Mocks de protocolo e streams em memória são identificados como simulados.

**58 JVM** com fixtures frescas: cinco novos de cópia nativa limitada, um de leitura
integrada Web→ZipFile e três de ownership, além dos 49 encontrados no baseline. A execução completa usa
`--rerun-tasks`, fixtures físicas do filesystem da prova, incluindo ZIP64 por contagem;
sem env de interop, o teste novo é marcado skipped em vez de simular execução real.

Uma rodada final com a raiz também usada pelo diagnóstico Android tentou abrir o
artefato **intencionalmente vazio** como fixture positiva e falhou com `zip file is
empty`. A evidência negativa foi preservada. Sem alterar teste/validador, a suíte foi
reexecutada com nova raiz de fixtures positivas; não se contou aquela rodada como
aprovação. Diagnóstico negativo e regressão positiva requerem raízes próprias.

Chrome/Firefox reais usaram perfis novos, OPFS/IndexedDB reais, três seleções cada,
progresso, cancelamento e digest de catálogo idêntico antes/depois. O diagnostic
exporta apenas três UUIDs sintéticos; a tela normal usa todo o catálogo real.
O leitor Python independente confere CRC, hashes e referências dos artefatos locais.
Quinze ZIPs integrados (seis Chrome OPFS, seis Firefox OPFS e três SAF físicos) foram
relidos por JVM/ZipFile e Python/zipfile. Os três SAF também passaram no leitor Web
zip.js/validadores da 4.1 em filesystem, incluindo descompressão/SHA do PDF de 100 MiB.

UI Chrome: 24 combinações (6 idiomas × 2 larguras × 2 escalas 100/200%), checkbox por
teclado, v1 sem seleção, prévia, cancelamento, reset das opções e retorno de foco.
Isso não substitui TalkBack/Orca. A PWA desktop foi instalada em perfil exclusivo,
aberta standalone, fechada/reaberta e recarregada offline, sempre gerando/verificando
ZIP OPFS com digest preservado. Entrega externa de PWA é verificação separada.

TypeScript e builds público/DEV/debug foram executados separadamente, sem depender de
`build` com `cap sync || true`. O build público foi inspecionado por conteúdo/arquivos.
Nenhuma sincronização Capacitor foi necessária. Avisos prévios de chunk grande e
Gradle deprecated/flatDir permanecem, sem mascarar falhas.

## 12. Matriz de destinos e evidência física

| Ambiente | Geração ZIP | Destino externo | Reabertura | SHA-256 | Situação |
| --- | --- | --- | --- | --- | --- |
| Android DEV, 22101316G/API 34 | Sim, EPUB/PDF/MP3, PDF 100 MiB | SAF real, sete seletores manuais | SAF→cache→ZipFile | Fontes, entradas e ZIP | Aprovado nos casos ensaiados |
| Chrome desktop 156 | OPFS, PDFs 1/128 MiB | Seletor real, ZIP 1.096.761 bytes | Worker/handle | Sim, CRC e SHA completos | Aprovado; externo grande não foi ensaiado |
| Chrome Android | OPFS interno válido no diagnóstico | Documento real 4.519 bytes válido por SAF | Handle do Chrome retorna zero; nativo válido | Divergência de visão, descrita acima | Externo permanece bloqueado |
| Firefox desktop | OPFS, PDFs 1/128 MiB | Seletor indisponível | OPFS/Worker | Sim | Externo desabilitado; OPFS só teste |
| PWA desktop instalada | OPFS, standalone | Seletor real, ZIP 1.096.759 bytes | Worker, fechamento/reabertura, reload offline | Sim | Aprovado no Chrome ensaiado |
| PWA Android instalada | Não repetido nesta fase | Bloqueado como Web móvel | Pendente | Pendente | Não homologada por este trabalho |
| Safari | Sem ambiente real | Não homologado | Pendente | Pendente | Pendente |

No Android, v1 foi conferido como `version:1`, três livros/uma capa, sem reading/mídias.
As três seleções v2 e o cancelamento tiveram digest do catálogo idêntico. O arquivo
SQLite DEV teve SHA-256 **idêntico** depois de exportações, falhas e atualizações
debug. A transação real concorrente mostrou que o snapshot aguarda o mutex em vez de
participar da transação alheia; o catálogo continuou igual. Não se executou migração.

Na revisão final, também se testou o sentido inverso no SQLite físico: enquanto um
snapshot está aberto, o executor global deve aguardar o mutex. A primeira tentativa
de probe com PRAGMA pelo método execute foi recusada pelo plugin (consultas exigem
query), sem alteração de dados. O probe válido usa `UPDATE books SET titulo = titulo
WHERE 0`, não alcança nenhuma linha, e confirmou `globalExecutorQueued:true`; o teste
de snapshot aguardando outra transação também passou novamente. O hash do SQLite
permaneceu idêntico. Esses probes não foram contados como novas migrações ou como
testes físicos de gravação de dados reais.

Três falhas **injetadas no plugin real**: escrita e finalização resultaram IO_FAILED;
verificação resultou INTEGRITY_MISMATCH. Todas deram falha/possível parcial, sem sucesso,
com catálogo preservado e ownership liberado para a operação seguinte. Não equivalem
a falha física de hardware/quota ou revogação real do provedor. Cancelamento foi
solicitado pelo harness a partir de progresso real; não foi gesto manual no botão.

O DEV foi reiniciado durante a investigação com seleção inconclusiva: recibos foram
reencontrados, nenhuma gravação foi retomada automaticamente e novos backups exigiram
novo ID. Perda de energia ou morte durante transferência longa continuam pendentes.

Na PWA desktop, uma segunda execução usou assets finais e janela instalada real:
ZIP externo 1.096.759 bytes, SHA `4a8bd12e5ecf531408da67b4566f26c190defbccf6899e9818b39d54af080c1e`;
depois, fechar/reabrir e reload offline ainda geraram/verificaram ZIP OPFS com o mesmo
digest. Esse resultado não é automaticamente uma homologação de PWA Android/Safari.

Comandos principais reproduzíveis (substituir raízes por diretórios novos/exclusivos):

```bash
npm test
npm run lint
node_modules/.bin/vite build --outDir /tmp/minhaestante-42b-public-check --emptyOutDir
DIGITAL_DEBUG_CONFIG=vite.backup-export-dev.config.ts GRADLE_BIN=/caminho/gradle \
  bash scripts/build_android_saf_debug.sh
BACKUP_EXPORT_ARTIFACT_ROOT=/tmp/minhaestante-4-2b-artefatos \
  node_modules/.bin/vite --config vite.backup-export-dev.config.ts --host 127.0.0.1
BACKUP_EXPORT_TRANSFER=true node scripts/validate_backup_export.mjs 9442 chrome full 134217728
BACKUP_EXPORT_ENGINE=firefox BACKUP_EXPORT_TRANSFER=true \
  node scripts/validate_backup_export.mjs 9443 firefox full 134217728
node scripts/validate_backup_export.mjs 9442 chrome ui
node scripts/validate_installed_pwa.mjs http://127.0.0.1:3425 --backup-export --external-backup --once
python3 scripts/verify_backup_export_artifacts.py /tmp/minhaestante-4-2b-artefatos
BACKUP_EXPORT_ARTIFACT_ROOT=/tmp/minhaestante-4-2b-artefatos \
MINHAESTANTE_ZIP_PROOF_DIR=/tmp/minhaestante-4-2a-fixtures \
  /caminho/gradle -p android :app:testDebugUnitTest --offline --no-daemon --rerun-tasks
git diff --check
```

Os exemplos de raiz devem respeitar as regex dos scripts (somente minúsculas na
raiz 4.2B) e ter seus marcadores sintéticos; não apontar para backups/bibliotecas reais.
ADB/Gradle/navegadores precisaram sair do sandbox por sockets/caches. O build debug
foi autorizado pelo prompt anexado e auditado antes de cada install -r. Automação de
toques ADB foi recusada pelo aparelho; nenhum INJECT_EVENTS ou acesso amplo foi pedido.

## 13. Segurança e preparação para a 4.3

Publicação continua bloqueada por materiais privados históricos. Não houve release,
commit, push, reescrita Git, troca de versão/assinatura, exclusão de backup ou limpeza
de banco. Testes usam apenas fixtures sintéticas, perfis novos e raízes marcadas em
/tmp; não se copiaram backups pessoais para código, public/ ou fixtures distribuídas.
O APK DEV auditado tem `com.booknookapp.dev`, 31/2.0-31 e mesmo certificado Android
Debug da instalação anterior; assets privados proibidos foram inspecionados.

A 4.3 pode consumir manifesto, reading e ZIPs verificados, reutilizando os validadores
e a prova de interoperabilidade. Exige plano próprio de conflitos, staging/quota,
remapeamento de identidades, commits/compensações e testes físicos. Não deve assumir
que qualquer SAF/browser lê com ZipInputStream nem que OPFS constitui entrega externa.
Tamanhos >4 GiB, Safari, leitores de tela e recuperação por morte de processo/energia
continuam pendências. Não implementar restauração com base em um manifesto sem
verificar todos os bytes e as associações na plataforma de destino.

Há base para desenvolver/testar o ciclo 4.3 nos destinos Android DEV e Chrome/PWA
desktop comprovados. O ciclo externo completo continua bloqueado no Chrome Android
por readback inconsistente e no Firefox por falta de entrega externa implementada.
Esses bloqueios não devem ser disfarçados com download Blob integral ou restauração
automática de um ZIP que não teve sua integridade confirmada.
