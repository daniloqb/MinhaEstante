# MinhaEstante 2.4 — integração e conformidade multiplataforma

Data: 26/10/2026. Branch: `feature/posse-independente`.

**Implementação de integração concluída; aprovada para iniciar a interface da Fase 3 nos ambientes ensaiados. Publicação bloqueada por privacidade histórica; compatibilidade universal e recuperação por backup de mídias não estão garantidas.**

As alterações locais das fases anteriores foram preservadas. Este relatório complementa, sem substituir, os resultados históricos das fases 2.2C e 2.3. Não houve commit, push, release, alteração de versões/assinatura/ID de produção, limpeza de dados, reinstalação ou reboot. Houve compilação e atualização somente do APK debug `com.booknookapp.dev`, autorizadas expressamente na seção 17 do pedido da Fase 2.4.

## Arquitetura auditada e integrada

```text
App / futura interface de anexos
  → getPlatformDigitalLibrary() / createPlatformDigitalLibrary(injeção explícita)
  → DigitalAttachmentCoordinator + DigitalFileStorageService
  → AndroidSafStorageProvider → plugin Kotlin / SAF / journal nativo
  → WebOpfsStorageProvider → OPFS / journal IndexedDB / Web Locks

Coordenador → repositórios BookAttachment / ReaderPosition / sessões / progresso
           → SQLite nativo no Android
           → WebPersistentDatabaseAdapter + snapshot CAS IndexedDB na Web
```

`platform.ts` concentra a detecção: Capacitor Android seleciona SAF, navegador seleciona OPFS, outro ambiente nativo recebe indisponibilidade explícita. Só o módulo do provedor escolhido é carregado. A importação do módulo de seleção não registra plugin, não abre diretório nem inicia cópia; a composição também não faz I/O. O singleton é lazy, e uma inicialização malsucedida permite nova tentativa. Não há fallback de mídia ou de catálogo para memória quando a persistência esperada falha.

`composeDigitalLibrary.ts` reúne o serviço e coordenador existentes. A inicialização não recupera recibos terminais e não acessa arquivos com concessão revogada. `startup.ts` centraliza a recuperação de plataforma; o App deixa de escolher provedores em React. Na Web sem configuração de mídia, o startup retorna antes de criar namespace ou pedir persistência. Falta de API é comunicada explicitamente. A verificação de um recibo terminal continua disponível sob demanda; pular sua recuperação inicial não constitui uma nova prova de integridade.

O catálogo Web **já persistia de verdade desde a Fase 2.3**. A auditoria confirmou `DatabaseService → WebPersistentDatabaseAdapter → IndexedDB minhaestante-durable-v1`, inclusive livros, UUIDs, anexos, posições, sessões e progresso. A 2.4 não criou outro banco, outra migração ou outro coordenador. O build optativo de conformidade usa esse mesmo adaptador, banco e namespace OPFS da aplicação, dentro de origem/perfil exclusivamente sintéticos. Os bytes continuam fora de SQLite, localStorage e registros IndexedDB.

## Mudanças desta fase

| Grupo | Arquivos e alteração |
| --- | --- |
| Composição/seleção | Novos `src/services/storage/digital/platform.ts`, `composeDigitalLibrary.ts`, `startup.ts`; `web/index.ts` reutiliza a composição; `web/startup.ts` aceita fábrica assíncrona e distingue indisponibilidade |
| App/mensagens | `src/App.tsx`, `src/i18n/types.ts`, `translations.ts`, `web/messages.ts`: startup comum e mensagem de arquivo/acesso indisponível nos seis idiomas, preservando o fluxo visual existente |
| Retenção somente leitura | `web/OpfsFiles.ts`, `web/WebOpfsStorageProvider.ts`, bridge Android e `DigitalLibraryStoragePlugin.kt`: contagem de documentos/bytes conhecidos, desconhecidos e tamanhos inacessíveis, sem exclusão |
| Conformidade real | Novos `src/dev/digital/conformance.ts`, `nativeHarness.ts`, `webHarness.ts`; alterações nos diagnósticos SAF/OPFS e `DigitalStorageDevFixtures.kt` para fixtures distintas, posições, falhas e concorrência |
| Build DEV PWA | Novos `diagnostics/cross-platform.html`, `vite.cross-platform.config.ts`: catálogo real em origem de teste, nome MinhaEstante DEV PWA, marcador de atualização e assets corretos para entrada aninhada |
| Execução | Novos `scripts/validate_digital_conformance.mjs`, `validate_installed_pwa.mjs`: mesma suíte no WebView/navegadores; instalação real via CDP pipe e reabertura/offline/atualização |
| Regressão | Novos `src/__tests__/digital_platform.test.ts`, `storage_conformance.test.ts`; cobertura adicional em `opfs_storage.test.ts` |
| Documentação | Este relatório, contexto, arquitetura e adendo ao relatório 2.3 |

