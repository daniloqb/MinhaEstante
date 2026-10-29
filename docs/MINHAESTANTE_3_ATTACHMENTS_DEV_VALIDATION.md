# Interface inicial de anexos — DEV

Data: 27/10/2026. Branch: `feature/posse-independente`.

Este relatório registra a Fase 3.1 e seus limites na data da entrega. A evolução de
gerenciamento e a validação de APK DEV empacotado estão no relatório
[Fase 3.2](MINHAESTANTE_3_2_ATTACHMENTS_MANAGEMENT.md). As evidências abaixo não foram
reescritas como se pertencessem à nova fase.

Esta entrega continua a interface já iniciada nas alterações locais. Não encerra a
Fase 3: permite adicionar um e-book e um audiolivro a um livro persistido, deixando
as categorias ocupadas somente para consulta. Substituição, desassociação, filtros,
leitor e player não fazem parte desta interface inicial.

## Comportamento e arquivos

- `src/components/DigitalAttachmentsGate.tsx` e
  `src/services/storage/digital/attachmentsDevGate.ts`: entrada lazy restrita a DEV.
  Web exige host local; Android exige também o gate nativo de debug/applicationId.
  O build público define o gate como falso e não contém o chunk da interface.
- `src/components/DigitalAttachmentsSection.tsx` e
  `src/services/storage/digital/attachmentsPresentation.ts`: duas categorias,
  preparação explícita do armazenamento, seleção no gesto do usuário, progresso,
  cancelamento conforme capability, disponibilidade e confirmação do vínculo.
  Reutilizam o serviço, coordenador, journal e repositórios existentes.
- `src/screens/BookDetailScreen.tsx`: inclui o gate nos detalhes de livro salvo.
  A interface não altera modalidades, posse, status nem sessões deliberadas.
- `src/i18n/types.ts` e `src/i18n/translations.ts`: mensagens nas seis localidades,
  incluindo o aviso de que mídias ainda não são incluídas no backup ZIP.
- `vite.config.ts`, `vite.attachments-dev.config.ts`, `src/vite-env.d.ts` e
  `scripts/build_android_saf_debug.sh`: configuração optativa do app DEV. A ordem
  do hook de manifesto foi corrigida para emitir `MinhaEstante DEV PWA` depois do
  plugin PWA; produção mantém sua identidade anterior. O script aceita somente as
  duas configurações previstas; o diagnóstico SAF continua sendo o padrão.

As operações em andamento sobrevivem à navegação pela instância de apresentação;
não há segundo journal nem persistência de binários no React/localStorage/SQLite.
Refresh consulta acesso e metadados, sem recalcular SHA a cada foco da janela.
Falhas de leitura desabilitam novas gravações até uma consulta bem-sucedida.
O livro e a categoria são reconsultados após a seleção; a identidade UUID também é
revalidada após a cópia, antes de chamar a associação. Conflitos preservam os bytes,
sem substituir outro anexo ou excluir arquivos para compensar a falha.

## Verificações executadas nesta continuação

| Verificação | Resultado |
| --- | --- |
| `npm test` | 570 testes aprovados, 34 arquivos; 39 testes da interface/gate |
| `npm run lint` | TypeScript aprovado |
| `vite build --outDir /tmp/minhaestante-attachments-public --emptyOutDir` | Web/PWA aprovado; sem chunk `DigitalAttachmentsSection` nem marcador dos slots |
| `vite build --config vite.attachments-dev.config.ts --outDir /tmp/minhaestante-attachments-dev --emptyOutDir` | DEV Web/PWA aprovado, chunk presente e manifesto DEV confirmado |
| `bash -n scripts/build_android_saf_debug.sh` | Sintaxe aprovada; não executa Gradle nem gera pacote |
| `git diff --check` | Aprovado |

O script agregado `npm run build` não foi executado: ele também chama `cap sync
android` e mascara sua falha com `|| true`. TypeScript e compilação Vite/PWA foram
executados diretamente em diretórios temporários, sem alterar assets Android.
Os builds ainda apresentam o aviso conhecido de chunk maior que 500 kB.

Os testes automatizados usam backend simulado e renderização React no servidor.
Foram corrigidas as fixtures para comparar o livro persistido normalizado e passar
arrays de modalidades corretamente. Cobrem os cinco formatos, coexistência dos dois
anexos, cliques duplicados, cancelamento, erro de persistência/finalização, pendências,
permissão revogada, preservação de histórico deliberado existente, conflito de
categoria, troca de identidade durante a cópia e falha/repetição de consulta.
Não são testes nativos Android.

## Ensaio adicional em navegador

Chrome desktop headless com perfil novo em `/tmp`, origem local exclusiva
`http://127.0.0.1:3277`, catálogo e arquivos somente sintéticos. O gate/componente
React real foi montado com o provedor padrão Web. OPFS, IndexedDB, SHA e associação
foram reais. A conclusão do seletor foi injetada via `File`/`DataTransfer` e evento
`change`, portanto não valida a interação gráfica com o seletor do sistema.

Sete verificações aprovadas: categorias vazias; preparação do OPFS; importação de PDF;
importação de MP3; preservação integral do livro; dois vínculos com SHA-256;
UUID e ambos os registros idênticos após reload. Não houve mídia pessoal, leitura
de backup privado ou reutilização de perfil pessoal. O roteiro temporário ficou em
`/tmp/minhaestante-attachments-browser.mjs`, fora dos arquivos distribuídos.

## Android físico — ensaio adicional em 27/10/2026

