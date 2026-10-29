# MinhaEstante 2.0 — Fase 3.3: validação da experiência de anexos

Data: 28/10/2026. Branch: `feature/posse-independente`.

## Decisão e escopo

**Validação funcional concluída no escopo dos ambientes abaixo, com pendências
explícitas de acessibilidade manual e de compatibilidade. Publicação bloqueada.**
Não foi implementada a Fase 4. Não há leitor, player, novo armazenamento, limpeza
física, SQL/migração, mudança do ZIP ou alteração de versão/assinatura principal.

Foram exercitados Android DEV empacotado, Chrome desktop, Chrome Android, Firefox,
PWA desktop instalada e PWA Android instalada. Safari real não está disponível.
Nenhum P0/P1 funcional conhecido ficou aberto nos fluxos declarados validados;
isso não aprova leitores de tela, todos os provedores SAF ou produção universal.

## Baseline e método

- Árvore inicialmente limpa, na branch acima. Nenhum commit/push.
- Lidos `AGENTS.md`, contexto/arquitetura 2.0 e relatórios 2.4, 3.1 e 3.2;
  inspecionados gate, detalhes, apresentação, coordenador, contratos, repositórios,
  SAF/OPFS, journal, diálogos, traduções e scripts.
- Baseline executado antes das correções: **612 Vitest / 34 arquivos**, zero
  falhas; TypeScript aprovado. Os avisos de chunk, flatDir, SDK XML e depreciações
  Gradle já existiam; não foram tratados como regressões novas.
- ADB inicialmente sem aparelho. Após conexão pelo usuário: modelo **22101316G**,
  Android **14/API 34**, DEV debug **31/2.0-31**, com dados existentes preservados.
- Chrome desktop **156.0.8078.47**, Firefox **158.0.1**. Perfis desktop novos e
  sintéticos; origem exclusiva `127.0.0.1:3383`. No Android Chrome/PWA, origem
  exclusiva `localhost:3383`, encaminhada por ADB, sem consultar outras origens.
- Os cenários usam a mesma `DigitalAttachmentsSection` e, na integração, o próprio
  `App`/`BookDetailScreen`. Não foi criada outra UI nem outro gerenciador de operações.

## Correções e classificação

| Severidade | Reprodução e causa | Correção | Reteste / situação |
| --- | --- | --- | --- |
| P2 | Texto/controles transbordavam com fonte a 200%, especialmente em 320 px. A matriz inicial encontrou 22 combinações com overflow entre 144 amostras da seção. Larguras intrínsecas e palavras longas não respeitavam o espaço disponível. | Quebra de palavras herdada somente na seção/dialog; controles com `min-w-0`/`max-w-full`; ícones dos títulos não encolhem. | 432 combinações por Chrome, Firefox e WebView DEV sem overflow detectado. Resolvido. |
| P2 | Voltar chamava o fechamento dos detalhes mesmo com `<dialog>` aberto. A reprodução anterior à correção deixou `detailsStillOpen:false`. | O manipulador existente de navegação primeiro despacha `cancel` para o diálogo; respeita sua política de cancelamento. | Callback real do App e botão/gesto físico usado pelo usuário fecharam só o diálogo; snapshot idêntico e foco em Desassociar. Resolvido. |
| P1 preexistente | Capas da Estante usavam `div` clicável sem nome/papel/tab stop nem ativação por teclado; títulos do modo Lista também dependiam de clique no card. Impedia chegar aos detalhes por teclado nesse caminho. Não foi introduzido pela Fase 3.3. | Sem alterar o visual, capas acionáveis recebem papel de botão, nome título/autor, Tab e Enter/Espaço; capas decorativas continuam fora da ordem. O título no modo Lista recebe botão nativo, sem duplicar o clique do card. | Dois testes SSR novos e abertura por teclado nos caminhos Meus Livros/Lidos/Emprestados e modos Capas/Lista no Chrome e WebView. Resolvido. |

Não houve falha conhecida de perda de vínculo, UUID, arquivo ou posição sem
confirmação. Os problemas de layout e Voltar também já estavam no baseline;
a nova matriz revelou lacunas de cobertura anteriores, não regressões causadas
pelas correções desta fase.

## Matriz funcional desta revisão

Cada aprovação vale para o método descrito a seguir. **Seleção injetada não é
validação gráfica do seletor**; JVM/Vitest não são instrumentação Android.

