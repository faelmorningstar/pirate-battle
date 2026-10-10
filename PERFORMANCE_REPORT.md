# Evidências de performance e memória — Pirate Battle

Medição UTC: 2026-10-10T05:17:30.707Z. Origem: [performance/profile-results.json](./performance/profile-results.json). Relatório gerado dos dados brutos por `scripts/profile-report.mjs`; nenhum valor foi estimado para substituir uma medição ausente.

## Reprodução

```bash
npm run profile:game
```

O comando executa as mesmas etapas de `npm run build` (TypeScript + Vite), inicia preview exclusivo de `dist` em 127.0.0.1:4188 e fecha servidor/navegador ao terminar. `PROFILE_PORT` permite escolher outra porta local. Requer as dependências e Chromium do Playwright já instalados. Não usa serviços externos. Não executar E2E, builds ou outras cargas intensas ao mesmo tempo que o profiling. Cada execução usa um contexto novo e sobrescreve JSON/relatório; tentativas anteriores incompletas são conservadas no JSON. Uma sessão que termina por morte antes do timer é marcada `complete: false` e o comando retorna código 1, sem apresentá-la como uma partida de três minutos.

## Ambiente e configuração

- Sistema: Windows 11 Home, 10.0.26200, x64.
- CPU: AMD Ryzen 7 5700; 16 processadores lógicos; frequência informada pelo Node: 3693 MHz.
- RAM física informada pelo Node: 16252.434 MiB.
- Node v24.18.0; Chromium 156.0.8078.4, headless; PixiJS 8.22.0.
- Viewport: 1024×1024 CSS px; DPR 1; resolução Pixi 1. As dimensões internas do canvas não foram preservadas nesta execução; a resolução de viewport acima foi registrada.
- Renderizador efetivo: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver). Estes dados indicam renderização por SwiftShader/software quando esse nome aparece, não uso comprovado da GPU física.
- Consultas CIM de hardware detalhado do Windows foram negadas. Hardware/modelo físico da GPU, monitor e carga de outros processos não puderam ser verificados.
- Opções reais salvas pela interface: sessão 180 s; spawn 4 s. Demais parâmetros: defaults de `src/game/config.ts`, sem overrides. Som ligado por padrão; cenário MSW normal; sem throttling artificial de CPU/rede.
- Hash SHA-256 de `dist/index.html`: `ed9be67e14c8e3353ae67bcf2d8cff6f95dbd338853790e62b9429403b335e05`. Versões/ranges, informações CDP de GPU e dados de ambos os tipos de coleta estão no JSON.

## Metodologia de frames e entidades

O script injeta um observador externo por Playwright usando o hook `__PIXI_APP_INIT__` já fornecido pelo PixiJS. Nenhum arquivo de `src/` é modificado e não há import de profiling no bundle. O probe de gameplay DEV está ausente, como esperado em produção.

O runner `postrender` observa somente renders da stage na tela; não conta render-textures intermediárias. Guarda `performance.now()` após cada submissão de render e conta sprites ativos por caminhos oficiais de textura. Jogador, cenário, barras de vida e marcas de dano não são inimigos/projéteis/explosões. As máximas são verificadas em cada render, e há amostras de entidades/HUD a cada segundo. Objetos criados e destruídos entre renders podem não aparecer; essas máximas descrevem entidades ativas visíveis nos renders, não total de objetos alocados.

FPS médio = número de intervalos / tempo do primeiro ao último frame. P95 usa o método de posto mais próximo: ordenar os intervalos e escolher `ceil(0,95 × N)`. Timestamps e intervalos completos estão no JSON. O tempo entre frames inclui trabalho do jogo, browser, GC natural, escalonamento e observação; não representa exclusivamente tempo de CPU nem conclusão da GPU. Custo P95 observado do contador: 0.100 ms; não foi subtraído dos resultados.

Um piloto externo usa apenas W/A/D e Space/Q/E pelos handlers reais. Navega até a costa sul e usa a proteção real da ilha, mantendo disparos. Não altera posição, vida, dano, cooldown, spawn, regras ou timer, não pausa e não avança relógio artificialmente. Esse percurso defensivo permite executar a sessão completa; não representa todos os estilos de combate nem o pior caso de explosões. O contexto de profiling permanece visível (`visible`). Os cinco ciclos de memória precedem a sessão cronometrada e aquecem caches; a medição de FPS exclui o carregamento inicial de assets.

