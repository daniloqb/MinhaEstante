# MinhaEstante 2.0 — Fase 4.2A: prova de streaming ZIP e interoperabilidade

Data: 29/10/2026. Branch: `feature/posse-independente`.

## 1. Resumo executivo e fronteira

**Backup v2 — Streaming Proof of Concept**, separado do produto. Existem escritor
Kotlin debug e escritor/leitor TypeScript experimentais, executados com arquivos
sintéticos, filesystem real, SAF e OPFS. O ZIP legado, interface pública, SQLite,
ReaderPosition e provedores existentes não foram modificados. Não há restauração
nem exportação v2 disponível ao usuário. Publicação continua bloqueada.

O motor Kotlin é `java.util.zip.ZipOutputStream`, buffer limitado e SHA-256 via
MessageDigest. O motor Web é **@zip.js/zip.js 2.24.0**, dependência **de desenvolvimento**
com versão fixa, licença BSD-3-Clause, origem oficial
[gildas-lormeau/zip.js](https://github.com/gildas-lormeau/zip.js). Foram alterados somente
package.json/lockfile para essa dependência, sem scripts de instalação. Não há import
experimental pelo barrel de produção ou pelo aplicativo.

Resultado central: interoperabilidade por **ZipFile + zip.js** comprovada. Leitura
sequencial por **ZipInputStream não está aprovada** para os arquivos Web ensaiados.
ZIP64 estrutural e contagem acima do limite clássico foram testados; tamanho real
acima de 4 GiB não foi testado. Pausas na thread principal Web exigem worker antes
de integração pública de operações longas.

## 2. Baseline, auditoria e ambientes

As alterações locais completas da 4.1 foram preservadas, sem commit. Lidos AGENTS,
contexto/arquitetura 2.0, arquitetura 4.1, relatórios SAF/OPFS/2.4/3.3 e código efetivo.
A auditoria 4.1 continua válida: ZIP v1 usa JSZip 3.10.2, manifest.json/books.json/covers,
Blob + Base64 integrais e geração dupla. Nada desse serviço foi trocado pelo protótipo.

| Ambiente verificado | Evidência/limite |
| --- | --- |
| Baseline Vitest | 722 testes / 36 arquivos, zero falhas |
| Baseline TypeScript | npm run lint aprovado |
| JDK | OpenJDK 21.0.12.1, Linux x86_64 |
| Gradle | 8.14.3 local/offline; toolchain JVM 21; Kotlin Android já instalado |
| JVM anterior | 32 testes existentes reexecutados junto dos novos na primeira passagem; a consulta inicial estava UP-TO-DATE |
| Desktop | Chrome 156.0.8078.47 e Firefox 158.0.1, perfis novos exclusivos |
| Host | cerca de 263 GiB livres em /tmp, 1,2 TiB no volume do repositório no início |
| Android físico | 22101316G, Android 14/API 34; ADB reconfirmado, cerca de 33 GiB livres |
| DEV | com.booknookapp.dev, 31/2.0-31, certificado Android Debug; atualização install -r autorizada explicitamente pelo usuário |
| Principal | com.booknookapp, 31/2.0-31; data de atualização de referência 25/10/2026, sem atualização/instalação/abertura pela prova |
| Safari/PWA instalada | Não executados nesta fase; resultados históricos não são reaprovados automaticamente |

ADB/Gradle/Firefox exigiram execução fora do sandbox para sockets/caches/Snap.
O build APK foi inicialmente bloqueado pela revisão automática por falta de autorização
interpretada como explícita; o usuário autorizou gerar/atualizar **somente DEV**, e
o pacote foi auditado antes de install -r. Não houve bypass, release ou cap sync.

## 3. Arquitetura experimental e isolamento

```text
experiments/backup-zip-proof/ + vite.backup-proof.config.ts
  → entrada local src/dev/backupZipProof/main.ts
  → provedor OPFS / IndexedDbStore existentes, namespace e origem exclusivos
  → experimental/streamingProof.ts + syntheticDataset.ts
  → WritableStream OPFS ou FileSystemFileHandle externo

android/app/src/debug/...
  BackupZipProof (sem Android/SQL)
  BackupZipProofActivity (SAF, debug + applicationId DEV)
  → ImportJournal/AndroidMetadataFiles existentes, somente dev-proof-42a-*
  → ContentResolver → ZipOutputStream → destino escolhido no seletor
```

Não existe método novo de backup no plugin Capacitor de produção. A Activity e seu
manifesto estão somente em src/debug; o acesso externo exige a permissão DUMP do
chamador (ADB), sem adicionar uses-permission nem conceder permissão global ao app.
O servidor experimental escuta apenas loopback e serve/transfere somente nomes
sintéticos permitidos dentro de /tmp/minhaestante-4-2a-*, com marcador próprio.
Não importa a configuração de produção, public/, service worker ou rotas do servidor
principal. Artefatos e perfis não foram publicados.

## 4. Fixture v2 e validade dos formatos

Estrutura efetiva, compatível com os contratos da 4.1:

```text
manifest.json                    backupVersion:2
books.json                       duas obras com UUID, posse=false e modalidade física
reading.json                     posição EPUB, sessão ativa e progresso manual
covers/proof.png                 PNG RGBA 1×1 válido na revisão final
media/ebooks/proof-epub.epub      EPUB 3, mimetype STORED, container/OPF/nav/XHTML
media/ebooks/proof-pdf.pdf        PDF com catálogo, página, fonte, stream e xref real
media/audiobooks/proof-mp3.mp3    frames MPEG-1 Layer III de silêncio sintético
```

Os nomes físicos permanecem ASCII por exigência da 4.1. Unicode (`ação 日本語`) está
nos títulos e nomes originais do manifesto. Um teste genérico Kotlin adicional usa
nome de entrada Unicode; isso não relaxa a allowlist v2. Entrada vazia é testada no
codec genérico; mídia vazia continua rejeitada pelo contrato. M4A/M4B são gerados pelo
diagnóstico nativo existente, mas não integram a matriz de payloads desta prova.

O PDF grande tem um stream binário não referenciado com bytes pseudoaleatórios
determinísticos, gerados em blocos. Assim a progressão não mede apenas compactação
de zeros. O PDF SAF de 100 MiB usa a fixture nativa existente de zeros; seus números
de compressão não são comparáveis diretamente aos PDFs pseudoaleatórios desktop.
Não foram alterados os validadores de produção para aceitar fixtures inválidas.

Uma primeira fixture PNG tinha CRC IDAT incorreto. Foi corrigida, seus descritores
recalculados e a matriz final repetida com novos rótulos `*-final`. Os resultados
preliminares permanecem temporários e não são a evidência final da capa válida.

## 5. Pipeline Kotlin e acesso SAF

`BackupZipProof.write` aceita fontes reabríveis e um OutputStream sem seek. Lê em
buffer configurável de 1–256 KiB (padrão **64 KiB**), atualiza SHA-256/CRC e grava
sequencialmente. O modo STORED faz uma leitura prévia para tamanho/CRC e compara
o SHA da segunda leitura. DEFLATE nível 1 dispensa essa pré-leitura, usa descriptors
e permite tamanho desconhecido. A seleção é baseada nas medições abaixo.

No aparelho, o usuário escolheu pasta sintética pelo seletor SAF existente. Fontes
foram geradas/importadas pelo plugin/serviço de armazenamento já existentes,
**sem associação bibliográfica**. A Activity resolve apenas recibos cujo operationId
começa com dev-proof-42a- e filename sintético. Reutiliza ImportJournal e o registro
privado de árvores, revalida a concessão persistida e abre ContentResolver. URI não
atravessa JavaScript, manifesto ou logs. Não há acesso por caminho físico ao documento.

O destino foi escolhido manualmente com ACTION_CREATE_DOCUMENT. A escrita nativa
foi diretamente para ContentResolver.openOutputStream, sem seek, rename ou substituição
atômica presumidos. Finalização requer finish/flush/close e reabertura. Para ZipFile,
o ZIP foi copiado em blocos a um temporário privado próprio, por exigir acesso
posicionável; essa cópia em disco não é materialização integral em memória.

Prova física registrada: **104.903.911 bytes de entrada**, ZIP **461.367 bytes**,
**466 ms** de escrita (exclui geração/importação/reabertura), máximo de leitura
**65.536 bytes**, heap Java amostrado **8.217.864 bytes**, PSS após operação
**154.408 KiB**. Fontes reabertas com tamanho/hash idênticos. SHA-256 do arquivo SQLite
DEV foi igual antes/depois do experimento nativo; nenhuma consulta/gravação de livros,
posições, sessões ou progresso foi necessária para a prova.

## 6. Pipeline Web e OPFS real

O diagnóstico usa WebOpfsStorageProvider, BrowserOpfsFiles e IndexedDbStore existentes
em namespace/banco exclusivos, sem segunda infraestrutura de anexos ou domínio real.
Fontes sintéticas são escritas incrementalmente no OPFS, registradas/importadas pelo
provedor e verificadas. A leitura experimental de FILE_READY usa o adaptador de
arquivos injetado e recibo verificado: não fabrica link bibliográfico para satisfazer
acquireReadAccess, que hoje exige associação confirmada. A 4.2B precisa definir uma
porta deliberada de managed-source com política de concorrência/propriedade.

Cada OPFS File é lido por slices limitadas em ReadableStream. O ZIP recebe uma entrada
por vez, `bufferedWrite:false`, um codec, `dataDescriptor:true`, `maxWorkers:1` e
`useWebWorkers:false` nesta medição. A saída é WritableStream real, com backpressure
até createWritable. Não há BlobWriter, Base64, arrayBuffer de mídia inteira, concatenação
de todos os arquivos, buffer SQLite ou localStorage. JSONs/fixtures pequenos podem
ser materializados dentro de limites explícitos.

A documentação do motor confirma que paralelizar entradas pode ativar buffering de
uma entrada inteira. O ensaio usa entradas sequenciais e escrita direta; paralelismo
não está liberado pela simples existência de Streams.
[Opções oficiais zip.js](https://gildas-lormeau.github.io/zip.js/api/interfaces/ZipWriterConstructorOptions.html).

## 7. Destinos externos e diferenças de navegador

| Destino | Resultado desta fase |
| --- | --- |
| SAF Android | Seleção manual oficial, escrita incremental direta, close, reabertura e hash aprovados |
| OPFS Chrome/Firefox | Escrita incremental e reabertura após reload aprovadas; armazenamento interno, não entrega externa |
| Chrome desktop externo | showSaveFilePicker real, seleção manual do usuário, createWritable, close e reabertura aprovados para ZIP pequeno de 4.519 bytes |
| Firefox externo | showSaveFilePicker ausente no Firefox 158 ensaiado; sem fallback Blob gigante, servidor terceiro ou SW novo |
| Chrome Android externo | **Parcial**: API detectada e seletor usado; escrita chegou a close, mas duas tentativas de reabertura falharam com ZIP_FORMAT. Entrega externa não aprovada |
| Safari | Ambiente real indisponível; pendente |

A abertura do seletor externo ocorre diretamente no gesto, antes de awaits de
planejamento. Cancelamento e erros de permissão não significam arquivo salvo. A API
de File System Access externa difere do OPFS, exige feature detection e concessão.
[Guia oficial](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access).
PWA instalada não foi testada nesta prova e não ganha capacidades por inferência.

Recomendação 4.2B: destino externo incremental nos ambientes efetivamente compatíveis;
OPFS é staging, não conclusão da exportação. Firefox requer solução de entrega
separada, com limites e ensaio próprios. Enquanto ausente, manter backup legado e
informar a limitação, sem anunciar exportação grande concluída.

## 8. Interoperabilidade e leitor independente

| Emissor | Leitor | Evidência |
| --- | --- | --- |
| Kotlin JVM | Kotlin/Java ZipFile | Todos os tamanhos, STORE e DEFLATE1, CRC/tamanho/SHA comparados |
| Kotlin JVM | zip.js Node/Chrome/Firefox | Manifesto v2 e payloads verificados; browsers reais leem os ZIPs pequenos e count ZIP64 |
| Kotlin SAF Android | zip.js Chrome/Firefox | ZIP físico de 461.367 bytes, payload de cerca de 100 MiB, contrato e SHA verificados |
| zip.js Node | Java ZipFile JVM e Android físico | Pequeno automático/ZIP64 forçado aprovados |
| zip.js Chrome/Firefox/Chrome Android reais | Java ZipFile JVM e Android físico | Seis ZIPs de padding 1 MiB, STORE/DEFLATE1; CRC/tamanho/SHA dos payloads conferidos |
| zip.js Web | zip.js Web | Quatro tamanhos, STORE/DEFLATE1, reabertura/hash, reload OPFS |
| Ambos | Python zipfile / Info-ZIP | Verificação adicional independente, quando indicada nos comandos/evidências finais |

A comparação é semântica. Timestamps/ordem/extras/nível de compressão podem alterar
o ZIP sem alterar os arquivos. Observações do JVM/Android são comparadas aos mesmos
descriptors v2 por validateBackupFileIntegrity; não há outro schema independente.

**Restrição demonstrada:** JDK21 ZipInputStream rejeitou STORE com EXT descriptor
(`only DEFLATED entries can have EXT descriptor`) e ZIP64 desconhecido nos arquivos
Web (`invalid entry size (expected 0 but got ... bytes)`). ZipFile os leu e verificou
corretamente. Não generalizar JDK desktop para todas as versões Android; os testes
físicos desta fase usam ZipFile, não aprovam ZipInputStream. A 4.3 deverá usar leitor
posicionável ou provar outra engine; SAF de entrada pode exigir staging limitado em
disco, com quota/cancelamento/recuperação próprios.

## 9. ZIP64: o que foi realmente comprovado

| Caso | Resultado |
| --- | --- |
| ZIP64 forçado em ZIP Web pequeno | Estrutura/extras lidos por zip.js, Java ZipFile e Android ZipFile |
| Tamanho de fonte desconhecido | Escrita em Streams e DEFLATE Kotlin; total de progresso null, sem percentual inventado |
| 65.536 entradas Kotlin | ZIP de **6.400.406 bytes**, EOCD ZIP64, Java e browsers reconheceram a contagem |
| ZIP individual >4 GiB | **Não executado; suporte acima de 4 GiB não comprovado fisicamente** |
| Entrada individual >4 GiB | Não executada |
| Offsets/soma de entradas >4 GiB | Não executados |
| Contagem >65.535 no Android físico | Não ensaiada no aparelho; teste de contagem foi JVM→Web |
| Limites 16 GiB/entrada e 256 GiB/backup | Permanecem tetos de política da 4.1, não capacidade aprovada |

Mesmo sem forceZip64, uma entrada de stream cujo tamanho não foi informado pode
induzir ZIP64. O arquivo web-node-small.zip não deve ser descrito como puramente
clássico só porque é pequeno: a versão necessária inclui 45 para o manifesto.
Arquivos Kotlin pequenos observados são clássicos (versões 10/20); o count case usa
EOCD ZIP64. O ensaio não forçou estruturas falsas de vários GiB nem criou arquivos
multigigabyte automaticamente.

## 10. Integridade e hashes reproduzíveis

| Mídia sintética | Bytes | SHA-256 |
| --- | ---: | --- |
| EPUB Web/JVM | 1.281 | d950388261f5d44c88b26edf823a06b18cf5f48bfc542662f3937858f40d412b |
| MP3 | 41.700 | ece91d3408254afd113f60893476145db69960b6ea2dd0898a930ee4dd413906 |
| PDF com padding 1 MiB | 1.049.249 | 131d655e05d6857c4ff25f0b56809a84290725df20bd25ec34e82d832ef68da5 |
| PDF com padding 16 MiB | 16.777.891 | 473de97452124d337dec5a4bcb6045b5cd43c00da844c825dd92a7a94bbcfcc0 |
| PDF com padding 64 MiB | 67.109.539 | 932179564c159a620c64a74b1cc570b4d70430a3e405ba99a735a0c12d384e31 |
| PDF com padding 128 MiB | 134.218.405 | c7dc4975fac22f2d155b873619008cc409cb4d33815a31f590038e038817f3f0 |
| EPUB gerado no Android | 1.352 | 6d0fcc0373753b1a4661b8bfc14f34a0a6dd20250f006fb0471675b86586dc3c |
| PDF SAF 100 MiB | 104.858.276 | 6478cbf246ea48262c42946d10dab6a0f797fbed36fe7aef6cdf220f851903f2 |

O hash do EPUB Android pode mudar se a fixture nativa for regenerada com outros
timestamps ZIP. A comparação válida usa o manifesto efetivamente emitido, não força
igualdade binária entre as fixtures de engines diferentes. SHA-256 verifica bytes,
não autenticidade de backup de terceiros.

## 11. Memória, desempenho e espaço

As medições finais detalhadas ficam nos relatórios sintéticos /tmp/minhaestante-4-2a-*.
Escrita e verificação têm tempos separados; preparação inclui
geração, fingerprints, cópia OPFS e promoção. Não tratá-la como tempo só do ZIP.

Tempos de escrita em segundos (STORE / DEFLATE1), mesma progressão sintética:

| Padding PDF | JVM Linux | Chrome desktop | Firefox desktop | Chrome Android |
| --- | ---: | ---: | ---: | ---: |
| 1 MiB | 0,011 / 0,046 | 0,315 / 0,398 | 0,433 / 0,368 | 0,934 / 0,816 |
| 16 MiB | 0,133 / 0,674 | 2,512 / 3,134 | 2,565 / 3,484 | 2,813 / 3,983 |
| 64 MiB | 0,525 / 2,667 | 9,116 / 10,040 | 9,213 / 11,658 | 12,275 / 14,144 |
| 128 MiB | 0,944 / 5,301 | 12,982 / 18,125 | 15,158 / 21,939 | 30,401 / 28,173 |

No caso de 128 MiB, throughput de entrada aproximado STORE/DEFLATE1: JVM
135,6/24,2 MiB/s; Chrome 9,86/7,06; Firefox 8,45/5,84; Chrome Android 4,21/4,54.
O tempo JVM STORE inclui a pré-leitura, mas seu contador inputBytes conta apenas a
passagem escrita (I/O da fonte é aproximadamente 2×). Estes são ensaios isolados,
com cache e runtimes diferentes, sem pretensão de benchmark universal.

| Caso de 128 MiB | ZIP STORE / DEFLATE1 (bytes) | Heap amostrado STORE / DEFLATE1 | Verificação STORE / DEFLATE1 |
| --- | ---: | ---: | ---: |
| JVM | 134.265.106 / 134.262.727 | 7.679.272 / 20.264.608 bytes | fora do tempo de escrita |
| Chrome | 134.264.802 / 134.263.265 | 60.992.302 / 82.584.989 bytes JS | 5,080 / 4,873 s |
| Firefox | 134.264.802 / 134.263.265 | indisponível | 8,254 / 8,329 s |
| Chrome Android | 134.264.802 / 134.263.265 | API retornou 10.000.000 em todas as amostras; **não útil como pico** | 4,359 / 4,471 s |

RSS JVM nesse par: 123.388 / 124.168 KiB; runs pequenos anteriores ainda incluem
memória do build/test runner e chegaram a 465.992 KiB. Não confundir heap do par
grande com teto de todo o processo. Ping externo durante o ensaio completo mostrou
pausas de até 7,066 s Chrome, 7,402 s Firefox e 5,309 s Chrome Android; timer interno
sozinho subestima bloqueios. A matriz principal foi executada antes de acrescentar
o preflight EOCD limitado; o codec e configuração permaneceram iguais. Após a mudança,
um novo par Chrome de 1 MiB mostrou zero entradas bufferizadas e no máximo uma
entrada direta simultânea; Firefox reabriu o ZIP de 128 MiB já persistido.

O PDF pseudoaleatório quase não ganha com DEFLATE: no ZIP Web grande, a economia
total foi de apenas 1.537 bytes, enquanto o custo desktop aumentou. O ZIP pequeno,
com PDF curto e áudio silencioso, cai de 47.350 (Kotlin STORE) para 3.981 bytes
(DEFLATE). Recomenda-se decidir por tipo/amostra e custo de releitura: STORE nativo
exige CRC/tamanho prévios, DEFLATE baixo permite passagem única. Não derivar taxas
para audiolivros reais de uma fixture silenciosa.

O maior PDF pseudoaleatório ensaiado tem **134.218.405 bytes**; o maior ZIP tem cerca
de 134,3 MB. Buffers de entrada/saída do escritor Web foram no máximo 64 KiB; leitura
de validação pode emitir 256 KiB conforme engine/configuração. Kotlin mantém buffer
fixo de 64 KiB. Metadados crescem com quantidade de entradas, não precisam ter memória
constante em um teste com 65.536 entradas.

Na JVM, a primeira instrumentação de RSS em todo bloco alocava objetos desnecessários;
foi reduzida a amostragem de 50 ms, com GC apenas na fronteira do teste para comparar
runs. O pico observado não é pico absoluto. JVM desktop inclui framework/testes;
heap não equivale a RSS ou a buffers nativos. No Android PSS inclui Activity/WebView
do DEV, não apenas o codec. Chrome fornece heap JS aproximado/CDP; Firefox não
ofereceu métrica equivalente confiável. Não se declara memória total Web medida.

Não há retenção do ZIP inteiro no caminho executado: entradas sequenciais, sink
durável, backpressure e filas limitadas. Contudo observou-se crescimento transitório
de heap/GC e pausas perceptíveis da thread principal durante hashing/preflight/ZIP.
Essa implementação experimental sem worker não está pronta para UI de operação longa.
Mover a orquestração/hash/codec para worker e repetir responsividade é requisito 4.2B.

Espaço temporário: fontes OPFS + staging + committed + duas saídas STORE/DEFLATE podem
custar várias vezes o payload; não estimar apenas tamanho comprimido. O maior caso
isolado pode usar cerca de 5× a mídia, e a matriz retém casos anteriores. No aparelho,
SAF reteve fonte e cópia gerenciada de cerca de 100 MiB. Nada preexistente foi apagado
para abrir espaço. Quotas foram consultadas antes; estimativas não são reservas.

## 12. Cancelamento, falhas e resultado incompleto

Progresso deriva dos contadores reais e reutiliza BackupOperationProgress, acrescido
de fase, arquivo e bytes escritos. Entrada lida não equivale a tamanho ZIP. A função
de escrita devolve **closed-unverified**, jamais complete; conclusão só após reabrir,
validar manifesto/inventário e conferir todos os hashes.

Testes controlados cobrem cancelamento antes de iniciar, leitura, escrita, entre
entradas e antes/durante finalização. Cancelar após close/verificação não desfaz o
resultado nem apaga arquivo existente. São injeções em streams/JVM, não prova de
morte de processo ou gesto físico de cancelar durante cada cenário.

Falhas distinguem source-unavailable/source-read, destination-write/close, quota,
ZIP-format, manifest, integrity, unsupported e cancelled. Foram exercitados fonte
indisponível, leitura/escrita falhando, stream prematuramente fechado, quota simulada,
falha ao escrever diretório central, manifesto inválido, hash divergente, caminhos
inválidos/duplicatas e ZIP truncado. Revogação SAF desta fase é cobertura simulada;
a revogação física da 3.3 não foi recontada como teste novo.

Em erro/cancelamento, não chamar close do ZipWriter para “salvar” uma entrada parcial.
Abortar/fechar o stream subjacente e manter estado incomplete. Um provedor SAF pode
deixar o documento visível; a Activity guarda recibo privado antes de escrever e não
exclui o documento. A futura interface deve mostrar incompleto, bytes/etapa/código,
possibilidade de revisão e nunca sucesso por criação do documento ou timeout.

## 13. Segurança do leitor experimental

Os arquivos são lidos/hashados em sinks de descarte; nomes ZIP nunca são caminhos
de extração no dispositivo. Aplicam-se os validadores da 4.1: versão, campos, IDs,
slots, categorias, tamanho/hash, inventário bruto, limites, reading e referências.
Nomes brutos são comparados aos nomes decodificados, sem reparo silencioso. O leitor
usa strictness/filenameValidation estritos, detecta duplicatas/case collisions e
limita JSON experimental a 1 MiB (manifesto também limitado pela política). Antes
da biblioteca alocar inventário, um preflight limitado lê EOCD/ZIP64, rejeita
multivolume e limita contagem/bytes do diretório central. Uma revisão inicial
rejeitava o sentinela 0xffff válido de disco do ZIP64; foi corrigida e os testes
forçados/arquivos persistidos revalidados. Esse ajuste não resolveu o destino externo
Android: sua reabertura ainda falhou por ausência de EOCD reconhecível. Não se
atribui esse resultado a suporte de exportação comprovado nem a erro do usuário.

ZIP truncado, desconhecido, traversal, absoluto, manifesto excessivo, entrada
inesperada, hash/tamanho divergente são rejeitados. A prova não certifica todos os
ZIPs hostis, DRM, decodificação de mídia ou futura restauração. Parsing do catálogo
real, quotas durante transporte/staging e validação exaustiva de ZIP64 continuam
trabalho da integração. Nenhum arquivo arbitrário foi extraído em caminho do sistema.

## 14. Matriz de capacidade comprovada

“Aprovado” se refere somente ao alcance da evidência indicada; não promove ensaio
JVM/simulado a prova Android física.

| Capacidade | Kotlin Android físico | Chrome desktop | Firefox desktop | Chrome Android |
| --- | --- | --- | --- | --- |
| Leitura incremental da fonte | Aprovado: SAF 100 MiB | Aprovado: OPFS | Aprovado: OPFS | Aprovado: OPFS |
| Escrita incremental ZIP | Aprovado: SAF direto | Aprovado: OPFS + externo pequeno | Aprovado: OPFS | Aprovado: OPFS |
| Manifesto v2 / SHA-256 | Aprovado: validado também pelo Web | Aprovado | Aprovado | Aprovado |
| Reconhecido pelo outro ambiente | Aprovado: ZIP SAF→Web | Aprovado: Web→JVM/Android | Aprovado: Web→JVM/Android | Aprovado: Web→JVM/Android |
| ZIP64 estrutural | Aprovado para leitura Web; escritor físico gerou clássico | Aprovado: forçado + count Kotlin | Aprovado: forçado + count Kotlin | Aprovado: forçado + count Kotlin |
| ZIP/entrada >4 GiB | Pendente | Pendente | Pendente | Pendente |
| Arquivo grande | Aprovado: PDF 104.858.276 bytes | Aprovado: PDF 134.218.405 | Aprovado: PDF 134.218.405 | Aprovado: PDF 134.218.405 |
| Destino externo | Aprovado: seletor SAF + readback | Aprovado: ZIP 4.519 bytes | Pendente: API ausente; sem fallback validado | Parcial: escrita fechou, readback falhou |
| Cancelamento | Parcial: codec JVM injetado; gesto físico pendente | Parcial: streams Vitest, sem gesto externo | Parcial: mesma engine, runtime pendente | Parcial: runtime pendente |
| Falha de escrita/quota | Parcial: JVM injetado | Parcial: Vitest injetado | Parcial: runtime pendente | Parcial: runtime pendente |
| Progresso | Aprovado: contadores reais SAF | Aprovado: contadores reais | Aprovado: contadores reais | Aprovado: contadores reais |
| Memória medida | Parcial: heap/PSS amostrados | Parcial: heap JS/CDP | Parcial: tempo/responsividade, sem heap | Parcial: heap arredondado sem valor de pico |
| Reabertura persistida | Aprovado: SAF→cache→ZipFile | Aprovado: reload OPFS | Aprovado: reload OPFS | Aprovado: reload OPFS |

Safari real, PWA instalada, arquivos >4 GiB e perda de energia permanecem pendentes.
O relato manual de salvamento Android não foi usado para substituir o erro registrado
pelo leitor: duas tentativas de readback externo retornaram ZIP_FORMAT. A investigação
do documento/implementação externa deve anteceder qualquer liberação desse destino.

## 15. Testes e comandos reproduzíveis

Resultados finais:

- **761 Vitest / 37 arquivos aprovados**: 722 anteriores + 39 novos da prova.
- **47 JVM aprovados**: 32 anteriores + 15 novos; Gradle sem falhas, não UP-TO-DATE.
- TypeScript (`npm run lint`), build Web/PWA separado, build experimental e assembleDebug
  DEV aprovados. Não foi usado o build agregado com cap sync mascarado.
- Matriz real: oito runs OPFS por navegador (24), seis cruzamentos por navegador
  (incluindo contagem ZIP64), reload e readback; dois runs extras Chrome após revisão.
- Android físico: escrita SAF e preservação de fontes; ZipFile leu oito ZIPs Web,
  incluindo os seis dos browsers reais. Comparação semântica usa os contratos 4.1;
  o último runner conferiu 33 observações de arquivos dos relatórios JVM/Android.
- Python zipfile/CRC e pdfinfo confirmaram estruturas sintéticas; PNG final teve seus
  CRCs e stream zlib conferidos. Isso não substitui EPUBCheck/decodificação de áudio.
- Testes com buffers em memória e injeções de erro/cancelamento são simulados;
  filesystem JVM, OPFS real e SAF físico são evidências distintas.
- `git diff --check` e inspeção de whitespace dos arquivos novos aprovados; bundle
  público não contém motor/harness experimental. APK auditado: DEV, versão 31/2.0-31,
  certificado Android Debug, sem assets privados proibidos. install -r autorizado.
- SQLite DEV teve hash idêntico antes/depois; principal permaneceu versão/data iguais.

```bash
npm test
npm run lint
node --import tsx scripts/backup_zip_proof.mts prepare /tmp/minhaestante-4-2a-NOVO
MINHAESTANTE_ZIP_PROOF_DIR=/tmp/minhaestante-4-2a-NOVO \
  /caminho/gradle-8.14.3/bin/gradle -p android :app:testDebugUnitTest --offline --no-daemon --rerun-tasks
MINHAESTANTE_ZIP_PROOF_DIR=/tmp/minhaestante-4-2a-NOVO \
  node_modules/.bin/vite --config vite.backup-proof.config.ts
# Chrome com perfil NOVO exclusivo, porta CDP 9422, aberto em http://127.0.0.1:3422/
node scripts/validate_backup_zip_proof.mjs chrome 9422 chrome-final full
# Firefox headless com perfil exclusivo e WebDriver BiDi 9423, fora do sandbox Snap quando necessário
node scripts/validate_backup_zip_proof.mjs firefox 9423 firefox-final full
# Só após as gravações Web: repetir o teste JVM de interoperabilidade para ler os ZIPs recebidos.
MINHAESTANTE_ZIP_PROOF_DIR=/tmp/minhaestante-4-2a-NOVO \
  /caminho/gradle-8.14.3/bin/gradle -p android :app:testDebugUnitTest \
  --tests com.booknookapp.BackupZipProofTest --offline --no-daemon --rerun-tasks
node --import tsx scripts/backup_zip_proof.mts verify /tmp/minhaestante-4-2a-NOVO
node_modules/.bin/vite build --outDir /tmp/minhaestante-4-2a-public --emptyOutDir
git diff --check
```

`prepare` exige diretório novo/vazio, cria marcador e somente fixtures sintéticas.
`node --import tsx` evita o socket IPC do CLI tsx bloqueado no sandbox. A Activity
nativa usa diagnóstico SAF existente para gerar/importar dev-proof-42a-epub/pdf/mp3
sem link; seu destino exige toque/seleção manual. ADB transfere somente arquivos
de nomes controlados do cache backup-zip-proof. Nenhuma URI vai para relatório.

APK DEV só com autorização explícita, build de assets isolados via script existente,
auditoria de ID/assinatura/entradas e install -r. Nada de cap sync, release ou limpeza
de dados. Não reproduzir testes apontando uma origem/perfil pessoal.

## 16. Arquivos e reutilização futura

Criados nesta fase (todos experimentais ou documentação):

```text
android/app/src/debug/AndroidManifest.xml
android/app/src/debug/java/com/booknookapp/BackupZipProof.kt
android/app/src/debug/java/com/booknookapp/BackupZipProofActivity.kt
android/app/src/test/java/com/booknookapp/BackupZipProofTest.kt
docs/MINHAESTANTE_4_2A_ZIP_STREAMING_INTEROP.md
experiments/backup-zip-proof/index.html
scripts/backup_zip_proof.mts
scripts/validate_backup_zip_proof.mjs
src/__tests__/backup_zip_streaming_proof.test.ts
src/dev/backupZipProof/main.ts
src/services/storage/backupV2/experimental/streamingProof.ts
src/services/storage/backupV2/experimental/syntheticDataset.ts
vite.backup-proof.config.ts
```

Modificados nesta fase:

```text
package.json
package-lock.json
docs/MINHAESTANTE_4_1_BACKUP_V2_ARCHITECTURE.md
docs/MINHAESTANTE_2_0_CONTEXT.md
docs/MINHAESTANTE_2_0_ARCHITECTURE.md
```

Os arquivos de contratos/validação/planejamento/index e testes 4.1 já estavam locais
no início; foram preservados. O documento 4.1 recebeu apenas adendo de evidência.
O codec Web tem adaptação, eventos, limites e verificação; syntheticDataset gera
fixtures/projeção; main.ts é harness OPFS/externo. Configuração HTML/Vite é local.
Os scripts fazem arquivos/cruzamento e CDP/BiDi. O motor Kotlin puro é candidato a
reutilização após revisão; Activity/manifest são ferramentas debug de SAF.

Protótipos não devem ser importados automaticamente na 4.2B. Reutilizar algoritmos
e resultados após definir snapshot consistente, contrato de fonte/destino, journal,
capacidade e política de entrega. O harness e a Activity são ferramentas de prova,
não uma implementação definitiva de backup.

## 17. Decisões confirmadas, revistas e prontidão 4.2B

Confirmadas: legado permanece padrão; manifesto v2 com identidade portável e hashes;
motor nativo para bytes SAF; Streams + sink durável Web; opções independentes; nenhuma
transação SQLite durante I/O; close e verificação anteriores a sucesso.

Revistas/restringidas: ZipInputStream não serve como leitor universal; requer seek
ou outra engine validada. STORE/DEFLATE dependem de medição e capacidade de reabrir
fonte. Paralelismo e Blob de resultado inteiro não estão aprovados. Web Worker é
necessário para operação longa responsiva. OPFS concluído não resolve entrega externa,
especialmente Firefox. Suporte ZIP64 estrutural não aprova 16/256 GiB.

Pronta para desenvolver a 4.2B **com essas restrições explícitas**, sem ativação pública
antecipada: implementar porta nativa de exportação, snapshots/revisões concorrentes,
destino e journal de operação, política conservadora de parcial, cancelamento e UI
com duas opções inicialmente desmarcadas. Antes de anunciar grandes backups, validar
worker, limite real da engine, espaço/staging, entrega por navegador e tamanhos maiores
em progressão autorizada. A restauração continua reservada à 4.3.

## 18. Privacidade, retenção e pendências

Somente fixtures e origens de teste. Nenhum backup pessoal, URI privada, credencial,
keystore ou dado bibliográfico real foi copiado para código, logs ou public/.
Não houve exclusão de mídias reais, reset de banco, alteração de posse/modalidade,
ReaderPosition, assinatura/versão principal, commit, push ou expurgo de histórico.

Temporários e recibos de teste são retidos. Remoção futura só pode atingir nomes e
namespace exclusivos comprovados da prova, com marcador/identidade e sem seguir
symlinks; não ampliar a política de exclusão dos provedores. O bloqueio de publicação
por materiais privados históricos permanece fora desta fase.

## 19. Continuidade 4.2B (30/10/2026)

O codec foi promovido a `backupV2/zip/streamingZip.ts`; o módulo experimental mantém
compatibilidade com o harness acima, sem outra engine ZIP. O exportador real roda
ZIP/hash/readback em Worker e usa catálogo/snapshot/journal, ao contrário desta prova.
O relatório atual está em [MINHAESTANTE_4_2B_BACKUP_EXPORT.md](MINHAESTANTE_4_2B_BACKUP_EXPORT.md).

A investigação externa Android ganhou botão explícito: gera ZIP OPFS pequeno,
copia os mesmos bytes para o handle externo e registra tamanho/SHA/EOCD/reabertura
em 0/500/1500 ms. Na repetição física, OPFS válido tinha 4.519 bytes; o handle externo
retornou zero em todas as leituras apesar de `close()` resolvido. Isso reproduz a
falha sem gerar ZIP diretamente no destino externo, isolando-a da construção do ZIP;
não prova por si só onde o provedor perdeu ou ocultou bytes. Há diagnóstico nativo
somente leitura por seleção explícita do ZIP sintético. Exportação Web móvel bloqueada.

Resultados 4.2B, Worker/responsividade, 15 ZIPs integrados e SAF físico não substituem
esta evidência histórica. >4 GiB e novos provedores continuam sem homologação.