| Cenário | Android DEV | Chrome desktop | Chrome Android | Firefox | PWA desktop | PWA Android | Safari |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Abrir detalhes | Aprovado | Aprovado | Parcial | Parcial | Parcial | Aprovado | Pendente |
| Visualizar anexos | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Importar EPUB | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Importar áudio | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Substituir idêntico | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Substituir diferente | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Preservar posição | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Invalidar posição | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Desassociar | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Verificar SHA | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado | Pendente |
| Cancelar | Parcial | Parcial | Parcial | Parcial | Parcial | Parcial | Pendente |
| Reabrir aplicativo | Aprovado | Aprovado | Parcial | Parcial | Aprovado | Aprovado | Pendente |
| Permissão indisponível | Aprovado | Não aplicável | Não aplicável | Não aplicável | Não aplicável | Não aplicável | Pendente |
| Offline | Parcial | Parcial | Parcial | Pendente | Aprovado | Aprovado | Pendente |
| Acessibilidade | Parcial | Parcial | Parcial | Parcial | Parcial | Parcial | Pendente |
| Responsividade | Aprovado | Aprovado | Parcial | Aprovado | Parcial | Parcial | Pendente |

Limites das células:

- **22 verificações comuns** da seção real passaram em cada um dos seis ambientes.
  Clicam em adicionar/substituir/verificar/desassociar; injetam explicitamente a
  conclusão do seletor com fontes sintéticas. Cópia, hash, journal, OPFS/IndexedDB
  e SQLite nativo são reais. A falha antes de commit é uma injeção, com rollback
  na transação real, não uma queda de energia.
- Detalhes/integração completos foram percorridos no App em Chrome desktop e
  WebView; a PWA Android também abriu o livro correto pela Home após o offline.
  Firefox/PWA desktop/Chrome Android exercitaram principalmente a seção real no
  diagnóstico; isso explica as células parciais de integração.
- Cancelar confirmação foi aprovado em todos. Cópia cancelada foi exercitada de
  novo no Chrome desktop; cancelamento gráfico do seletor e cópia nativa longa
  não receberam nova comprovação nesta revisão. Não são aprovados por herança da 3.2.
- Reabertura nativa incluiu `force-stop` exclusivo DEV e novo processo; o Chrome desktop de perfil exclusivo também foi encerrado/reaberto como processo, com snapshot e hashes preservados. PWA Android
  foi fechada nos recentes e reaberta pelo ícone pelo usuário. PWA desktop fechou
  a janela e relançou a instalação via CDP pipe. Não se matou o processo do Chrome
  pessoal; reload de navegador comum não foi chamado de reinício de processo.
- Permissão nesta linha significa **concessão SAF**: não existe equivalente em OPFS.
  Erros genéricos de permissão/capability Web permanecem cobertos por doubles.
- Offline das PWAs foi emulado por CDP, com sessão mantida durante todo o ensaio.
  A rede foi restaurada em `finally`. Não se desligaram Wi-Fi/dados do aparelho.
  SAF/SQLite locais foram comprovados; offline físico nativo não foi provocado.
- Responsividade aprovada cobre a matriz delimitada abaixo, sem garantir todas
  as fontes, temas, orientações físicas ou conteúdo bibliográfico possível.

## Navegação, persistência e domínio

O roteiro adicional `validate_attachments_ux.mjs` passou **91 verificações** além
das 22 comuns, tanto no Chrome desktop quanto na WebView DEV. As contagens são
checks de runtime; não foram somadas ao total Vitest.

O App abriu Home → detalhes, edição → fechar, Meus Livros, Lidos, Emprestados,
Quero Ler, Explorar → Estante → detalhes e retorno entre duas obras sintéticas. Os modos Capas e Lista abriram os mesmos detalhes com Espaço, além de Enter nas capas.
A obra sem posse manteve `fisico` e `quero_ler` mesmo com EPUB + MP3 anexados.
A obra companheira, com posse, duas modalidades, Lido e empréstimo, permaneceu
sem anexos/operações da primeira. Não foram introduzidos filtros/abas.

Snapshots completos antes/depois comparam `Book` inteiro (UUID, posse, modalidades,
status, nota, datas e demais metadados), `BookAttachment`, `ReaderPosition`,
`ReadingSession` e `ReadingProgress`. Conteúdo idêntico preservou ID/posição;
conteúdo diferente só invalidou a posição após confirmação/reconciliação explícita.
Rollback preservou o snapshot anterior. Desassociar removeu só o vínculo/posição
escolhidos; outro slot, obra, sessões/progresso e bytes continuaram preservados.

