# Reautorização de anexos — proposta após a Fase 3.3

Data: 28/10/2026. **Proposta, sem novo contrato implementado.**

## Identidade existente

`BookAttachment` persiste provedor, referência gerenciada opaca, formato, tamanho,
SHA-256 e identidade do anexo/livro. Não contém URI SAF nem identidade pública da
árvore. No Android, o registro privado `digital_library_saf_v1` mapeia tokens de
árvore/origem para URIs e conserva as árvores anteriores. `sourceTree` registra a
procedência de fontes sintéticas. O journal privado de `DigitalStorageCore` mantém
`spec.tree`, token gerenciado, URI do documento próprio e fingerprint. A pasta
`active` determina o destino de **novas** importações; não redefine arquivos antigos.

`AndroidSafStorageProvider.checkAccess` usa `checkManagedAccess`; o backend consulta
a árvore original do registro e a concessão atual. `selectDirectory` mantém o token
quando a mesma URI já foi registrada, conserva árvores antigas e atualiza `active`.
Escolher outra árvore não remapeia documentos. `EXTRA_INITIAL_URI` é apenas uma
orientação ao seletor, não comprovação da árvore efetivamente escolhida.

No OPFS, namespace, token, registro IndexedDB e bytes pertencem à origem/perfil.
Configuração/persistência Web não é uma concessão SAF. Uma origem diferente ou dados
evictados não são recuperados por selecionar uma pasta Android.

## Evidência real desta fase

No DEV físico, liberar a concessão persistível **somente da árvore de teste ativa**
por `releasePersistableUriPermission` produziu `permission-revoked`. A seção real
mostrou permissão necessária; o snapshot completo dos dois anexos/posições,
bibliografia, sessões e progresso permaneceu idêntico. O usuário selecionou a mesma
pasta no seletor oficial comum, sem `diagnosticOperationId`; o estado voltou a
`accessible`, o snapshot continuou idêntico e ambos os hashes passaram.

Isso comprova aquele restabelecimento manual da concessão existente. Não cria uma
API pública para escolher um anexo e restaurar sua árvore original, especialmente
se a pasta ativa já tiver sido trocada. Não justifica um botão de recuperação geral.

## Contrato futuro proposto

Adicionar uma interação opcional do provedor dirigida à **referência gerenciada**,
com capacidade explícita e intenção do usuário. O serviço continua sem URIs,
caminhos ou acesso ao registro nativo. A resposta distingue concessão obtida,
cancelamento, árvore diferente, documento inacessível, integridade divergente e
operação não suportada. Este documento não fixa nomes públicos dessa API.

O provedor deverá:

1. Resolver internamente referência, registro durável e árvore original; recusar
   identidade desconhecida/ambígua antes de qualquer interação.
2. Abrir o seletor oficial com orientação à árvore original. Exigir comparação da
   autoridade e da identidade documental registrada, respeitando as regras do
   provedor e concessões de prefixo. Nome, caminho textual, tamanho ou hash isolados
   não provam que a autorização corresponde à árvore/documento original.
3. Revalidar flags realmente concedidas, persistibilidade e acesso ao documento
   já registrado. Uma escolha diferente não troca `active`, tokens, vínculos ou URIs
   antigas silenciosamente; cancelamento conserva os registros.
4. Verificar incrementalmente tamanho, formato e SHA-256 esperado após conceder
   acesso. Acesso disponível e integridade aprovada são resultados separados. Não
   sobrescrever o checksum esperado para aceitar conteúdo modificado.
5. Revalidar identidade/revisão e operações concorrentes antes de anunciar sucesso.
   Sem cópia compensatória, exclusão, alteração bibliográfica ou transferência de
   ReaderPosition. Falta de permissão não significa documento removido.
6. Se o provedor não oferecer identidade estável/recuperação dirigida, retornar
   limitação explícita. Uma eventual substituição é outra intenção, com o diálogo e
   a política de posição já existentes; nunca uma falsa reautorização.

## Validação necessária antes de implementar

- Árvore antiga A, pasta ativa B: reautorizar A sem alterar B ou seus anexos.
- Cancelamento e escolha de C: registros e posição intactos.
- Documento com mesmo nome em outra árvore: rejeição sem remapeamento.
- Mesmo documento modificado: erro de integridade, posição intacta.
- Concessão somente leitura, sem persistibilidade, provedor indisponível e documento
  movido/ausente: estados distintos quando o provedor permitir diagnóstico.
- Duas operações/abas, morte do processo durante o seletor, reabertura e referências
  persistidas antigas: sem duplicação ou associação implícita.
- Testes SAF físicos, além de JVM/Vitest; OPFS não herda essa capability.

É uma mudança contratual entre interação, bridge e provedor, com política de
identidade a definir. Fica para uma fase de robustez. A Fase 3.3 conserva orientação
à pasta original e “Tentar novamente”, sem implementar recuperação improvisada.