Dois problemas de diagnóstico foram corrigidos: seleções EPUB idênticas agora reutilizam o mesmo Blob na sessão (timestamps ZIP antes geravam bytes diferentes); o controlador SAF captura fonte/ID/AbortController por chamada, evitando que testes concorrentes compartilhem estado mutável. Não houve mudança no esquema SQLite, nas regras de posse/modalidade/status ou no formato ZIP.

## Ambientes e natureza da evidência

| Ambiente | Instalação/execução utilizada |
| --- | --- |
| Android SAF | 22101316G, Android 14/API 34, WebView 155.0.8059.43, ADB novamente autorizado; app DEV, SAF local e SQLite do plugin reais |
| Chromium desktop | Linux, Chrome headless 156, perfil novo exclusivo, `http://127.0.0.1:3214/`; OPFS/IndexedDB/Web Locks reais |
| PWA desktop | Instalada de verdade com `PWA.install`, estado do aplicativo instalado consultado, janela standalone lançada/fechada/relançada por manifest ID; perfil exclusivo via CDP pipe |
| Chrome Android/PWA | Chrome 155 no aparelho físico; `http://localhost:3214/` via ADB reverse; usuário instalou e abriu pelo ícone e depois fechou/reabriu pelo mesmo ícone; standalone real, sem emular display-mode |
| Firefox | Firefox 158.0.1-1, Linux/headless, perfil exclusivo, mesma origem 127.0.0.1:3214, automação WebDriver BiDi, OPFS/IndexedDB reais |
| Safari | Nenhum macOS/iOS/Safari físico disponível; não executado, não substituído por Chromium ou WebKit automatizado |

O APK DEV e a PWA Android são instalações distintas. `localhost` e `127.0.0.1` são origens diferentes; uma troca de porta também muda a origem. Cada navegador/perfil mantém armazenamento separado. Nenhum token SAF é interpretado pelo OPFS, nem o plugin Kotlin interpreta uma referência OPFS. Não há migração automática de arquivos entre instalações.

## Matriz de conformidade

“Aprovado” abaixo indica execução com persistência real no ambiente da coluna, no escopo descrito. Os testes automatizados com doubles estão contabilizados separadamente. Injeções DEV exercitam I/O e transações reais, mas não representam remoção física de mídia, queda de energia ou revogação do sistema operacional.

| Funcionalidade | Android SAF | Chromium | Chrome Android | Firefox | Safari |
| --- | --- | --- | --- | --- | --- |
| Importação EPUB | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Importação PDF | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Importação MP3/M4A/M4B | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| SHA-256 após recuperar/reabrir | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Vínculo e UUID persistidos | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| E-book + áudio independentes | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Substituição e rollback | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Posição EPUB/PDF/áudio | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Recuperação repetida/commit antes do journal | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Cancelamento durante cópia | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Imports/recuperações concorrentes na mesma instância | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Disputa do mesmo anexo entre operações/abas | Aprovado | Aprovado | Pendente | Pendente | Pendente |
| Encerrar processo/janela e reabrir | Aprovado | Aprovado | Aprovado | Pendente | Pendente |
| Reload com metadados e arquivo íntegros | Não aplicável | Aprovado | Aprovado | Aprovado | Pendente |
| Consulta de quota e durabilidade | Não aplicável | Aprovado | Aprovado | Aprovado | Pendente |
| Falha de quota real e novo acesso | Pendente | Aprovado | Pendente | Pendente | Pendente |
| Resultado da solicitação interativa de persistência | Não aplicável | Aprovado | Aprovado | Pendente | Pendente |
| PWA instalada | Não aplicável | Aprovado | Aprovado | Não aplicável | Pendente |
| PWA offline: shell + arquivo local | Não aplicável | Aprovado | Aprovado | Pendente | Pendente |
| Atualização do service worker preserva dados | Não aplicável | Aprovado | Aprovado | Pendente | Pendente |
| Documento definitivamente ausente/evicção real nesta fase | Pendente | Pendente | Pendente | Pendente | Pendente |

