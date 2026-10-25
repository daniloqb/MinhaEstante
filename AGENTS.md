# Instruções do agente — MinhaEstante

## Propósito
MinhaEstante é um catálogo pessoal de obras e leituras em evolução para a versão 2.0: biblioteca digital, leitor EPUB/PDF, audiolivros e acompanhamento deliberado de leitura. O projeto utiliza React, TypeScript, Vite, Capacitor Android e SQLite; também opera na Web/PWA. O código do repositório local é a fonte de verdade para nomes, contratos e funcionalidades efetivamente implementadas.

## Contexto a consultar
Antes de alterações relevantes, leia `docs/MINHAESTANTE_2_0_CONTEXT.md` e, se existir, `docs/MINHAESTANTE_2_0_ARCHITECTURE.md`. Confira o código e os testes atuais: os documentos registram decisões, não substituem uma inspeção da implementação.

## Regras permanentes
- Preserve a biblioteca pessoal, os dados SQLite, UUIDs, formatos, status, posse, empréstimos, avaliações, capas e os backups legados.
- Diferencie **modalidades** (`fisico`, `ebook`, `audiolivro`), **posse**, **anexos digitais**, **última posição visitada** e **sessões deliberadas de leitura**. Não infira um conceito a partir de outro.
- A seleção de formatos permite 1–3 modalidades e usa toggle; pelo menos uma deve permanecer ativa.
- O próximo ajuste funcional planejado é tornar a posse de exemplar independente do formato; valide o estado do código antes de aplicar.
- Um registro poderá possuir no máximo 1 anexo de e-book (EPUB/PDF) e 1 anexo de áudio (MP3/M4A/M4B), simultaneamente.
- Abrir arquivo não inicia acompanhamento nem altera automaticamente `status_leitura`.
- Não coloque arquivos binários grandes no SQLite ou no localStorage.
- Preservar a exportação ZIP padrão. Na fase futura de backup digital, adicionar dois checkboxes opcionais, desmarcados: incluir e-books e incluir audiolivros.
- Não use exclusão/recriação do banco, limpeza de dados, reinstalação do app ou reimportação destrutiva como solução de erros.
- Android: testar transações nativas do `@capacitor-community/sqlite`, inclusive concorrência e migrações. Testes em memória/Web não comprovam funcionamento Android.
- Android (armazenamento futuro): priorizar SAF e permissões mínimas, sem `MANAGE_EXTERNAL_STORAGE`.
- Não expor chaves, credenciais, arquivos pessoais ou backups reais em commits, logs ou relatórios. Evitar adicionar backups pessoais ao repositório público.
- Preservar comportamento e identidade visual, traduções, navegação e funcionalidades não relacionadas à tarefa.
- Não gerar APK/AAB, alterar versionCode/versionName ou assinatura, nem fazer commits/push sem solicitação explícita.

## Processo em cada tarefa
1. Confira a branch, alterações locais, instruções, arquivos relevantes e fluxos atuais.
2. Resuma rapidamente o plano e os riscos; implemente apenas o escopo solicitado.
3. Faça alterações pequenas, reutilizando serviços e helpers existentes. Não crie arquiteturas duplicadas.
4. Escreva testes para regras novas e casos de regressão; sempre que alterar SQL, validar esquema, parâmetros posicionais, transações e migrações.
5. Execute, quando possível: `npm test`, `npm run lint`, `npm run build`. ATENÇÃO: o script `build` pode ignorar falha de `cap sync android` (`|| true`); valide a sincronização/compilação Android separadamente quando relevante.
6. Informe arquivos alterados, testes realmente executados, pendências de teste em dispositivo Android e riscos. Nunca chame testes simulados de testes nativos.

## Regressões críticas
O ciclo `importar backup legado → persistir → exportar → reimportar` precisa preservar livros, posse, status, formatos e capas. Um backup histórico de teste reportado tinha 215 livros, 207 capas, 141 com posse e 97 lidos. Esse arquivo contém dados pessoais: use apenas uma cópia local autorizada como fixture de teste, sem publicá-lo.

## Desenvolvimento por fases
Fase 1 (modelos, SQLite v2, repositórios e estabilização de backup/transações Android) foi reportada e testada pelo usuário. Fase 2 (infraestrutura multiplataforma de armazenamento e permissões Android) ainda depende de implementação e testes específicos. Consulte o arquivo de contexto para o roadmap e para a próxima mudança de regra de negócio.