Dispositivo 22101316G, Android 14, WebView em runtime `155.0.8059.43`;
execução em `com.booknookapp.dev`, versão `2.0-31`. O gate nativo confirmou debug + applicationId DEV e o SAF previamente
configurado estava acessível. A variante de produção não foi iniciada pelo ensaio.

Os assets Web DEV já compilados foram copiados para um diretório de cache exclusivo
da variante DEV. `WebView.setServerBasePath` os ativou apenas em runtime, sem chamar
`persistServerBasePath`. Não houve APK/AAB, Gradle, instalação, mudança de assinatura,
versão ou limpeza de dados. A nova interface usa o plugin Kotlin e SQLite reais da
instalação existente; não representa teste de um novo pacote Android distribuível.

Resultados confirmados:

- Navegação pelo app até os detalhes de um novo livro sintético; dois slots habilitados
  e ausência de transbordamento horizontal na largura real de 392 px CSS.
- Seletor SAF real aberto pela interface. O usuário pressionou Voltar no aparelho;
  a interface mostrou cancelamento e permaneceu sem anexo, com livro idêntico.
- Concorrência SQLite nativa sobre dois registros sintéticos: rollback da primeira
  transação preservou nota 0; a segunda confirmou nota 8, incluindo chamada aninhada
  ao helper transacional. Sem falha `Already in transaction`.
- Seleções gráficas de EPUB e MP3 realizadas pelo usuário no seletor SAF aberto pelos
  botões da interface. Nenhuma seleção ou conclusão de importação foi simulada.
- EPUB de 1.352 bytes e MP3 de 41.700 bytes copiados pelo plugin Kotlin e associados
  pela interface ao mesmo livro. Dois recibos `COMPLETED`, disponibilidade confirmada
  e SHA-256 dos dois destinos recalculados com sucesso pelo provedor nativo.
- Comparação integral do livro persistido com o estado anterior às importações:
  UUID, modalidades, posse, status e demais campos idênticos. Nenhuma sessão de
  leitura criada automaticamente. Os testes não consultaram um backup pessoal.
- Encerramento real via `am force-stop com.booknookapp.dev` e nova abertura da
  Activity. O caminho do servidor voltou a `public`, confirmando que o override de
  assets não foi persistido. Após reativar os mesmos assets de cache, a interface
  mostrou os dois anexos; UUID e todos os campos dos registros de anexo eram idênticos
  ao snapshot anterior. Ambos os SHA-256 foram novamente confirmados no SAF.
- Inspeção de screenshot local da tela sintética e verificação DOM na largura real
  de 392 px CSS: nomes, tamanhos e estados legíveis, sem overflow horizontal. Isso
  não valida leitor de tela, todos os tamanhos de fonte ou outras larguras.

O aparelho rejeitou `adb shell input keyevent` com `INJECT_EVENTS`; nenhuma permissão
do sistema foi alterada para contornar isso. Seleções gráficas são feitas pelo usuário.
Fontes EPUB/MP3 sintéticas foram disponibilizadas em
`Download/minhaestante-ui-20261027`. A primeira tentativa de localização manual não
encontrou os arquivos; após solicitar atualização do índice Android apenas para os
dois arquivos sintéticos, sua presença foi confirmada no seletor e o usuário concluiu
as seleções. Originais, cópias gerenciadas e registros de teste foram preservados.

Versões e datas de atualização conferidas antes/depois: DEV `2.0-31`, atualizado
em `2026-10-26 21:04:41`; produção `2.0-31`, atualizado em `2026-10-25 19:04:33`,
conforme valores retornados pelo Package Manager. Nenhuma instalação foi atualizada.
Ao terminar, o app DEV ficou nos detalhes do livro sintético, com os assets temporários
ativos apenas no processo corrente. Uma nova morte do processo volta ao diagnóstico
empacotado anterior; os dados SQLite/SAF persistidos permanecem.

Roteiros, snapshots e screenshot deste ensaio ficaram somente em `/tmp`, incluindo
`minhaestante-native-verify.mjs`, `minhaestante-native-regression.mjs` e
`minhaestante-native-ui-before-reopen.json`. Não foram adicionados binários ou
snapshots de biblioteca ao repositório. Nesta etapa foram alterados apenas este
relatório e o documento de contexto; os 570 testes/TypeScript/builds da etapa anterior
não foram repetidos, pois não houve alteração de código.

## Pendências e limites

- Android DEV: perda/revogação real de acesso com a nova interface, navegação e
  cancelamento durante cópia maior, novos provedores SAF e novos pacotes instaláveis.
  Importação pelos dois slots, seletor gráfico, cancelamento do seletor, reabertura e
  concorrência/rollback SQLite reais foram confirmados acima. Não houve teste de nova
  migração de esquema; a instalação existente já estava em SQLite v2.
- Validar outras larguras móveis, tamanhos de fonte e navegação por teclado/leitor
  de tela. Inspeção visual a 392 px CSS não comprova todos esses comportamentos.
- Repetir o fluxo da nova interface em Firefox, Safari e PWA instalada. As evidências
  históricas da infraestrutura na Fase 2.4 não aprovam automaticamente esta UI.
- Confirmar novamente a regressão com backup privado externo somente quando houver
  cópia autorizada. A suíte sintética de regressão passou; nenhum backup pessoal foi
  consultado nesta continuação.
- As pendências de retenção, recuperação, provedores SAF adicionais e privacidade
  histórica da Fase 2.4 permanecem. ZIP continua sem mídias. Sem limpeza automática,
  migração SQL, publicação, alteração de versão/assinatura, commit ou push.
