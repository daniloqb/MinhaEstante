# MinhaEstante 2.2C — implementação e validação

Data: 26/10/2026. Branch de trabalho: `feature/posse-independente`.
Alterações locais anteriores foram preservadas. Sem commit, push, reescrita,
release, limpeza de dados, alteração de versão ou assinatura de produção.

## Segurança do repositório

- Identificados um ZIP pessoal e quatro textos importados rastreados em public.
  Cópias privadas externas foram preservadas e comparadas antes das remoções.
  Destino local: `~/.local/share/minhaestante/private-fixtures/`, diretórios privados
  e arquivos com modo 0600. Nenhum conteúdo pessoal consta deste relatório.
- Removidas também cópias derivadas idênticas em dist/assets Android. As remoções
  dos arquivos rastreados constam do diff atual; nenhuma mudança foi staged.
- `.gitignore` e guarda Vite previnem nova publicação acidental. Ícones públicos
  legítimos continuam acessíveis. Testes usam fixture sintética por padrão.
- Backup histórico executado explicitamente via `MINHAESTANTE_PRIVATE_BACKUP`:
  nove testes em dois arquivos aprovados; contagens 215 livros, 207 capas,
  141 possuídos e 97 lidos, incluindo persistência SQLite desktop e roundtrip.
- O ZIP permanece em commits anteriores e referências remotas locais. Não houve
  consulta ao host remoto nem expurgo. Coordenar remoção de histórico, caches,
  artefatos publicados, clones e forks antes de nova distribuição pública.
- Encontrados 21 APKs/AABs antigos com caminhos de imports privados no pacote.
  Permanecem localmente preservados. Downloads HTTP desses pacotes são recusados;
  caminhos alternativos de download também são bloqueados. Não foram gerados
  novos pacotes release. Distribuições já baixadas não são corrigidas por isso.
- Rota que servia keystore removida. Bloqueios conferidos via HTTP real no servidor
  `node server.ts` e no Vite direto; health/favicon legítimos preservados. Keystore
  ausente na raiz atual; nenhum arquivo de chave rastreado identificado. Não foi
  provado acesso anterior à rota. Investigar logs de hospedagem; caso haja exposição,
  tratar a chave/credenciais com o serviço de distribuição e Play Console. Nenhuma
  chave foi movida, apagada, alterada ou impressa.
- Removida a injeção automática da variável secreta GEMINI do servidor no bundle.
  Uso da chave pessoal configurada pelo usuário e endpoint de resumo preservados.

## Políticas implementadas

`ReaderPosition` é uma posição atual, não histórico de leitura. Conteúdo idêntico
exige SHA-256/formato/tamanho iguais e destino verificado; preserva IDs de anexo e
posição. Recibo validado também precisa concordar com formato/tamanho da solicitação.
Conteúdo diferente com posição exige `invalidate-current`; invalidação por cascata
e inserção do novo anexo ocorrem na mesma transação curta. Falhas restauram posição
e vínculo anteriores. Desassociação exige `remove-current` quando há posição e
nunca exclui bytes, livro, outro slot, sessões ou progresso deliberado.

Journal v2, compatível com v1, persiste token UUID, árvore, subpasta e fingerprint
antes da criação SAF, depois URI imediatamente. Mutex explícito protege as gravações
AtomicFile; locks por operação e serialização da subpasta gerenciada preservam
concorrência sem manter transação bibliográfica durante cópia/hash.

Recuperação sem URI busca apenas na subpasta registrada; candidato único precisa
ter identificador/MIME/tamanho/hash corretos. Vazios, renomeados, ambíguos, listagens
incompletas e falta de acesso ficam pendentes, sem nova cópia, overwrite ou exclusão.
Não se declarou eliminada a janela inerente ao SAF. Reconciliação de vínculos
consulta SQLite real; arquivos preparados sem recibo não escolhem livro e também
revalidam integridade/disponibilidade. Repetição é idempotente nos casos recuperáveis.

Arquivos já vinculados permanecem protegidos. Recibos COMPLETED sem referência
SQLite atual entram na fila de revisão de retenção; isso não autoriza exclusão.
A exclusão definitiva desses arquivos e a compactação do journal aguardam protocolo
seguro e autorização explícita. Declarações arbitrárias da WebView não liberam
exclusão. Arquivos desconhecidos e origens pessoais permanecem fora dessa operação.

