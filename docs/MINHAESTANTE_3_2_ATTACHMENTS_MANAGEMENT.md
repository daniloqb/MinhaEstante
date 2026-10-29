# MinhaEstante 2.0 — Fase 3.2: gerenciamento DEV de anexos

Data: 27/10/2026. Branch: `feature/posse-independente`.

Substituição com confirmação, desassociação sem exclusão física e verificação
explícita foram implementadas sobre a seção da Fase 3.1. O recurso continua DEV.
Não há leitor/player, limpeza física, alteração do ZIP, SQL ou migração nova.

## Interface e responsabilidades

- `DigitalAttachmentsSection.tsx`: preserva os dois slots e o visual de papel/madeira.
  Cada categoria ocupada tem “Gerenciar arquivo”, com Substituir, Verificar/Tentar
  novamente e Desassociar. Não há ações de gerenciamento em categoria vazia.
- `attachmentsPresentation.ts`: mantém a operação por UUID/livro fora do ciclo de
  vida do React, consulta repositórios e chama somente os serviços/coordenador já
  existentes. Não grava SQL, bytes ou uma segunda associação persistida.
- `DigitalAttachmentCoordinator.ts` e `attachmentPlanning.ts`: parâmetros opcionais
  de expectativa reforçam a validação de UUID, referência, provedor e timestamp;
  desassociação também verifica categoria e identidade dentro da transação. Os
  chamadores anteriores continuam compatíveis. Journal e provedores não foram
  duplicados ou substituídos.
- `i18n/types.ts` e `translations.ts`: controles, estados e consequências nos seis
  códigos existentes: pt-BR, en-US, es-ES, fr-FR, de-DE e it-IT.
- `digital_attachments_ui.test.tsx`: 81 testes de interface/adaptador/gate, sendo
  42 acrescentados nesta fase. Os 39 anteriores foram preservados e atualizados
  para refletir categorias ocupadas agora gerenciáveis.
- `helpers/TransactionalSqliteTestDatabase.ts`: extrai o adaptador SQLite desktop
  que já existia no teste do coordenador; ambos os testes reutilizam a mesma classe.
  Evita usar o adaptador de memória sem rollback para comprovar atomicidade.

Os arquivos de gate, tipos Vite e integração em `BookDetailScreen.tsx` da Fase 3.1
permanecem no diff local, preservados. Não houve commit/push.

## Substituição e confirmação

1. O estado consultado fornece o anexo esperado; o clique abre o seletor antes de
   qualquer await, preservando a ativação exigida por Web/Android.
2. Após selecionar, a apresentação revalida UUID, categoria, ID, referência,
   provedor, checksum/tamanho/formato, timestamp e conflitos do journal.
3. O serviço importa/verifica pelos mecanismos incrementais existentes. O arquivo
   fica `FILE_READY`, ainda sem intenção de vínculo. O anexo anterior permanece.
4. O diálogo mostra nomes anterior/novo, categoria, formatos, consequência para a
   posição, preservação de sessões/progresso e retenção dos arquivos físicos.
5. Confirmar revalida o alvo e chama `applyChange` com `intent: replace`, ID esperado,
   expectativas de referência/UUID e decisão explícita de posição quando necessária.
   O coordenador verifica integridade antes da transação de metadados.
6. A interface reconsulta o vínculo persistido e só anuncia conclusão após sucesso
   do coordenador e finalização do journal.

Checksum SHA-256, tamanho e formato compatíveis permitem reconhecer conteúdo
idêntico conforme a política existente. O ID do anexo e a ReaderPosition são
preservados. Conteúdo diferente ou equivalência não comprovada nunca herda CFI,
página ou tempo. Com posição existente, a confirmação autoriza `invalidate-current`.
Uma posição surgida depois de uma confirmação que dizia não haver posição exige
nova revisão, sem descarte silencioso.

Cancelar a confirmação não altera vínculo, posição, livro ou histórico. A cópia
preparada fica no journal, sem intenção de associação; o startup não escolhe um
livro para vinculá-la. Não existe compensação por exclusão física automática.
Uma pendência `LINKING` de operação já confirmada pode ser reconciliada explicitamente
com “Rever operação pendente”, reutilizando `coordinator.recover` e o recibo durável.

## Atomicidade, desassociação e retenção

A invalidação de posição ocorre junto com a troca do vínculo na transação existente.
Falha de INSERT/commit restaura anexo e posição anteriores. Arquivos novos e antigos
ficam preservados; o journal permite reconciliação posterior da intenção confirmada.
Se o vínculo confirmar e a finalização do journal falhar, a interface indica pendência,
sem anunciar conclusão antecipada ou criar outra associação.