O teste desktop de PWA foi headless: reabertura pela identidade instalada, sem clique humano em ícone gráfico. No Android houve a interação manual solicitada ao usuário. Firefox passou no reload com vínculo e hash, mas não foi encerrado/reaberto como processo nesta fase. “Não aplicável” em PWA Firefox descreve o ambiente utilizado, não uma promessa sobre extensões ou futuras versões.

## Suíte comum e invariantes

`runDigitalConformance` executou **48/48 verificações em cada um dos quatro ambientes reais**: SAF Android, Chromium, Chrome Android e Firefox. A PWA desktop instalada também executou a revisão final de **48/48**, seguida de fechamento/relançamento e offline com metadados e hash preservados. A revisão anterior de 46 checks foi utilizada nos ensaios adicionais de atualização do service worker.

A mesma função verifica os cinco formatos, leitura/verificação por SHA-256, recuperação duas vezes, inválido, tamanho declarado desconhecido, EPUB+MP3 no mesmo livro, troca idêntica preservando identidade/posição, mudança de conteúdo exigindo confirmação, rollback de metadados, recuperação após rollback, confirmação do vínculo antes da conclusão do journal, desassociação só de áudio, cópia interrompida, cancelamento e operações concorrentes.

Para EPUB CFI, PDF página e MP3 tempo: conteúdo idêntico preservou posição e ID; diferente exigiu `invalidate-current`; falha de commit preservou o snapshot anterior; recuperação só invalidou posição ao confirmar a associação. Sessões e progresso deliberado não foram removidos ou reiniciados. O outro slot, livro inteiro, posse, modalidades, status, avaliação e histórico foram comparados. Fixtures de formato são sintéticas: o armazenamento/validação estrutural foi ensaiado, sem provar leitura ou reprodução por um leitor/player ainda inexistente.

O contrato Vitest novo roda assertions iguais contra OPFS em memória e bridge Android simulado, incluindo SHA calculado independentemente com Node crypto. **Não comprova SAF nativo.** O suite runtime comum usa adapters dos diagnósticos, com bytes, SQLite/IndexedDB e provedores físicos reais.

## Persistência, PWA e offline

- **Nativo:** livro sintético com EPUB+MP3, posições dos dois tipos e sessão/progresso foi consultado antes/depois de force-stop somente DEV. Snapshot e UUID exatos preservados; SHA-256 dos dois anexos aprovado. A reabertura após o ensaio de desassociação também preservou o estado final do livro.
- **PWA desktop:** instalação real, 48 verificações na execução final, fechamento da janela instalada e relançamento da mesma identidade: snapshot idêntico e SHA aprovado. Offline emulado na mesma sessão CDP, `navigator.onLine === false`, reload e arquivo íntegro. Atualizações de builds de teste `first → third → second` preservaram metadados e bytes; marcadores confirmados após reload. Marcadores são apenas identificadores do teste, não versões do aplicativo.
- **PWA Android:** usuário confirmou instalação/abertura e depois fechamento/reabertura pelo ícone. Dois anexos EPUB+MP3, posições, sessão/progresso, UUID e snapshot preservados; ambos os hashes verificados. Em sessão CDP mantida aberta, offline verdadeiro, standalone e controle por SW confirmados, diagnóstico recarregado e tela principal renderizada; ambos os arquivos verificados. Rede restaurada ao terminar. Atualização do service worker para o build de teste `second`, depois de trazer a PWA ao primeiro plano, preservou snapshot, standalone e SHA do anexo atual; uma tentativa em segundo plano expirou e não foi usada como aprovação.
- **Firefox:** 48 verificações; reload do diagnóstico preservou UUID, vínculo e arquivo, SHA aprovado. Consulta de estimate/persisted/persist executada. `persisted:false`; o pedido de persistência continuou pendente após 5 s no ambiente headless e foi interrompido pela navegação. Não foi registrado como concessão nem como negativa confirmada.

