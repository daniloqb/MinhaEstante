# MinhaEstante 2.3 — persistência OPFS e recuperação

Data: 26/10/2026. Estado: **IMPLEMENTADA COM VALIDAÇÃO PENDENTE**.
Branch: `feature/posse-independente`. Alterações anteriores foram preservadas.
Não houve geração de APK/AAB, cap sync, instalação nativa, commit, push ou release.

## Objetivo e arquitetura final

Implementar o backend de anexos Web/PWA com identidade estável, journal durável,
recuperação e preservação dos contratos da 2.2C. A interface definitiva de anexos,
leitores e player continua fora desta etapa.

A Web anteriormente usava `WebInMemoryDatabaseAdapter`: vínculos/posições não eram
persistidos entre processos. O navegador agora usa `WebPersistentDatabaseAdapter`,
que reutiliza o interpretador de linhas e os cinco repositórios existentes, com
snapshot versionado de metadados no IndexedDB. Não foi criado outro catálogo nem
outra fonte de verdade para associações. Android continua selecionando o adaptador
SQLite nativo; testes Node mantêm instâncias de memória explícitas.

`createWebDigitalLibrary` compõe provider, serviço e `DigitalAttachmentCoordinator`
existentes com o mesmo `IDatabaseService`. Seu `initialize()` procura pendências e
reconcilia recibos persistidos. Não abre seletor nem solicita persistência de forma
implícita. A composição é explícita para consumidores de anexos. Na inicialização Web, App chama
`recoverConfiguredWebStorage` em segundo plano, depois de liberar o catálogo. Somente
configuração OPFS já existente é recuperada; sem configuração, não cria namespace nem
mostra aviso. O catálogo de produção já utiliza metadados Web duráveis, sem nova tela
de importação e sem sobrescrever mensagens de ações não relacionadas.

| Responsabilidade | Implementação |
| --- | --- |
| Catálogo, anexos, posições, sessões/progresso | Snapshot `domain` no IndexedDB, com revisão CAS |
| Journal técnico e configuração OPFS | Registros separados no mesmo IndexedDB |
| Bytes e nomes internos | OPFS, UUIDs gerados pela aplicação |
| Fontes selecionadas e handles de leitura | Registro efêmero, sem promessa de sobreviver ao reload |
| Associação, substituição e desassociação | Coordenador/repositórios da 2.2C, sem duplicação de regras |
| Concorrência | Web Locks para OPFS; lock de domínio e CAS persistido para metadados |

Nenhum EPUB/PDF/áudio é gravado em SQLite, localStorage ou como Blob no IndexedDB.
As capas/backup legados mantêm os serviços existentes. Os dados legados de livros
continuam disponíveis para a migração já existente; não são removidos por esta etapa.

## Organização, versões e identidade

```text
OPFS /minhaestante/v1/
  layout.json                  marcador versionado
  staging/<UUID>.bin            bytes preparados, retidos
  committed/<UUID>.bin          bytes verificados
IndexedDB minhaestante-durable-v1 / records
  domain                       snapshot versionado + revisão
  opfs:configuration
  opfs:operation:<operationId>  intenção e recibo técnicos
```

O diagnóstico usa banco **e namespace OPFS próprios**, em perfil/origem de teste.
Nomes originais são somente metadados. Tokens/IDs são validados; caminhos de usuário
não viram nomes OPFS. Namespace existente sem marcador conhecido, versões futuras,
metadados inválidos e referências desconhecidas falham conservadoramente, sem limpeza.
O formato inicial é v1. Reabertura de v1 é coberta; não se inventou migração v0 nem
conversão de tokens SAF, que não são portáveis para navegador/WebView ou outra origem.

Após fingerprint e nova verificação, conteúdo idêntico já confirmado pode compartilhar
o mesmo token de bytes. Cada operação mantém recibo próprio. O coordenador preserva
ID lógico do anexo e a posição quando SHA-256, formato e tamanho coincidem. Nenhuma
posição é transferida para conteúdo diferente.

## Journal e confirmação

Sequência efetiva:

1. PREPARING persistido: ID da operação, UUID do arquivo proposto e metadados mínimos.
2. Validar assinatura estrutural e calcular SHA-256 incremental da fonte.
3. Persistir tamanho/hash esperados antes de criar/escrever mídia.
4. COPYING: escrever staging em chunks de 256 KiB; confirmar fechamento do stream.
5. VERIFYING: reler staging, validar tamanho/hash e registrar início da promoção.
6. Copiar para committed, fechar e reler/verificar; não presumir rename atômico.
7. FILE_READY: arquivo preparado, sem escolher livro implicitamente.
8. LINKING: recibo com UUID/ID do livro, slot, anexo proposto/anterior e decisão de posição.
9. Transação lógica dos repositórios confirma todas as linhas com uma única gravação
   CAS do snapshot no IndexedDB; falha não publica o snapshot privado.