Desassociar exige diálogo próprio. Explica que o livro continua cadastrado, que o
arquivo deixa de aparecer naquele slot, que a posição específica será removida
quando existente e que sessões/progresso permanecem. O coordenador executa apenas
remoção lógica; a apresentação reconsulta o slot antes de anunciar sucesso.
Cancelar/falhar não oculta definitivamente um vínculo ainda persistido.

Não houve chamada de exclusão física pela interface nem remoção de fontes sintéticas.
Desassociar não libera espaço. Arquivos substituídos, cópias preparadas canceladas,
staging e recibos permanecem sob a política conservadora das fases anteriores;
o custo pode superar duas cópias. Limpeza exige outro protocolo/política explícitos.

## Disponibilidade, SHA e acesso

Disponibilidade e integridade são estados separados. Documento não encontrado,
arquivo temporariamente indisponível, permissão revogada, provedor indisponível,
checksum divergente e journal pendente não apagam metadados.

Refresh/foco consulta acesso, sem recalcular SHA. “Verificar arquivo” consulta acesso
e, se capability/checksum permitirem, chama a verificação incremental existente.
Há estado de processamento e AbortSignal apenas com suporte real. Sem SHA disponível,
o feedback diz somente que o arquivo está acessível, sem confirmar integridade.
Uma falha de checksum fica explícita até nova verificação bem-sucedida.

**Reautorização direcionada ainda não tem contrato seguro geral para anexos.** O
seletor de configuração altera a pasta ativa, e o caminho direcionado por operação
do plugin é diagnóstico. Por isso não há botão que prometa restaurar o acesso ao
anexo selecionando outra pasta. A UI orienta verificar o acesso à pasta original e
tentar novamente; não troca tokens, copia de novo como falsa recuperação ou usa
API de diagnóstico para contornar a fronteira do provedor. Web/OPFS não ganha
permissões SAF. Esta limitação precisa de decisão contratual futura.

## Concorrência e navegação

A apresentação compartilhada bloqueia substituição/desassociação/verificação em
paralelo no mesmo livro e confirmações duplicadas. Ela permanece ativa na seleção,
cópia e confirmação mesmo após desmontar o componente. UUID e expectativas são
revalidados antes de confirmar; o coordenador valida novamente dentro do fluxo
transacional. Troca idêntica que conserva o ID também é protegida por referência e
timestamp esperados. Categoria e livro são verificados na desassociação.

Essa proteção de interface não substitui locks/CAS: Web continua com Web Locks e
IndexedDB revisionado; Android continua com serialização e transações SQLite nativas.
O ensaio entre duas abas reais preservou o vencedor e sua posição: a confirmação
desatualizada foi rejeitada, sem sobrescrever a associação concorrente.

## Diálogos, acessibilidade e responsividade

O diálogo usa superfície `PaperCard` e `<dialog>` modal: nome/descrição acessíveis,
fundo inerte, foco inicial em Cancelar, tratamento explícito de Tab/Shift+Tab, Escape
para cancelar e retorno ao botão que iniciou a operação ou ao título da seção.
Não usa `window.confirm`. O disparador é capturado antes da seleção assíncrona,
pois desabilitar o botão durante a cópia pode fazê-lo perder foco.

Controles possuem área mínima de 44 px CSS, foco visível, textos traduzidos e estados
anunciados por `role=status`/aria-live. O modal limita altura por `100dvh` e rola
internamente. Textos de nomes de arquivo podem quebrar linha. Desktop 780 px e
Android 392 px CSS foram ensaiados, sem overflow horizontal. No WebView real o
diálogo mediu aproximadamente 361 × 573 px em viewport 392 × 791 px.

Foram encontrados e corrigidos dois problemas no ensaio real: retorno de foco após
cancelar e Tab saindo do modal no Android. O reteste via CDP confirmou oito passos
de Tab sem sair do diálogo, Escape, restauração de foco e snapshot intacto.
Isso não equivale a validação com TalkBack/NVDA, teclado físico ou todas as fontes.

## Build DEV e pacote Android

`vite.attachments-dev.config.ts` inclui o app e os diagnósticos optativos;
`diagnostics/attachments-management.html` monta a mesma seção real com dados
sintéticos. `src/dev/digital/attachmentsManagement.tsx` fornece fixtures e assertions
de runtime, sem segunda UI. O runner `scripts/validate_attachments_management.mjs`
aceita apenas origem local e alvo de diagnóstico. O gate exige build DEV e host
local na Web, ou debug + applicationId DEV no Android.