## Resultado da sessão real

- Sessão completa de 180 s: **sim**. Resultado real: time, duração registrada 180 s, score 22.
- Janela real observada pelo controlador: **179.991 s**. Janela de renders: **179.835 s**. Pequenas diferenças vêm do início após assets prontos e do intervalo de polling até desmontagem.
- FPS médio: **26.05**.
- P95 entre frames: **49.00 ms**; maior intervalo: 74.70 ms; renders registrados: 4686.
- Máximas observadas: **23 inimigos, 13 projéteis, 1 explosão**. Pico combinado no mesmo render: 36; a soma das máximas individuais pode ocorrer em instantes diferentes.
- Exceções não tratadas da página: 0.

O alvo de 60 FPS não foi atingido neste ambiente. O orçamento de referência de um frame a 60 FPS é 16,67 ms. O renderizador software limita a interpretação para hardware real: estes números não certificam desempenho em GPU física ou iPhone. Não se atribui a queda a uma função específica sem um perfil de CPU/GPU adicional.

## Cinco ciclos reais de memória

Cada ciclo inicia pelo botão Play, joga aproximadamente cinco segundos reais com os mesmos controles e sai por Exit game. Depois da saída espera um segundo. São coletados heap durante gameplay, após saída sem GC e após GC forçado. Início/fim comparáveis ficam no Home, ambos após `HeapProfiler.collectGarbage`. Nenhum GC é forçado na sessão de três minutos.

Memória em MiB (1 MiB = 1.048.576 bytes); delta em KiB. Nodes/listeners vêm de `Memory.getDOMCounters`. Canvas/aplicação são recursos ainda ativos, não o número de wrappers já liberados aguardando GC.

| Ciclo | Início após GC | Durante jogo | Saída sem GC | Fim após GC | Delta KiB | Nodes / listeners no fim | Canvas / app ativa no fim |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 4.646 | 8.132 | 8.819 | 6.934 | 2343.4 | 203 / 196 | 0 / 0 |
| 2 | 6.934 | 9.145 | 8.167 | 7.333 | 408.5 | 203 / 196 | 0 / 0 |
| 3 | 7.333 | 9.726 | 8.494 | 7.634 | 308.0 | 203 / 196 | 0 / 0 |
| 4 | 7.634 | 8.908 | 8.695 | 7.822 | 193.2 | 203 / 196 | 0 / 0 |
| 5 | 7.822 | 8.686 | 9.246 | 7.999 | 181.0 | 203 / 196 | 0 / 0 |

O heap após GC **cresceu continuamente nos cinco ciclos**. Do fim do primeiro ao fim do quinto houve 1090.6 KiB de diferença. O primeiro ciclo também aquece assets, áudio, fontes, caches Pixi e caminhos compilados do V8; por isso seu salto não deve ser chamado de vazamento automaticamente. Mesmo descontando esse aquecimento, crescimento positivo nas saídas pede investigação de retenção e repetição prolongada até um platô. Cinco ciclos, sem snapshots de heap/retainers, não provam presença nem ausência de leak.

As aplicações destruídas no fim dos cinco ciclos: 5 de 5 criadas; os contadores de canvas e app ativa acima confirmam a desmontagem observada. O observador não mantém referências a aplicações antigas após o evento de destruição. O heap final após a sessão longa contém também arrays de amostras do profiler; não é comparado com os ciclos, nos quais a gravação desses arrays está desligada.

## Limitações e evidências adicionais

- `Runtime.getHeapUsage` mede o isolate V8 da página; exclui GPU/VRAM, memória total do processo, MSW worker e outros isolates. A coleta é suportada aqui, mas isso não equivale a medir memória total do jogo.
- GC forçado, CDP, piloto e observador afetam a execução. FPS de submissões headless não comprova frames apresentados por um monitor; veja [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) e os métodos de [Runtime](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/) e [HeapProfiler](https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/).
- Uma execução completa em desktop/software, sem concorrência com E2E, não cobre mobile, Safari, GPU física ou piores casos. Não há evidência para prometer 60 FPS nesses ambientes.
- Tentativas anteriores incompletas preservadas: 1; death, 13 s, 27.14 FPS. São evidências separadas, excluídas da média desta sessão completa.
- Traces, screenshots e logs temporários não são versionados. Não houve commit ou push nesta fase.