A atualização `adb install -r` manteve integralmente o snapshot sintético capturado
na instalação anterior. Depois do ensaio final, `force-stop` DEV → reabrir manteve
os **dois anexos e duas posições**, livro/sessões/progresso e SHA dos dois arquivos.
`WebView.getServerBasePath()` retornou **`public`**: assets empacotados, sem diretório
de assets externo ao APK nem servidor externo. Uma recriação posterior do processo ao voltar da PWA
também permitiu consultar novamente a mesma obra.

O fechamento incluiu a entrada normal `/` do APK, sem montagem pelo diagnóstico:
Home → obra sintética, EPUB + MP3 e dois menus presentes, 392 px CSS sem overflow,
gate nativo habilitado e servidor `public`. A WebView reportou Chromium
**156.0.8078.47**. O DEV foi deixado nessa tela; o app principal não foi iniciado.

Entre duas abas reais Chrome desktop, a confirmação desatualizada foi rejeitada,
preservando a associação vencedora e sua posição. A tentativa adicional de duas
abas mobile foi interrompida por troca de contexto durante atualização de SW;
não foi contabilizada como aprovação de concorrência mobile nesta fase.

Seleção SAF manual adicional nesta revisão: o usuário escolheu e confirmou um MP3
sintético pelo seletor normal aberto no botão Substituir. O journal completou;
a referência mudou, mas SHA/tamanho, ID e posição de áudio permaneceram iguais.
Livro, sessões/progresso, posição e anexo de e-book foram comparados antes/depois.
O arquivo anterior continuou acessível. O provedor registrou `synthetic.mp3`;
o teste valida a identidade pelos bytes/referência, não por expectativa de nome
local da fixture. Dois eventos nativos de `selectDocument` confirmaram passagem
pelo seletor, separados dos cenários de conclusão injetada.

## Operações longas e falhas

No perfil Chrome exclusivo, uma fonte PDF sintética de **33.554.448 bytes** foi
copiada de verdade para OPFS. CPU do alvo foi emulada a 6× para observação, sem
atraso artificial no serviço nem progresso inventado. A UI mostrou “Importando…”,
7% e Cancelar; uma consulta ao alvo respondeu em 11 ms na amostra. Cancelar
preservou o snapshot completo e os hashes anteriores, inclusive após reload.
Essa amostra não é um perfil completo de desempenho.

Uma segunda cópia do mesmo tamanho foi necessária para outro cenário: sair dos
detalhes durante cópia, abrir a companheira e retornar à obra original. A companheira
não recebeu arquivo, progresso ou busy da primeira. A confirmação reapareceu na
obra original; cancelar o arquivo preparado manteve integralmente o snapshot.
Não houve exclusão de staging/recibos. O orçamento livre foi consultado antes;
no aparelho havia cerca de 33 GiB disponíveis, sem criar mídia grande nativa nova.

Falhas de escrita/SHA, quotas, finalização do journal, UUID reutilizado e concorrência
de desassociação continuam na regressão Vitest/JVM. Nesta fase não se induziram
todos esses erros fisicamente pela nova UI. A prova runtime nova de atomicidade é
a falha controlada antes do commit e sua recuperação, dentro das 22 verificações.
Não confundir essa cobertura com revogação real, morte durante escrita, evicção
física ou perda de energia. Operações sem intenção de vínculo continuam retidas e
não escolhem um livro automaticamente ao reabrir.

## Responsividade, teclado e idiomas

Por ambiente Chrome desktop, Firefox e WebView DEV: **432 combinações** = seis
idiomas × seis larguras (320/360/392/430/768/1280) × quatro escalas de fonte
(100/130/150/200%) × seção/substituição/desassociação. Medidas por CDP/BiDi, em
navegadores reais; larguras e fontes emuladas dentro da página. Não foram alteradas
fontes/rotação globais do aparelho. Nomes longos foram usados na Web; o gerador SAF
conservou os nomes sintéticos nativos. Paisagem física permanece pendente.

Os checks medem overflow de cada descendente visível, limites/rolagem do modal e
controles. Chrome/WebView também verificam área mínima de 44 px CSS; o Firefox
verifica geometria/limites. A PWA Android foi inspecionada na largura real, sem
overflow da seção. O layout global e as cores não foram redesenhados.