O build público final foi inspecionado: sem diretório de diagnóstico, sem chunk
`DigitalAttachmentsSection` e sem marcador `data-attachment-slot` no JavaScript.
As traduções continuam no catálogo compartilhado; não representam inclusão do módulo.

APK debug compilado pelo script isolado, sem `cap sync`, com JDK21/Gradle8.14.3 e
assets temporários. Conferidos applicationId `com.booknookapp.dev`, rótulo
`MinhaEstante DEV`, versão `2.0-31`/31, certificado `CN=Android Debug` e assinatura
igual à instalação anterior antes de `adb install -r`. Nenhuma desinstalação,
limpeza de banco ou troca da instalação principal. O caminho nativo do servidor foi
`public`: a interface desta fase foi testada empacotada, sem override de cache.
O APK foi auditado sem imports privados, ZIPs pessoais ou material de assinatura.

Comandos principais executados:

```bash
npm run lint
npm test
node_modules/.bin/vite build --outDir /tmp/minhaestante-3-2-public --emptyOutDir
node_modules/.bin/vite build --config vite.attachments-dev.config.ts --outDir /tmp/minhaestante-3-2-dev --emptyOutDir
# JDK21/Gradle local, sem download e sem cap sync:
DIGITAL_DEBUG_CONFIG=vite.attachments-dev.config.ts bash scripts/build_android_saf_debug.sh :app:testDebugUnitTest
# A tarefa JVM também foi forçada com --rerun-tasks para não contabilizar só cache.
node scripts/validate_attachments_management.mjs 9282 http://127.0.0.1:3282
node scripts/validate_attachments_management.mjs 9327 https://localhost
node scripts/validate_attachments_management.mjs 9337 http://localhost:3282
git diff --check
```

As variáveis `JAVA_HOME` e `GRADLE_BIN` apontaram para as instalações locais descritas.
`npm run build` agregado não foi usado como prova Android: contém `cap sync || true`.
Os builds passaram com o aviso conhecido de chunk acima de 500 kB; Gradle registrou
avisos existentes de flatDir, SDK XML e depreciações, sem falha na compilação final.

## Evidências e limites dos testes

Vitest: **612 aprovados em 34 arquivos, zero falhas**; 81 no arquivo de interface/gate,
42 novos nesta fase. A suíte completa inclui contratos digitais, SAF/OPFS/IndexedDB,
journal, posições, anexos, SQLite desktop, posse/modalidades/status e backup sintético.
JVM: **32 testes, zero falhas**, tarefa efetivamente reexecutada.

A suíte comum de runtime passou **22 verificações em cada Android SAF/SQLite,
Chrome desktop, Chrome Android e Firefox**. Ela clica nos controles da seção real,
mas injeta explicitamente a conclusão do seletor com uma fonte sintética. Cópia,
SHA, journal, SQLite/IndexedDB/OPFS, rollback e retenção são reais. A falha antes de
commit foi injetada para exercitar a transação real; não representa falta de energia.

Ensaio adicional de seletor real: o usuário escolheu o MP3 sintético pelo SAF e
confirmou o diálogo. ID, posição de áudio, livro, sessões e progresso foram comparados
antes/depois; SHA confirmado. Uma tentativa automatizada foi interrompida ao mudar
o app de primeiro plano e foi repetida com sucesso; ela não foi contada como aprovação.

O APK final também foi encerrado com `am force-stop com.booknookapp.dev` e reaberto.
O snapshot válido da substituição manual foi comparado integralmente após reabrir,
com UUID, anexo, posição, sessões/progresso idênticos e SHA novamente aprovado. O
carregador Capacitor permaneceu em `public`, sem override. Versão e data da instalação
principal permaneceram `2.0-31`/31 e `2026-10-25 19:04:33` conforme Package Manager;
somente DEV teve a data de atualização alterada. Não foi executado reboot do aparelho.

Na navegação normal do APK (`BookDetailScreen`), o livro sintético da Fase 3.1
continuou com o mesmo UUID e os dois registros de anexo idênticos, agora com os dois
menus de gerenciamento, sem overflow. O snapshot bibliográfico histórico da 3.1
não foi usado como baseline atual: seu status já diferia do registro encontrado
(Lido em vez de Quero Ler). Nada foi revertido para igualar o arquivo antigo. As
comparações integrais de livro/status desta fase usam snapshots capturados antes
das operações controladas no novo livro sintético 3.2.