## Android físico

Aparelho 22101316G, Android 14/API 34, ADB autorizado novamente. Somente
`com.booknookapp.dev`, com assets diagnósticos isolados e fontes/livros sintéticos.
Conferidos ID do APK e ausência de imports privados/chaves. Instalação por atualização,
sem desinstalar ou limpar dados. UID/versão/data de atualização da aplicação principal
foram comparados antes/depois e permaneceram iguais.

| Teste | Resultado | Ambiente |
| --- | --- | --- |
| Substituição com posição existente | Aprovado | Android físico, SQLite nativo + SAF local |
| Substituição idêntica | Aprovado: ID e posição exatos preservados | Android físico, EPUB |
| Falha durante substituição | Aprovado: rollback de INSERT e da transação preservou posição/vínculo | Android físico, falhas DEV injetadas na transação nativa |
| Recuperação após criação SAF | Aprovado para proteção/idempotência da pendência; adoção de candidato completo não validada fisicamente | Android físico, falha DEV após criar documento vazio, antes da URI |
| Recuperação após falha SQLite | Aprovado, inclusive commit antes da finalização nativa | Android físico, SQLite nativo |
| Journal concorrente | Aprovado: duas importações e duas recuperações distintas | Android físico, dois workers nativos |
| Permissão revogada de verdade | Aprovado, incluindo reautorização da árvore original | Android físico, releasePersistableUriPermission + seletor manual |
| Pasta somente leitura | Pendente | Provedor adequado não disponível nesta sessão |
| Provedor indisponível | Pendente para indisponibilidade real | Cobertura automatizada/injeções não substitui provedor físico |
| Reinicialização do celular | Pendente | Não foi executado adb reboot nem reboot manual |

A matriz inicial executou 31 verificações com SAF/SQLite reais. EPUB idêntico
preservou posição CFI; PDF diferente exigiu decisão e descartou a posição incompatível
somente ao confirmar. EPUB seguinte não reutilizou página PDF. Troca MP3→M4B com
posição também invalidou timestamp e preservou o e-book. Sessões/progresso deliberado,
posse, modalidades e status foram preservados. Desassociação com posição exigiu
decisão e conservou o outro slot e bytes. Exclusão de arquivo anteriormente ligado
foi recusada com ATTACHMENT_CONFLICT; token desconhecido retornou INVALID_REFERENCE.

Falhas DEV reais sobre I/O/SQLite foram injetadas antes da intenção, entre criação
SAF e URI, após cópia, antes de FILE_READY, no INSERT, na transação antes do commit
e na conclusão do journal após commit. Repetir recuperações não duplicou vínculos.
O documento vazio sem URI permaneceu CREATING/RECOVERY_REQUIRED protegido, sem
adoção ou descarte automático. Candidato completo sem URI foi validado somente
nos testes JVM com backend de arquivos temporários, não num provedor Android real.

Revogação real removeu flags persistidas de leitura/escrita. Plugin informou
permission-revoked; TypeScript retornou PERMISSION_REVOKED em metadados/recuperação,
sem apagar livro, anexos, posições ou sessões. A primeira seleção manual autorizou
outra árvore e não recuperou os arquivos antigos, comportamento esperado. O seletor
foi aprimorado para apontar à árvore original conhecida pela operação; autorização
manual correta recuperou metadados/acesso e preservou o estado bibliográfico.

Morte de processo: force-stop somente DEV durante COPYING, com 57.016.320 bytes
persistidos. Após nova abertura, recuperados 104.858.276 bytes do PDF sintético,
mesmo token, único registro e verificação de integridade. Nova recuperação também
aprovada. A configuração SAF continuou disponível após recriação de processo;
isso **não comprova persistência após reboot do Android**.

Cancelamento do seletor: tentativa via ADB foi bloqueada pelo Android por ausência
de INJECT_EVENTS. Usuário informou ter pressionado Voltar; a chamada observada
retornou success, portanto USER_CANCELLED não ficou comprovado nesta sessão.
Permanece pendente repetir manualmente até retornar ao app sem confirmar pasta.
Nenhuma permissão de injeção foi habilitada. O retorno ao aplicativo e a configuração
accessible foram observados.

