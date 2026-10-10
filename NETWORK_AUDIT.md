# Auditoria de rede — Fase 7

Data: 10/10/2026. Base: especificação local do desafio, seções 5, 6 e 8; implementação anterior à Fase 7. Gameplay, configuração, canvas, HUD, controles, áudio, assets e CSS foram preservados.

## Situação encontrada

- Contratos `MatchRecord`, `RankingEntry` e `Page<T>` já eram tipados; o payload HTTP e JSON persistido não tinham validação de formato em runtime.
- Axios já usava `/api` e timeout de 4000 ms. As consultas não consumiam o sinal de cancelamento do TanStack Query.
- Query já separava as páginas no cache, tinha retry genérico e invalidava ambas as listas após sucesso de POST. A reabertura podia usar somente cache por dez segundos.
- MSW já tinha os três endpoints, armazenamento local de registros confirmados e deduplicação pelo ID. Existiam normal, empty, slow e erros isolados; não existiam os demais cenários pedidos.
- Havia somente três fixtures normais, insuficientes para paginação; nenhum fixture pertencia ao jogador local.
- O resultado era gravado em localStorage, mas o registro a enviar não era persistido. Refresh perdia a possibilidade de reenvio e não havia ação de retry de registro.
- O seletor recarregava a página. Reset apagava somente registros confirmados, sem restaurar explicitamente o cenário padrão.
- Testes existentes cobriam leitura normal do ranking e fluxos de jogo/configuração/áudio/visual. Não havia matriz dedicada de rede.

## Ações e evidências

- **Sucesso e invalidação das duas listas:** `useRegisterMatch` reaproveitado; `usePendingMatches` remove somente o ID confirmado. Teste `normal registration refreshes both previously cached lists` pré-carrega ambas, conclui uma sessão real e confirma atualização sem refresh.
- **Vazio e paginação:** `handlers.ts` usa a paginação existente de cinco itens; `paginationFixtures` adiciona doze registros apenas em `paginated`. Testes `empty lists...` e `both lists paginate...` verificam as três páginas, retorno, conteúdo, extremos e persistência do cenário.
- **Latência fixa/variável:** 900 ms e ciclo 1200/150/700 ms, por endpoint, sem aleatoriedade. Dois testes verificam estados acessíveis de loading, conclusão das duas consultas e duração mínima da sequência real Axios/MSW.
- **Respostas fora de ordem:** snapshots anteriores ao delay e esperas alternadas de 1200/150 ms. Dois testes verificam chegada real em ordem invertida, cancelamento de leitura obsoleta e permanência do conteúdo novo nas duas abas.
- **Timeout, conexão, HTTP 4xx/5xx:** quatro cenários de leitura, com dois testes de lista por cenário. Timeout mantém o limite real de quatro segundos. Testes verificam erro acessível e recuperação por `Try again`; o teste de retries distingue cancelamento do Strict Mode de tentativas de erro, comprovando zero retry para 400 e um para erros transitórios.
- **Falhas isoladas:** `ranking-error` e `history-error` preservam a outra consulta; dois testes confirmam o isolamento e retry recuperado.
- **Timeout após gravação:** `post-timeout` salva antes do delay. Teste confirma que a fila sobrevive ao refresh, retoma com o mesmo ID e gera uma única linha em cada lista.
- **Refresh durante POST/cliques repetidos:** persistência anterior ao envio e bloqueio síncrono por ID. Teste recarrega antes da resposta, clica três vezes no retry e observa um único POST de confirmação e um único registro.
- **Indisponibilidade e múltiplas pendências:** `post-unavailable` falha antes de salvar. Teste conclui duas partidas, preserva ambas após refresh e confirma uma vez cada por evento online, mantendo a possibilidade de nova partida.
- **Recuperação durante timeout:** o pedido de retry é coalescido e executado após a tentativa em andamento; teste comprova que dois eventos online não perdem a recuperação nem duplicam a partida.
- **Restaurar estado inicial:** reset limpa confirmados e pendências, restaura normal e reinicia contadores. Teste verifica fixtures originais, histórico vazio e opções intactas.
- **Acessibilidade/visual:** seletor mantém label, fornece descrição anunciada; erros/loading/vazio são semânticos. Pendências usam mensagem e botão claros apenas quando existem. Os quatro baselines visuais da Fase 6 são comparados sem regeneração.

## Reprodução e limites

Use Home → Options → Network testing tools → Scenario; a descrição acessível informa a falha e os tempos. Para recuperar um registro, selecione normal ou acione Retry pending matches. Reset mock data restaura o ambiente inteiro de rede; não use reset para recuperar pendências, pois ele as descarta intencionalmente. Nenhuma tentativa cria um ID novo.

`npm run test:e2e -- tests/network.spec.ts` executa 19 cenários em desktop e mobile Chromium, totalizando 38 execuções adicionais. A suíte completa contém 96 execuções. Os testes usam os handlers originais ampliados, não interceptações alternativas de API. Cada contexto começa isolado; refresh dentro do teste conserva seus dados.

Os mocks são locais ao navegador e continuam carregados pelo bootstrap no build de produção. Persistência após refresh depende de localStorage disponível. Sem storage, há aviso acessível e retenção em memória, mas não há garantia de recuperação após fechar a página. Não há backend real, sincronização entre dispositivos ou transações entre abas concorrentes. As latências são cronômetros reais; testes usam limites mínimos tolerantes ao custo de processamento. Safari real e profiling continuam fora desta fase.

## Validação final

- `npm run test:e2e`: 96 execuções passaram (3,3 minutos); 38 novas de rede, preservando as 58 anteriores e os quatro baselines sem regeneração.
- `npm run build`: passou; permanece o aviso de bundle grande, com chunk principal de aproximadamente 620 kB.
- `npm run lint`: passou.
- Preview do build de produção: sucesso do ranking, erro HTTP 503, recuperação e paginação do histórico verificados com MSW; nenhuma exceção de página, e probe de desenvolvimento ausente.
- `git diff --check`: passou. Nenhum asset, CSS, baseline, gameplay ou áudio modificado. Sem commit/push; artefatos temporários e traces permanecem ignorados.