| Verificação | Resultado | Ambiente/limite |
| --- | --- | --- |
| Substituição idêntica | Aprovado | Android, Chrome desktop/Android, Firefox, PWA desktop; seletor SAF manual adicional para MP3 |
| Substituição diferente | Aprovado | Mesmo runtime comum; conclusão de seletor sintético injetada |
| Confirmação e cancelamento | Aprovado | UI real nos quatro runtimes; cancelamento preserva snapshot |
| ReaderPosition preservada | Aprovado | EPUB/PDF/MP3/M4A/M4B em Vitest; EPUB no runtime, áudio também no SAF manual |
| ReaderPosition invalidada | Aprovado | EPUB/PDF/MP3 em Vitest; EPUB no runtime comum após confirmação/reconciliação |
| Rollback | Aprovado | SQLite desktop, SQLite nativo e IndexedDB; falha controlada antes de commit |
| Desassociação | Aprovado | Runtime comum e PWA; outro slot, livro e histórico preservados |
| SHA-256 | Aprovado | Provedores reais nos quatro runtimes, reload e PWA reaberta |
| Permissões | Parcial | Erros/revogação/capabilities automatizados; nova reautorização direcionada não implementada/validada fisicamente |
| Persistência após reabertura | Aprovado no escopo | Reload nos quatro runtimes; processo DEV e processo/janela da PWA desktop encerrados e reabertos |
| APK debug com interface empacotada | Aprovado | Compilado, auditado, assinatura comparada, DEV atualizado sem perda do snapshot sintético anterior |
| Chromium | Aprovado | Chrome Linux/headless; perfil exclusivo, OPFS/IndexedDB reais e duas abas |
| Chrome Android | Aprovado | Aparelho físico, origem exclusiva localhost:3282; duas abas, reload e SHA; outras origens não acessadas |
| Firefox | Aprovado no escopo | Firefox158.0.1/headless, perfil novo exclusivo na área Snap; 22 checks e reload/SHA |
| PWA instalada | Aprovado desktop | Instalação standalone real via CDP pipe; fechar/relançar janela, offline na mesma sessão e encerrar/reabrir navegador com mesmo perfil |
| Safari | Pendente | Sem macOS/iOS/Safari real disponível |
| Acessibilidade | Parcial | Labels/aria e seis idiomas automatizados; foco/Tab/Escape e geometria no WebView real; leitores de tela pendentes |
| Seis idiomas | Aprovado automatizado | Tipos, chaves completas, renderização e diálogos em pt/en/es/fr/de/it; revisão humana de todas as traduções pendente |
| Vitest | Aprovado | 612/34, incluindo 42 testes novos |
| JVM | Aprovado | 32, execução forçada; não equivale a Android físico |
| TypeScript | Aprovado | `npm run lint` |
| Build público/DEV | Aprovado | Web/PWA; exclusão do módulo no público verificada |
| Gradle debug | Aprovado | Compilação Kotlin/Java e empacotamento debug isolado |

Os perfis desktop e origens foram sintéticos. No Android Chrome foi utilizada uma
origem de teste exclusiva no navegador existente, sem consultar ou limpar outras
origens. Na PWA desktop, o offline foi emulado por CDP com a sessão mantida aberta;
não foi desligado o rádio do aparelho. Não houve teste novo de migração v1→v2 no
dispositivo, nem leitura do backup privado histórico de 215 livros nesta fase.

## Pendências e prontidão para a Fase 3.3

Implementação apta a seguir para **Fase 3.3 — Validação da Experiência de Anexos
Digitais**, com a cobertura acima. Não representa aprovação de produção universal.
Permanecem: contrato seguro de reautorização direcionada; perda real de concessão e
proveedores SAF adicionais nesta UI; Safari; PWA Android instalada nesta revisão;
leitores de tela, fontes maiores, outras larguras e integração visual completa entre
telas. A limpeza física, leitores/player e mídia no backup continuam fora do escopo.

O ZIP padrão continua sem binários digitais e com a advertência visível. Persistem
os cinco commits históricos e 21 pacotes antigos afetados por materiais privados.
Não houve expurgo, publicação/release, APK/AAB de produção, alteração de versão ou
assinatura principal, commit ou push. Os novos pacotes ficaram no caminho de build
Android local, sem cópia para public ou rotas de download.