Chrome e WebView: foco inicial em Cancelar, oito passos Tab/Shift+Tab por idioma,
Escape com retorno ao disparador, Enter/Espaço em Cancelar, nomes do diálogo na
árvore de acessibilidade e abertura de capas por teclado. Firefox: Tab/Escape por
BiDi, foco dentro do modal e snapshots preservados. O usuário confirmou Voltar
físico no DEV; o reteste automatizado conferiu diálogo fechado, detalhes presentes,
snapshot idêntico e foco no botão Desassociar.

Isso **não é teste com leitor de tela real**. Orca está instalado no host, mas os
ensaios foram headless; não se iniciou leitor global da sessão pessoal. TalkBack,
NVDA/VoiceOver e revisão auditiva permanecem manuais. Roteiro: ativar o leitor
manualmente, navegar aos dois slots, ouvir nome/estado/progresso/erros, conferir
anúncio das consequências para posição e retenção no diálogo, cancelar/confirmar
e conferir foco após erro/sucesso. Desativação e retorno às preferências são ações
do usuário; o agente não altera configurações globais de acessibilidade.

pt-BR/en-US/es-ES/fr-FR/de-DE/it-IT passaram na renderização dos controles e diálogos.
Tipos/completude continuam cobertos pelos 81 testes anteriores de interface/gate.
Nenhuma tradução foi alterada. Retenção, posição, histórico e distinção entre acesso
e integridade permanecem explícitos; nenhuma promete liberar espaço ao desassociar
ou recuperar acesso por escolher qualquer pasta. Revisão humana linguística e
leitura auditiva de todos os textos continuam pendentes.

As mensagens críticas de posição, histórico, retenção, acesso/integridade e backup
também foram lidas diretamente nos seis catálogos nesta auditoria, sem necessidade
de correção textual. Isso não substitui revisão por falantes nativos.

## PWA e offline

PWA desktop: instalação real headless por CDP pipe, standalone confirmado, 22 checks,
EPUB + MP3 com duas posições, fechar/relançar janela e offline emulado com reload,
snapshot e hashes idênticos. A revisão final do runner usa assertions obrigatórias
para standalone, dois hashes e igualdade de snapshot, retornando falha quando divergem.
Uma atualização real do script do SW (comentário de teste somente na saída `/tmp`)
foi solicitada; reload manteve snapshot e hashes. Não houve alteração de versão do app.

PWA Android: instalação/abertura pelo ícone e fechamento/reabertura pelos recentes
feitos pelo usuário. `display-mode: standalone` e controle por SW confirmados;
22 checks executados **dentro da janela instalada**, dois anexos e duas posições.
O snapshot após reabrir foi idêntico. Na sessão offline mantida, shell, SHA de ambos,
substituição diferente confirmada e desassociação de áudio funcionaram. Livro,
sessões e progresso permaneceram iguais; só vínculo/posição autorizados mudaram.
Novo reload online e abertura pelos detalhes reais preservaram o resultado final.

Busca externa, IA, capas remotas e primeira instalação sem rede não foram aprovadas
como offline. Não houve desligamento de rádio, limpeza de origem, encerramento do
Chrome pessoal ou remoção de outras PWAs. OPFS continua sujeito à política de
persistência/evicção do navegador; SW e reabertura não substituem backup.

## SAF: revogação real e contrato ainda ausente

A concessão persistível da pasta de teste ativa foi liberada pelo método DEV
existente, que chama `releasePersistableUriPermission`. Estado real:
`permission-revoked`; a UI mostrou “Permissão necessária”, sem remover referências,
livro, posições, sessões ou progresso. Snapshot completo idêntico antes/depois.
O usuário selecionou a mesma pasta no seletor oficial comum, sem direcionamento por
operação. Estado voltou a `accessible`, UI atualizada e SHA dos dois anexos aprovado,
novamente com snapshot idêntico. A concessão foi restabelecida ao terminar.

Não se revogaram permissões do app principal, usaram root, caminhos para ler mídia
gerenciada ou APIs diagnósticas como falsa recuperação. O teste não demonstra que
qualquer pasta nova reautoriza um documento antigo. Contrato geral dirigido ao anexo
continua ausente; análise e proposta separadas em
[MINHAESTANTE_3_3_REAUTHORIZATION_PROPOSAL.md](MINHAESTANTE_3_3_REAUTHORIZATION_PROPOSAL.md).

Somente o provedor local de teste foi exercitado. Somente leitura real, nuvem/contas
externas, documento movido/removido, metadados incompletos e provedor desconectado
continuam pendentes de ambientes seguros. Não foram instalados provedores terceiros
nem consultadas contas pessoais. Roteiro: escolher pasta/provedor exclusivamente
sintético, capturar snapshot/hash, reproduzir uma condição por vez, consultar a UI,
comparar metadados e restabelecer acesso antes de seguir; nunca limpar o banco.