10. Reconsulta do vínculo e confirmação do journal → COMPLETED. Somente arquivo
    confirmado é liberado para leitura normal; integridade de FILE_READY pode ser
    consultada para preparar o vínculo.

IndexedDB resolve gravações no evento `complete`, com `durability: strict`, não no
sucesso isolado de um request. Isso não cria atomicidade com OPFS. O protocolo é uma
saga recuperável: cópia/verificação ocorre fora da transação de metadados. Não há
transação longa IndexedDB enquanto mídia é copiada.

Usado `createWritable()` assíncrono com fechamento/abort apropriados. Não foram usados
SyncAccessHandle nem flush síncrono na thread principal. SyncAccessHandle foi avaliado;
exigiria Dedicated Worker e outra implementação. Não se afirmou resistência comprovada
à perda de energia ou fsync simultâneo de journal e mídia.

## Recuperação e proteção

- Registro com arquivo preparado: reler bytes reais e conferir fingerprint antes de
  promover/retornar. Falha depois de FILE_READY volta pela recuperação e limpa o estado
  de erro somente após nova verificação.
- Staging completo e íntegro: promover idempotentemente, validando destino já existente.
- Arquivo parcial/vazio ou fonte perdida: RECOVERY_REQUIRED, sem exclusão ou promoção.
  Selecionar explicitamente a mesma fonte permite retomar o mesmo ID/token; hash
  diferente não autoriza sobrescrever o parcial conhecido.
- Destino comprometido, tamanho/hash divergente ou registro contraditório: manter dados
  para revisão. Não sobrescrever um committed não vazio com conteúdo divergente.
- Recibo LINKING: o coordenador consulta metadados persistidos, inclusive UUID do livro
  e identidade do anexo anterior. Commit já realizado é reconhecido sem novo INSERT.
- Operação sem recibo não escolhe livro. Falha/falta de acesso não apaga BookAttachment.
- Identidade desconhecida não concede acesso. Exclusão física e descarte automático
  permanecem indisponíveis neste provider. Desassociação remove só vínculo/posição,
  mediante decisão explícita, e preserva bytes, outro slot e histórico deliberado.

Staging é retido inclusive após confirmação. Portanto, a ocupação pode se aproximar
de duas cópias por conteúdo, além de temporários internos do navegador. Deduplicação
confirmada evita novas cópias de conteúdo idêntico. Limpeza/poda futura exige política
de autorização e pertencimento; não foi introduzida para liberar quota nesta etapa.

## Metadados e preservação do catálogo

Cada operação de domínio carrega o snapshot atual, aplica o trabalho numa instância
privada do adaptador de linhas e confirma todas as tabelas com revisão esperada. A
comparação e gravação da revisão ocorrem juntas numa transação IndexedDB. Não existe
cache de linhas desatualizado entre abas.

Web Locks serializa o domínio quando disponível. Sem Web Locks, somente os metadados
podem usar CAS otimista: escrita concorrente desatualizada falha explicitamente, sem
sobrescrever a vencedora. O backend OPFS exige Web Locks e fica indisponível sem ele;
não usa mutex de memória como substituto entre abas. Locks são liberados pelo término
do contexto; não se gravam leases eternos.

O catálogo vazio já persistido é estado válido e não dispara nova importação do
localStorage. Fallback legado ocorre somente na primeira migração Web. Falha de leitura
do banco também não retorna uma biblioteca vazia nem dispara reimportação legada. O carregamento propaga erro para a mensagem de falha já existente no aplicativo.

Na Web, `saveAllBooksToDatabase` passou a upsert não destrutivo: atualiza linhas em vez
de clearAll/recriação, preservando anexos, posições e livros ausentes da lista recebida.
UUID diferente para o mesmo ID é conflito. Remoção deve usar fluxo explícito de exclusão
ou restauração. Isso também significa que mesclagem em lote não elimina implicitamente
um livro ausente; eventual exclusão deve ser feita de modo explícito. O ramo nativo
preexistente de lote foi preservado.

Uma proposta de exclusão dos registros ausentes foi rejeitada pela revisão automática
antes da execução. Foi substituída pelo upsert sem exclusões implícitas; nenhuma
operação rejeitada foi executada contra dados pessoais.

## Quota, persistência e mensagens