Uma primeira tentativa mobile de emular offline em sessões CDP curtas foi descartada como evidência: a condição de rede termina ao desconectar. O teste válido manteve a conexão durante emulação, reload, consultas e restauração. Não houve desligamento físico de Wi-Fi/dados móveis; isso permanece diferente de um ensaio com rádio desconectado.

Offline cobre o shell já instalado/cacheado e anexos locais. Busca externa, IA, capas remotas e primeira instalação sem rede não foram aprovadas. Service worker atual não faz limpeza do OPFS/IndexedDB; sua atualização não é backup. A PWA não promete armazenamento permanente, mesmo se `persist()` for concedido.

## Quota, journal e concorrência

**Quota Chromium real:** em origem/perfil somente sintéticos, CDP reduziu quota para utilização + 1 MiB; uma importação PDF de 8 MiB ultrapassou a quota real do navegador. Apenas a estimativa consultiva de preflight foi omitida no diagnóstico para atingir a falha de gravação. Resultado `INSUFFICIENT_SPACE`, journal `RECOVERY_REQUIRED`, livro/anexos/posições/histórico intactos. Duas recuperações permaneceram explicitamente pendentes, sem inventar arquivo completo; após restaurar quota, nova operação importou e verificou o arquivo. Estimativa e quota foram restauradas. Não equivale a encher o disco ou testar evicção real.

**Duas abas Chromium:** substituição perdedora pausada em `linking`; outra aba confirmou uma troca, depois gravou nova posição. Liberar a primeira retornou `ATTACHMENT_CONFLICT`: um único e-book, posição vencedora e histórico intactos. Nenhum byte foi removido. Não se presume transação atômica entre OPFS e IndexedDB.

**Android físico:** duas substituições simultâneas do mesmo slot produziram um sucesso e `OPERATION_CONFLICT`, mantendo um e-book, livro e histórico. Regressão de SQLite nativo: uma transação com rollback e outra concorrente com transação aninhada; rollback preservado e a outra alteração efetivamente confirmada. O adaptador SQLite estabilizado não foi modificado nesta fase.

**Morte real do processo DEV:** observado COPYING de PDF de 104.858.276 bytes, progresso de 65.536 bytes; force-stop DEV e nova abertura. Recuperação recopiou/verificou a fonte persistida, retornou FILE_READY; repetir retornou o mesmo token/hash sem vincular o arquivo a outro livro. Snapshot preservado. Não representa reboot, corte de energia ou resiliência a bugs de um provedor de nuvem.

| Janela de falha | Evidência e limite |
| --- | --- |
| Antes da cópia/intenção | Testes JVM e Vitest; falhas físicas DEV registradas na 2.2C, não todas repetidas na 2.4 |
| Durante escrita | Falha DEV com backend real nos quatro runtimes; morte de processo real adicional Android; reload Chromium durante cópia registrado na 2.3 |
| Bytes completos sem vínculo | Importação sem associação + recuperação repetida nos quatro runtimes, sem escolher livro implicitamente |
| Vínculo confirmado/journal incompleto | Falha DEV de finalização e reconciliação do vínculo real nos quatro runtimes |
| Falha de substituição/commit | Injeção antes de commit SQLite/IndexedDB e snapshot anterior preservado nos quatro runtimes |
| Falha durante recuperação | Vitest/JVM; quota real Chromium manteve duas recuperações pendentes sem corromper domínio |
| Acesso temporariamente indisponível | Contratos/falhas injetadas; revogação real e reautorização SAF comprovadas na 2.2C, não repetidas nesta fase |
| Documento definitivamente ausente/evicção | Cobertura automatizada; novo ensaio físico nesta fase pendente, sem apagar arquivos para forçar o cenário |
| Mutex/locks perdidos ou indisponíveis | Vitest/JVM e matriz da 2.3; proteção entre duas abas novamente exercitada no Chromium; perda forçada de lock nesta fase pendente |