## Compilação e regressões automatizadas

| Verificação | Resultado efetivamente executado |
| --- | --- |
| npm test / Vitest completo | 463 testes, 30 arquivos, zero falhas; 19 testes a mais que a base de 444 |
| Kotlin/JVM | 32 testes, zero falhas/erros/skips; nove a mais que a base de 23 |
| Backup histórico privado externo | 9 testes adicionais executados, sem copiar fixture para distribuição |
| TypeScript / npm run lint | Aprovado |
| Web/PWA | Vite production aprovado, saída temporária fora do repositório |
| Gradle | assembleDebug + testDebugUnitTest aprovados offline, assets DEV isolados |
| HTTP servidor e Vite | Rotas sensíveis bloqueadas; endpoints legítimos preservados |
| git diff --check | Aprovado |

Vitest inclui contratos, armazenamento, posse/formatos, SQLite desktop, migrações,
backup, posições e publicação. Não é instrumentação Android. JVM inclui codec v1/v2,
falha do próprio journal, intenção anterior à criação, adoção íntegra, ambiguidades,
indisponibilidade, concorrência e idempotência com arquivos temporários; também não
é evidência física Android. Aviso Vite de bundle acima de 500 KiB e avisos Gradle
de APIs obsoletas continuam presentes, sem falha de compilação.

Executado `tsc`/Vite diretamente, em vez do script composto que mascara erro de cap
sync. Não se executou cap sync; a compilação Android foi validada separadamente
pelo script diagnóstico com assets auditados. Não foram publicados artefatos.

## Roteiro manual e continuidade

1. Cancelar seleção de pasta e documento com Voltar até retornar ao DEV; confirmar
   USER_CANCELLED e preservação da configuração, vínculos e journal.
2. Em provedor que ofereça pasta somente leitura, confirmar read-only/importação
   impedida, sem modificar anexos anteriores. Não simular isso como teste físico.
3. Em provedor removível/nuvem de teste, tornar indisponível temporariamente;
   conferir erro, vínculos preservados e disponibilidade após reconectar.
4. Reiniciar manualmente o celular com autorização explícita, reabrir DEV e conferir
   concessões persistidas, integridade, vínculos e journal. Não limpar os dados.
5. Validar candidatos completos/nomes alterados/listagens parciais em mais provedores.
6. Coordenar expurgo de histórico e retirada de distribuições/cache antigos. Preservar
   as cópias privadas; não redistribuir pacotes antigos para facilitar testes.

Fase 2.3 Web/OPFS: contratos, posições e coordenação estão disponíveis para reutilizar.
Ainda é necessário implementar registro/journal duráveis OPFS/IndexedDB, identidade
independente de nomes, quotas, persistência/evicção, cancelamento, recuperação e testes
em navegadores reais. Tokens SAF não são portáveis. Política definitiva de descarte,
poda de journal e limitações de outros provedores permanecem registradas; OPFS não
foi implementado nem validado nesta fase.

## Arquivos envolvidos nesta etapa

- Segurança: `.gitignore`, `server.ts`, `vite.config.ts`,
  `scripts/publicAssetPolicy.ts` e remoções controladas em public.
- Coordenação: `src/services/storage/digital/DigitalAttachmentCoordinator.ts`,
  `attachmentPlanning.ts`, `operations.ts` e bridge Android.
- Nativo: `DigitalStorageCore.kt`, `AndroidMetadataFiles.kt`,
  `DigitalLibraryStoragePlugin.kt` e `DigitalStorageCoreTest.kt`.
- Diagnóstico: `src/dev/saf/controller.ts` e `main.tsx`.
- Testes: coordenador, guarda de publicação, referência de backup, posse SQLite
  e gerador `src/__tests__/helpers/syntheticLegacyBackup.ts`.
- Documentação: arquitetura, contexto e este relatório. Mudanças locais anteriores
  em build, banco, testes e outros arquivos não foram descartadas nem atribuídas
  integralmente a esta etapa.