`diagnose()` consulta estimate/persisted quando disponíveis. `requestPersistence()`
exige ação explícita e devolve granted true/false. `persist()` concedido não significa
proteção contra limpeza manual. A estimativa é aproximada: serve como preflight para
duas cópias, e a escrita ainda trata QuotaExceededError real como INSUFFICIENT_SPACE.
Sem espaço, anexo/posição anteriores continuam confirmados; journal conserva pendência.
Nenhum arquivo é apagado para abrir espaço. Sem OPFS/IndexedDB/Web Locks/createWritable,
o provider informa indisponibilidade; não faz fallback de mídia para memória/localStorage.

Mensagens em `web/messages.ts` usam o catálogo de traduções existente nos seis idiomas
e cobrem indisponibilidade, quota, integridade, revisão, recuperação e persistência negada. O diagnóstico as apresenta sem exigir nova tela
administrativa. Nenhum estado técnico de journal foi adicionado à UI comum do catálogo.

## Evidências executadas

| Ambiente/verificação | Resultado |
| --- | --- |
| Vitest completo | **505 testes em 31 arquivos**, zero falhas; 42 novos em relação à base 463 |
| TypeScript / npm run lint | Aprovado |
| Kotlin/JVM, somente testDebugUnitTest | **32 testes**, zero falhas/erros/skips; sem assemble/APK |
| Web/PWA Vite production | Aprovado, saída temporária externa; sem cap sync |
| git diff --check | Aprovado |
| Chromium desktop 156, perfil isolado | **32 verificações reais** reproduzíveis aprovadas |
| Chrome Android 155, aparelho 22101316G / Android 14 API 34 | **32 verificações reais** aprovadas, somente navegador |
| Firefox desktop 158.0.1, perfil Snap isolado | **31 verificações reais** aprovadas via WebDriver BiDi; persistência interativa pendente |
| Safari | PENDENTE: ambiente ausente |
| PWA instalada | PENDENTE: não instalada/exercitada nesta sessão |

As matrizes reais cobriram EPUB/PDF/MP3 sintéticos, leitura, hash, deduplicação,
identidade/posição, coexistência, confirmação explícita, rollback de metadados,
reconciliação pós-commit, desassociação e falhas nos pontos de fingerprint, escrita,
staging, verificação, promoção e FILE_READY. Falhas foram injetadas, mas bytes,
IndexedDB e Web Locks eram reais. Isso é diferente dos doubles dos testes Vitest.

Evidências adicionais no Chromium:

- Inicialização real de `App.tsx`, além do diagnóstico: vínculo confirmado com journal
  LINKING após falha de finalização; reload do App finalizou COMPLETED em segundo plano,
  preservando um único anexo. Não dependeu de chamar recover manualmente após o reload.

- Reload realmente executado enquanto a operação estava em COPYING, pausada na
  escrita do PDF sintético de **41.943.071 bytes**. Parcial protegido; seleção explícita
  da mesma fonte retomou a operação e conferiu o hash. Snapshot de livro, vínculos,
  posições e histórico permaneceu idêntico antes/depois.
- Navegador isolado fechado e reaberto com o mesmo perfil: snapshot idêntico, leitura
  e verificação de integridade aprovadas.
- Duas abas reais disputaram o mesmo slot: uma confirmou; a outra recebeu
  ATTACHMENT_CONFLICT, com um e-book e um áudio persistidos, sem sobrescrita.
- Quota real reduzida via DevTools, mantendo a sessão aberta durante a escrita.
  Disponíveis aproximadamente 1 MiB adicionais, tentativa de 8 MiB retornou
  INSUFFICIENT_SPACE, journal RECOVERY_REQUIRED e metadados anteriores preservados.
  Apenas o preflight estimado foi desviado nesse teste para alcançar o erro real do
  navegador. Não houve preenchimento do disco físico nem limpeza de outros dados.
- `persist()` retornou false no Chromium e Chrome Android: resultado explicitamente
  tratado. A chamada interativa Firefox ficou pendente e não foi contabilizada como
  aprovada; o restante da matriz foi executado sem essa chamada.

Vitest cobre SHA-256 comparado ao node:crypto em dez tamanhos/limites, reabertura,
transações, posições, rollback, falha do journal, parciais, hash divergente, quota,
APIs ausentes, versões desconhecidas, arquivos desconhecidos protegidos e CAS entre
instâncias. Doubles não foram apresentados como evidência de OPFS/IndexedDB reais.
Os contratos Android, posse/formatos, backup, migrações e transações nativas simuladas
continuaram na suíte completa. Não houve nova validação física do app nativo nesta fase.

## Reprodução e pendências

Em perfil de teste separado, iniciar o Vite de diagnóstico e abrir
`http://127.0.0.1:3211/diagnostics/opfs.html`. Não utilizar perfil pessoal para testes
de quota/interrupção. O roteiro cria somente livros/fontes sintéticos e não apaga dados.