Pendências da 2.2C permanecem abertas: cancelamento SAF com retorno efetivo `USER_CANCELLED` não comprovado (a tentativa manual retornou success), pasta física somente leitura, provedor removível/nuvem indisponível, reboot manual e adoção de candidato completo criado antes da URI. Casos ambíguos continuam protegidos, sem adoção ou descarte automático. A implementação Web posterior não encerra essas pendências Android.

## Retenção e custo de espaço

Consulta somente de leitura, sem classificar arquivo como descartável por ausência de vínculo atual:

| Amostra local de testes | Resultado observado |
| --- | --- |
| Android DEV, após ensaios desta fase | 94 registros de journal; 89 documentos conhecidos; 420.527.218 bytes consultáveis; 2 documentos inacessíveis/tamanho desconhecido; 38 recibos protegidos |
| Chromium, após quota e duas abas | 22 staging / 19 committed; 8.392.922 bytes em cada área; nenhum nome desconhecido na amostra |
| Firefox, após reload | 17 staging / 15 committed; 3.252 bytes em cada área; nenhum nome desconhecido na amostra |

As amostras não são totais permanentes: executar novamente os testes cria novos recibos e arquivos. Contagem SAF só cobre documentos registrados no journal e não inclui fontes/arquivos fora dele; quantidade inacessível não prova exclusão. Inventário OPFS verifica o marcador de layout e enumera apenas as duas áreas próprias, sem expor nomes desconhecidos. `physicalDeletionAuthorized:false` em ambos.

Staging + committed podem custar aproximadamente duas cópias completas, além de parciais, fontes e versões substituídas. Desassociar não libera espaço automaticamente. A política conservadora/rejeição anterior da limpeza em lote foi preservada.

Limpeza futura exige provar propriedade por token/layout/recibo, verificar referências ativas e operações concorrentes/pendentes, manter evidências necessárias à recuperação, apresentar lista/tamanhos para revisão e obter autorização explícita para arquivos comprovados. Falta de acesso, recibo sem vínculo atual, idade ou nome desconhecido não autorizam exclusão. Não foi criada limpeza automática, compactação ou exclusão em massa.

## Compatibilidade pendente e roteiro reproduzível

Preparar **perfil e origem novos exclusivamente sintéticos**, sem fixture pessoal. Build/preview optativos:

```bash
DIGITAL_TEST_BUILD=first node_modules/.bin/vite build --config vite.cross-platform.config.ts --outDir /tmp/minhaestante-conformance-pwa --emptyOutDir
node_modules/.bin/vite preview --config vite.cross-platform.config.ts --outDir /tmp/minhaestante-conformance-pwa --host 127.0.0.1 --port 3214
# Abrir /diagnostics/cross-platform.html no perfil de teste.
# Com Chrome DevTools local em 9333:
node scripts/validate_digital_conformance.mjs 9333 http://127.0.0.1:3214
# PWA desktop instalada, executar com stdin interativo:
node scripts/validate_installed_pwa.mjs http://127.0.0.1:3214
```

No runner PWA, após os checks iniciais, reconstruir com `DIGITAL_TEST_BUILD=second` na mesma saída; enviar `update` e depois `close`. O runner mantém o perfil sintético, não apaga dados. `--emptyOutDir` se refere apenas aos assets compilados temporários, nunca ao perfil, IndexedDB, OPFS ou SAF. Para Android nativo usar assets isolados e `scripts/build_android_saf_debug.sh :app:testDebugUnitTest` com JDK21/Gradle configurados; conferir `com.booknookapp.dev` antes de instalar. Encaminhar a porta CDP ao WebView DEV e executar a mesma suíte com origem `https://localhost`. Nunca apontar esses diagnósticos ao catálogo pessoal.