## Builds, regressão e privacidade

| Verificação executada | Resultado |
| --- | --- |
| Vitest final | **614 / 35 arquivos**, zero falhas; dois testes novos de capas acionáveis/decorativas |
| Interface/gate | 81 testes anteriores preservados; cenários adicionais de layout/teclado/navegação são runtime |
| Coordenador, SAF/OPFS/IndexedDB, journal, posições, SQLite, posse/modalidades/leitura e backup | Incluídos nos 614; doubles e SQLite desktop separados da prova física |
| JVM | **32**, zero falhas/erros; baseline com `--rerun-tasks`, 218 tarefas executadas; não instrumentação Android |
| TypeScript | `npm run lint` aprovado; script Android também executa `tsc --noEmit` |
| Web público e DEV | Builds Vite/PWA aprovados em `/tmp`; aviso conhecido de chunk >500 kB |
| Android debug | `assembleDebug` e testes JVM offline, JDK21/Gradle8.14.3; avisos conhecidos sem falha |
| APK DEV | ID `com.booknookapp.dev`, rótulo DEV, 31/2.0-31, certificado Android Debug e digest igual ao instalado antes de `install -r` |
| Assets públicos | Sem diagnósticos, chunk `DigitalAttachmentsSection` ou marcador `data-attachment-slot`; sem ZIP/import privado/assinatura |
| APK atual | UI empacotada; entradas auditadas sem ZIP pessoal, imports privados, keystore/chaves |
| `git diff --check` | Aprovado |

Não se usou `npm run build` como evidência Android: contém `cap sync || true`.
Vite/TypeScript e Gradle foram executados separadamente, sem cap sync, release,
alteração de versão/assinatura, reinstalação limpa, SQL ou migração nova.
O backup histórico privado não foi aberto; `MINHAESTANTE_PRIVATE_BACKUP` não estava
definido. O ciclo de backup sintético permanece na regressão completa.

**Publicação continua bloqueada.** A auditoria confirmou cinco commits de
inclusão/alteração do antigo diretório privado (`git log --diff-filter=AM`),
21 pacotes antigos com caminhos de imports e 22 pacotes locais incluindo o DEV
atual seguro. Há 12 árvores de commits alcançáveis contendo o diretório; essa
contagem inclui propagação do conteúdo, não 12 novas inclusões. O relatório anterior
usava cinco commits afetados; ficam explícitas as definições desta recontagem.
Não houve leitura de conteúdo bibliográfico dos pacotes, expurgo, exclusão ou push.

Os logs da camada de anexos não imprimem URI; o log nativo dedicado usa nomes de
métodos/códigos fixos. Erros atravessam a bridge normalizados. Fixtures e novos
snapshots são sintéticos. Guardas de assets/rotas e seus testes foram preservados;
nenhum material de assinatura foi adicionado às rotas diagnósticas.
HTTP Vite local: raiz/favicon 200; rotas fictícias de assinatura (inclusive nome
codificado), import privado e APK alternativo retornaram 404, sem ler conteúdo.
O pacote principal conservou **31/2.0-31** e atualização **2026-10-25 19:04:33**.

## Reprodução e evidências

```bash
npm test
npm run lint
node_modules/.bin/vite build --outDir /tmp/minhaestante-3-3-public-final --emptyOutDir
node_modules/.bin/vite build --config vite.attachments-dev.config.ts --outDir /tmp/minhaestante-3-3-dev --emptyOutDir
node_modules/.bin/vite preview --config vite.attachments-dev.config.ts --outDir /tmp/minhaestante-3-3-dev --host 127.0.0.1 --port 3383 --strictPort
# Chrome com perfil novo exclusivo e remote-debugging-port=9383:
# abrir /diagnostics/attachments-management.html antes dos runners
node scripts/validate_attachments_management.mjs 9383 http://127.0.0.1:3383
node scripts/validate_attachments_ux.mjs 9383 http://127.0.0.1:3383
# PWA em outro perfil exclusivo criado pelo próprio runner; stdin: update / close
node scripts/validate_installed_pwa.mjs http://127.0.0.1:3383 --attachments
# JDK21 e Gradle local configurados; não instala automaticamente:
DIGITAL_DEBUG_CONFIG=vite.attachments-dev.config.ts bash scripts/build_android_saf_debug.sh :app:testDebugUnitTest --rerun-tasks
# Auditar ID/assinatura/entradas; só então atualizar DEV. Encaminhar somente sua WebView:
node scripts/validate_attachments_ux.mjs 9384 https://localhost --native
git diff --check
```