```sh
node_modules/.bin/vite --config vite.opfs-diagnostics.config.ts --host 127.0.0.1 --port 3211
# Chromium deve estar aberto com perfil temporário próprio e remote-debugging-port=9333.
node scripts/validate_opfs_browser.mjs 9333 http://127.0.0.1:3211
```

`diagnostics/opfs-scenarios.js` também pode ser executado no navegador via import de
módulo. O terceiro argumento `{requestPersistence:false}` separa a matriz das permissões
interativas. Safari/PWA instalada, persistência concedida, evicção real por pressão de
disco, encerramento abrupto do SO/perda de energia e quota em outros navegadores ficam
pendentes. Validar fechamento/reabertura e concorrência nesses ambientes antes de chamar
a fase concluída. Não são necessários novos APKs para esses testes Web.

## Limitações e riscos residuais

- Um único snapshot IndexedDB prioriza correção e reutilização do interpretador dos
  repositórios; não é um motor SQL geral nem otimização para catálogos gigantes.
- Garantias de fechamento/strict dependem da implementação do navegador. Não há
  transação distribuída nem garantia de recuperação após limpeza/evicção de toda a origem.
- Fonte File/Blob é de sessão; após reload pode exigir nova seleção. Um parcial não é
  declarado íntegro apenas por seu tamanho/nome.
- Validação de formato é estrutural e limitada (assinatura de EPUB/PDF/MP3/MP4), sem
  renderização, análise completa de EPUB, extração de tracks ou reprodução de áudio.
  Os arquivos sintéticos de áudio não comprovam decodificação/reprodução.
- Staging/recibos retidos consomem espaço; descarte físico continua pendente, protegido.
- A interface definitiva de anexos e integração visual de leitura permanecem futuras.
- A WebView Capacitor e o navegador não compartilham automaticamente origem/dados.
- Expurgo de histórico e tratamento dos 21 pacotes antigos são pendências da 2.2C;
  nenhuma proteção de publicação/assinatura foi relaxada nesta fase.

## Arquivos alterados nesta fase

- `src/services/storage/web/IndexedDbStore.ts`.
- `src/services/database/webPersistentDatabaseAdapter.ts` e pontos Web de
  `databaseService.ts` (snapshot e seleção de adaptador).
- `src/services/storage/digital/web/`: provider, I/O OPFS, SHA-256, composição e mensagens.
- `src/i18n/types.ts` e `translations.ts`: mensagens de armazenamento nos seis idiomas.
- `src/App.tsx` e `web/startup.ts`: recuperação Web em segundo plano, somente se configurada.
- `src/services/storage.ts`: propagação segura de falha e upsert Web preservando vínculos.
- `src/__tests__/opfs_storage.test.ts` e helper `OpfsTestBackend.ts`.
- `src/dev/opfs/main.ts`, `diagnostics/opfs.html`, `diagnostics/opfs-scenarios.js`,
  `vite.opfs-diagnostics.config.ts` e `scripts/validate_opfs_browser.mjs`.
- Este relatório, arquitetura e contexto. Arquivos anteriores da 2.2C não foram
  descartados ou atribuídos integralmente a esta entrega.

## Fontes para decisões de API

- [WHATWG File System](https://fs.spec.whatwg.org/): fechamento de streams e modelo de
  acesso; não usado como prova de teste físico de perda de energia.
- [Indexed Database API 3.0](https://www.w3.org/TR/IndexedDB/): transações e durabilidade.
- [Web Locks](https://www.w3.org/TR/web-locks/): coordenação de contextos da mesma origem.
- [MDN SyncAccessHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemSyncAccessHandle):
  API síncrona restrita a Dedicated Worker; não adotada nesta implementação assíncrona.
- [MDN estimate](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate)
  e [persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist):
  estimativa aproximada e concessão explícita, distintas das evidências executadas.

## Continuidade: validação de integração na Fase 2.4

Os resultados acima descrevem a entrega 2.3. A Fase 2.4 reutilizou este backend,
centralizou a seleção/composição e executou a suíte comum em SAF, Chromium, Chrome
Android e Firefox (48/48 por ambiente). PWA desktop e Android foram instaladas de
verdade; reabertura e offline preservaram catálogo e arquivos. O diagnóstico optativo
passou a usar o mesmo adaptador/banco/namespace do App em origem sintética. Há consulta
de retenção somente leitura; staging não foi apagado. Safari real e concessão
interativa de persistência Firefox continuam pendentes. Matriz, resultados atuais,
limites e bloqueios estão em
[MINHAESTANTE_2_4_CROSS_PLATFORM_VALIDATION.md](MINHAESTANTE_2_4_CROSS_PLATFORM_VALIDATION.md).