**Safari macOS/iOS:** usar Safari real atualizado, em origem HTTPS de teste ou localhost apropriado. A evolução de WritableStream está registrada na [fonte WebKit](https://bugs.webkit.org/show_bug.cgi?id=231706) e nas [notas Apple Safari 26](https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes). Essa informação não aprova a aplicação. Inspecionar `isSecureContext`, IndexedDB, `navigator.locks.request`, `navigator.storage.getDirectory` e `FileSystemFileHandle.prototype.createWritable`; a aplicação exige todos para oferecer OPFS. Ausência deve retornar `PROVIDER_UNAVAILABLE`, sem sucesso fictício ou memória volátil. Não assumir que versões antigas com acesso ao OPFS também suportam a escrita usada aqui.

Em Safari compatível, chamar `runDigitalConformance()` no console do diagnóstico; conferir todos os checks, reload, encerrar/reabrir, hashes, pedidos de persistência, duas abas e PWA instalada/offline. Registrar versões reais e concessões. iOS precisa de HTTPS acessível pelo aparelho; não usar certificado inválido como evidência de contexto seguro. Persistência e PWA iOS precisam de ensaios próprios.

**Firefox interativo:** abrir o mesmo diagnóstico em Firefox gráfico com perfil dedicado; clicar uma vez em “Solicitar persistência”, responder ao prompt se existir, registrar o resultado e executar `diagnose()`. Negativa deve permitir importação normal e mostrar a limitação; API ausente deve retornar operação não suportada. Não repetir continuamente o pedido ou simular grant. Recarregar e verificar `persisted()` novamente. Encerrar/reabrir o processo e testar offline continuam pendentes nesta fase.

**Perda de acesso e documento ausente:** usar apenas pasta/provedor e arquivos sintéticos identificados, registrar snapshot e hash antes; revogar/restaurar concessão pelo fluxo DEV manual ou desconectar/reconectar mídia de teste; confirmar erro e snapshot preservado. Teste de ausência definitiva requer escolha explícita de um arquivo sintético, sem exclusão em lote ou limpeza da biblioteca. Não automatizar reboot/limpeza do aparelho.

## Segurança e regressão histórica

Auditoria repetida: nenhum backup/import privado ou material de assinatura na pasta pública atual; nenhum arquivo de chave rastreado identificado. Bundle Web normal não contém diagnósticos runtime ou imports privados. Via HTTP local, rotas de chave (inclusive codificada), import privado e pacotes antigos retornaram 404; health/favicon retornaram 200. As proteções anteriores do servidor e Vite foram preservadas.

**Bloqueio para publicação permanece:** cinco commits no histórico contêm o antigo diretório de imports privados; 21 pacotes locais antigos ainda contêm caminhos desses imports (22 pacotes na auditoria incluindo o novo DEV seguro). Foram preservados e não republicados. Remoção da árvore atual e bloqueio HTTP não removem clones, caches ou downloads anteriores. Nenhum expurgo de histórico foi autorizado/executado. Uma antiga rota de assinatura existiu; não há prova de acesso anterior nem material atual na raiz, portanto investigar logs de hospedagem/distribuição e, se confirmada exposição, coordenar tratamento da chave/credenciais com os serviços responsáveis. Não imprimir segredos ou redistribuir pacotes para investigar.

Plano externo antes de publicar: retirar distribuições afetadas, inventariar caches/clones, preparar expurgo coordenado do histórico com autorização própria e avaliar credenciais eventualmente expostas. Preservar as cópias privadas autorizadas e os dados do usuário. Nenhuma dessas pendências foi “resolvida” apagando dados ou reescrevendo Git nesta fase.

O backup histórico privado externo foi exercitado sem copiar para public/repositório: **215 livros, 207 capas, 141 possuídos e 97 lidos**, ciclo importar → persistir → exportar → reimportar. Nove testes específicos passaram. ZIP padrão e backups legados permanecem compatíveis. **O backup atual não inclui EPUB/PDF/áudio**; recuperação de mídias entre instalações depende da Fase 4, com opções futuras desmarcadas por padrão.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| Vitest completo | **531 testes / 33 arquivos, zero falhas**; base 505, 26 checks adicionais |
| Contratos novos com doubles | 16 testes dentro dos 531; não são prova física |
| Composição central nova | 9 testes dentro dos 531; startup OPFS tem um caso adicional de indisponibilidade |
| Kotlin/JVM | **32 testes**, zero falhas/erros; backend de teste, não instrumentação Android |
| Backup privado/posse | 9 testes específicos adicionais executados com fixture externa autorizada |
| Runtime comum SAF Android | **48/48**, SAF + SQLite reais |
| Runtime comum Chromium | **48/48**, OPFS/IndexedDB reais |
| Runtime comum Chrome Android | **48/48**, aparelho físico |
| Runtime comum Firefox | **48/48**, navegador real |
| PWA desktop instalada | 48/48 + fechar/relançar + offline; duas atualizações adicionais na revisão anterior com hashes/snapshots |
| PWA Android instalada | Instalação/reabertura manuais + snapshot/UUID/EPUB/MP3 + offline + atualização do service worker preservando dados |
| TypeScript | `npm run lint` / tsc aprovados |
| Web e PWA | Build Vite normal e build optativo de conformidade aprovados, saída temporária |
| Android debug | `assembleDebug` + `testDebugUnitTest` aprovados offline, JDK21, assets isolados |
| Aplicativo principal | Versão e data de atualização iguais antes/depois, sem instalar/limpar/desinstalar a produção |
| git diff --check | Aprovado |

O build foi validado por tsc/Vite diretamente e Gradle separadamente; não se executou o `npm run build` composto que mascara erro de cap sync. Não houve cap sync. Permanecem avisos não fatais de chunk acima de 500 KiB e APIs Gradle obsoletas. Houve tentativas de diagnóstico inconclusivas (sessão offline curta, fixture EPUB com timestamps e atualização mobile em segundo plano); não são checks aprovados. Os problemas de método/fixture corrigidos foram repetidos; pendências reais estão explícitas na matriz.

Evidências detalhadas locais desta sessão ficam sob `/tmp/minhaestante-24-*`: `*-final-conformance.json`, `native-persist-before/after.json`, `native-process.json`, `native-extra.json`, `installed-pwa-final.log`, `installed-pwa-complete.log`, `android-pwa-before/after.json`, `android-pwa-offline-final.json`, `android-pwa-update.json`, `firefox-conformance.json`, `firefox-verified.json`, `quota.json`, `tabs.json`, logs `*-complete-build.log` e `full-final.log` e `web-clean-build.log`. São temporárias, não arquivos pessoais/fixtures a publicar. As conclusões e limites permanentes estão registrados neste relatório.

## Prontidão formal para a Fase 3

**Aprovada para desenvolver a interface de anexos nos ambientes validados**, usando o coordenador existente e consulta de capacidades, mantendo publicação bloqueada pelas questões acima. Compatibilidade Safari, provedores SAF adicionais e recuperação por backup de mídia não estão aprovadas. Não declarar infraestrutura pronta para produção universal.

A interface pode preparar `getPlatformDigitalLibrary()` ao montar; no clique chamar `service.requestConfiguration()` / `selectSource()` antes de qualquer await alheio para preservar ativação do usuário. `service.importFile()` recebe ID idempotente, `AbortSignal` e progresso; `coordinator.applyChange()` associa/substitui com `expectedAttachmentId` e decisão explícita para posição; `coordinator.detach()` preserva bytes; repositórios consultam anexos/posições; `checkAccess()`, `getMetadata()` e `verifyIntegrity()` distinguem indisponibilidade, identidade e integridade; `initialize()` / `recover()` reconciliam pendências. Mostrar erros tipados e explicar a limitação de durabilidade sem prometer arquivo recuperável por backup.

`acquireReadAccess/releaseReadAccess` existem no contrato e funcionam no OPFS; **consumidor de leitura nativo permanece indisponível (`readAccess:false`)** e deve ser condicionado à capability. Isso não bloqueia a interface de anexos da Fase 3, mas abrir leitor/player exige implementação posterior. Seleção SAF, persistência do navegador e referências opacas continuam encapsuladas nos provedores.

Permanecem fora da interface desta fase e sem promessa de recuperação: leitores EPUB/PDF, player/Media3, navegação nova, acompanhamento automático, sincronização, migração de arquivos e limpeza física automática. **Restauração de mídias pelo backup deve continuar bloqueada até a Fase 4.**