No Firefox real: usar perfil novo, executar `window.attachmentManagement.run()` no
diagnóstico, guardar `bookUuid`/snapshot; após reload chamar `start(bookUuid)` e
`verifyAll()`. A matriz desta sessão foi automatizada por WebDriver BiDi com
`browsingContext.setViewport`, escala CSS e `input.performActions` para Tab/Escape.
No Android Chrome/PWA, os comandos usam exclusivamente a origem de teste encaminhada.

Evidências locais temporárias: `/tmp/minhaestante-3-3-*`, incluindo logs baseline/final
Vitest/TypeScript/Vite/Gradle, `chrome-ux.log`, `native-ux.log`, `firefox-ux.log`,
`native-before/after-stop.json`, `native-revoked/restored.json`,
`native-physical-back-before/after.json`, `large.json`, `navigation-copy.json`,
`android-pwa-before-reopen/offline/final.json` e `installed-pwa-final.log`.
Os arquivos contêm somente os testes sintéticos; não foram copiados para `public`,
rotas de download, fixtures distribuídas ou anexados como backups ao repositório.

Tentativas inconclusivas foram descartadas: ADB bloqueado pelo sandbox antes da
execução autorizada; Gradle sem acesso ao cache nativo no sandbox; WebView oculta;
eventos CDP incompletos de Enter/Escape no runner inicial; navegação ainda carregando;
e atualização do SW durante o conflito mobile. Não foram registradas como aprovação
nem como falhas de integridade do produto. Os cenários válidos estão discriminados.
Uma tentativa do modo Lista identificou HTML/chunks antigos no cache do worker;
o runner passou a atualizar/aguardar o worker e recarregar antes da matriz. O reteste
validou a revisão atual **com o worker real**, sem desativá-lo ou apagar IndexedDB/
OPFS. A asserção inicial que exigia o nome local do MP3 manual também foi substituída
por comparação de identidade/referência/hash e pelos metadados efetivos do provedor.

## Arquivos alterados e próxima fase

- `src/App.tsx`: cancelar diálogo antes de navegar pelo Voltar existente.
- `src/components/BookCoverView.tsx`: acesso por teclado às capas acionáveis.
- `src/screens/HomeScreen.tsx`: título acionável por teclado também no modo Lista, sem propagar o clique duas vezes.
- `src/components/DigitalAttachmentsSection.tsx`: reflow localizado para textos/fontes.
- `src/__tests__/book_cover_accessibility.test.tsx`: dois contratos de acessibilidade.
- `src/dev/digital/attachmentsManagement.tsx`: montagem do App real, seis idiomas,
  companheira sintética, nomes únicos/longos e fixture grande optativa; mesma infraestrutura.
- `scripts/validate_attachments_ux.mjs`: roteiro CDP reproduzível de layout/teclado/navegação.
- `scripts/validate_installed_pwa.mjs`: modo optativo `--attachments`, mesmos mecanismos
  de instalação/fechamento/offline e assertions de persistência/SHA.
- Este relatório, proposta de reautorização e adendos de contexto/arquitetura: resultados,
  limites e decisões, sem reclassificar testes históricos como novos.

Pronta para **planejar/desenvolver a Fase 4**, mantendo as restrições descritas.
Backup atual continua padrão; as futuras opções “Incluir e-books” e “Incluir
audiolivros” devem ser independentes e desmarcadas. Definir manifesto versionado,
streaming/restauração transacional, hashes e mídia omitida/indisponível antes de
implementar. `readAccess` nativo continua indisponível: exportar mídia grande precisa
de contrato nativo apropriado, sem expor URI ou carregar o arquivo inteiro em JS.
Não implementar backup digital pela seleção da pasta ativa nem por cópia de tokens
entre instalações. Publicação depende também do saneamento histórico autorizado.

Permanecem: Safari real; TalkBack/Orca/NVDA/VoiceOver manuais; rotação física e outros
temas/fontes; provedores SAF adicionais; contrato de reautorização dirigida;
cancelamento/cópia longa nativos nesta UI; reinício físico/evicção/perda de energia;
revisão humana linguística. Não se declara compatibilidade universal nem limpeza
de arquivos retidos. Sem publicação, commit ou push.
