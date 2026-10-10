import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const fmt = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : 'não disponível'
const mib = (bytes) => fmt(bytes / 1048576, 3)

export function renderProfileReport(data) {
  const { session, environment, memory } = data
  const { metrics, entityMaxima } = session
  const rows = memory.cycles.map((cycle) => `| ${cycle.cycle} | ${mib(cycle.before.usedSize)} | ${mib(cycle.playing.usedSize)} | ${mib(cycle.afterUncollected.usedSize)} | ${mib(cycle.after.usedSize)} | ${fmt(cycle.retainedDeltaBytes / 1024, 1)} | ${cycle.after.nodes} / ${cycle.after.jsEventListeners} | ${cycle.after.canvasCount} / ${cycle.after.liveApplication ? 1 : 0} |`).join('\n')
  const after = memory.cycles.map((cycle) => cycle.after.usedSize)
  const increasing = after.every((value, index) => index === 0 || value > after[index - 1])
  const warmGrowth = after.at(-1) - after[0]
  const canvasDescription = session.canvasSize ? 'Canvas lógico observado: ' + session.canvasSize.width + '×' + session.canvasSize.height + '.' : 'As dimensões internas do canvas não foram preservadas nesta execução; a resolução de viewport acima foi registrada.'
  const prior = data.priorIncompleteAttempts ?? []
  const priorDescription = prior.length ? `; ${prior.map((attempt) => `${attempt.session.result?.reason}, ${attempt.session.result?.durationSeconds} s, ${fmt(attempt.session.metrics.averageFps)} FPS`).join('; ')}` : ''
  return `# Evidências de performance e memória — Pirate Battle

Medição UTC: ${data.measuredAt}. Origem: [performance/profile-results.json](./performance/profile-results.json). Relatório gerado dos dados brutos por \`scripts/profile-report.mjs\`; nenhum valor foi estimado para substituir uma medição ausente.

## Reprodução

\`\`\`bash
npm run profile:game
\`\`\`

O comando executa as mesmas etapas de \`npm run build\` (TypeScript + Vite), inicia preview exclusivo de \`dist\` em 127.0.0.1:4188 e fecha servidor/navegador ao terminar. \`PROFILE_PORT\` permite escolher outra porta local. Requer as dependências e Chromium do Playwright já instalados. Não usa serviços externos. Não executar E2E, builds ou outras cargas intensas ao mesmo tempo que o profiling. Cada execução usa um contexto novo e sobrescreve JSON/relatório; tentativas anteriores incompletas são conservadas no JSON. Uma sessão que termina por morte antes do timer é marcada \`complete: false\` e o comando retorna código 1, sem apresentá-la como uma partida de três minutos.

## Ambiente e configuração

- Sistema: ${environment.os.version}, ${environment.os.release}, ${environment.os.arch}.
- CPU: ${environment.hardware.cpus[0]?.model.trim() ?? 'não disponível'}; ${environment.hardware.logicalCpuCount} processadores lógicos; frequência informada pelo Node: ${environment.hardware.cpus[0]?.speedMHz ?? 'não disponível'} MHz.
- RAM física informada pelo Node: ${mib(environment.hardware.totalMemoryBytes)} MiB.
- Node ${environment.node}; Chromium ${environment.chromium}, headless; PixiJS ${session.pixiVersion}.
- Viewport: ${environment.viewport.width}×${environment.viewport.height} CSS px; DPR ${environment.deviceScaleFactor}; resolução Pixi ${session.renderer.resolution}. ${canvasDescription}
- Renderizador efetivo: ${session.renderer.gpu ?? 'não disponível'}. Estes dados indicam renderização por SwiftShader/software quando esse nome aparece, não uso comprovado da GPU física.
- Consultas CIM de hardware detalhado do Windows foram negadas. Hardware/modelo físico da GPU, monitor e carga de outros processos não puderam ser verificados.
- Opções reais salvas pela interface: sessão ${data.configuration.sessionDurationSeconds} s; spawn ${data.configuration.enemySpawnIntervalSeconds} s. Demais parâmetros: defaults de \`src/game/config.ts\`, sem overrides. Som ligado por padrão; cenário MSW normal; sem throttling artificial de CPU/rede.
- Hash SHA-256 de \`dist/index.html\`: \`${environment.buildIndexSha256}\`. Versões/ranges, informações CDP de GPU e dados de ambos os tipos de coleta estão no JSON.

## Metodologia de frames e entidades

O script injeta um observador externo por Playwright usando o hook \`__PIXI_APP_INIT__\` já fornecido pelo PixiJS. Nenhum arquivo de \`src/\` é modificado e não há import de profiling no bundle. O probe de gameplay DEV está ${session.developmentProbePresent ? 'presente (execução inválida para produção)' : 'ausente, como esperado em produção'}.

O runner \`postrender\` observa somente renders da stage na tela; não conta render-textures intermediárias. Guarda \`performance.now()\` após cada submissão de render e conta sprites ativos por caminhos oficiais de textura. Jogador, cenário, barras de vida e marcas de dano não são inimigos/projéteis/explosões. As máximas são verificadas em cada render, e há amostras de entidades/HUD a cada segundo. Objetos criados e destruídos entre renders podem não aparecer; essas máximas descrevem entidades ativas visíveis nos renders, não total de objetos alocados.

FPS médio = número de intervalos / tempo do primeiro ao último frame. P95 usa o método de posto mais próximo: ordenar os intervalos e escolher \`ceil(0,95 × N)\`. Timestamps e intervalos completos estão no JSON. O tempo entre frames inclui trabalho do jogo, browser, GC natural, escalonamento e observação; não representa exclusivamente tempo de CPU nem conclusão da GPU. Custo P95 observado do contador: ${fmt(metrics.observerP95Ms, 3)} ms; não foi subtraído dos resultados.

Um piloto externo usa apenas W/A/D e Space/Q/E pelos handlers reais. Navega até a costa sul e usa a proteção real da ilha, mantendo disparos. Não altera posição, vida, dano, cooldown, spawn, regras ou timer, não pausa e não avança relógio artificialmente. Esse percurso defensivo permite executar a sessão completa; não representa todos os estilos de combate nem o pior caso de explosões. O contexto de profiling permanece visível (\`${session.visibility}\`). Os cinco ciclos de memória precedem a sessão cronometrada e aquecem caches; a medição de FPS exclui o carregamento inicial de assets.

## Resultado da sessão real

- Sessão completa de 180 s: **${data.complete ? 'sim' : 'não'}**. Resultado real: ${session.result?.reason ?? 'não disponível'}, duração registrada ${session.result?.durationSeconds ?? 'não disponível'} s, score ${session.result?.score ?? 'não disponível'}.
- Janela real observada pelo controlador: **${fmt(session.wallElapsedMs / 1000, 3)} s**. Janela de renders: **${fmt((session.frameTimestampsMs.at(-1) - session.frameTimestampsMs[0]) / 1000, 3)} s**. Pequenas diferenças vêm do início após assets prontos e do intervalo de polling até desmontagem.
- FPS médio: **${fmt(metrics.averageFps)}**.
- P95 entre frames: **${fmt(metrics.p95FrameIntervalMs)} ms**; maior intervalo: ${fmt(metrics.maximumFrameIntervalMs)} ms; renders registrados: ${metrics.frames}.
- Máximas observadas: **${entityMaxima.enemies} inimigos, ${entityMaxima.projectiles} projéteis, ${entityMaxima.effects} ${entityMaxima.effects === 1 ? 'explosão' : 'explosões'}**. Pico combinado no mesmo render: ${entityMaxima.combined}; a soma das máximas individuais pode ocorrer em instantes diferentes.
- Exceções não tratadas da página: ${data.pageErrors.length}.

O alvo de 60 FPS ${metrics.averageFps >= 60 ? 'foi atingido pela média nesta amostra, sem garantir estabilidade em outros ambientes' : 'não foi atingido neste ambiente'}. O orçamento de referência de um frame a 60 FPS é 16,67 ms. O renderizador software limita a interpretação para hardware real: estes números não certificam desempenho em GPU física ou iPhone. Não se atribui a queda a uma função específica sem um perfil de CPU/GPU adicional.

## Cinco ciclos reais de memória

Cada ciclo inicia pelo botão Play, joga aproximadamente cinco segundos reais com os mesmos controles e sai por Exit game. Depois da saída espera um segundo. São coletados heap durante gameplay, após saída sem GC e após GC forçado. Início/fim comparáveis ficam no Home, ambos após \`HeapProfiler.collectGarbage\`. Nenhum GC é forçado na sessão de três minutos.

Memória em MiB (1 MiB = 1.048.576 bytes); delta em KiB. Nodes/listeners vêm de \`Memory.getDOMCounters\`. Canvas/aplicação são recursos ainda ativos, não o número de wrappers já liberados aguardando GC.

| Ciclo | Início após GC | Durante jogo | Saída sem GC | Fim após GC | Delta KiB | Nodes / listeners no fim | Canvas / app ativa no fim |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

O heap após GC ${increasing ? '**cresceu continuamente nos cinco ciclos**' : 'não cresceu de forma estritamente contínua nos cinco ciclos'}. Do fim do primeiro ao fim do quinto houve ${fmt(warmGrowth / 1024, 1)} KiB de diferença. O primeiro ciclo também aquece assets, áudio, fontes, caches Pixi e caminhos compilados do V8; por isso seu salto não deve ser chamado de vazamento automaticamente. Mesmo descontando esse aquecimento, crescimento positivo nas saídas pede investigação de retenção e repetição prolongada até um platô. Cinco ciclos, sem snapshots de heap/retainers, não provam presença nem ausência de leak.

As aplicações destruídas no fim dos cinco ciclos: ${memory.cycles.at(-1)?.after.destroyed ?? 'não disponível'} de ${memory.cycles.at(-1)?.after.created ?? 'não disponível'} criadas; os contadores de canvas e app ativa acima confirmam a desmontagem observada. O observador não mantém referências a aplicações antigas após o evento de destruição. O heap final após a sessão longa contém também arrays de amostras do profiler; não é comparado com os ciclos, nos quais a gravação desses arrays está desligada.

## Limitações e evidências adicionais

- \`Runtime.getHeapUsage\` mede o isolate V8 da página; exclui GPU/VRAM, memória total do processo, MSW worker e outros isolates. A coleta é suportada aqui, mas isso não equivale a medir memória total do jogo.
- GC forçado, CDP, piloto e observador afetam a execução. FPS de submissões headless não comprova frames apresentados por um monitor; veja [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) e os métodos de [Runtime](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/) e [HeapProfiler](https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/).
- Uma execução completa em desktop/software, sem concorrência com E2E, não cobre mobile, Safari, GPU física ou piores casos. Não há evidência para prometer 60 FPS nesses ambientes.
- Tentativas anteriores incompletas preservadas: ${prior.length}${priorDescription}. São evidências separadas, excluídas da média desta sessão completa.
- Traces, screenshots e logs temporários não são versionados. Não houve commit ou push nesta fase.
`
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const data = JSON.parse(await readFile(path.join(root, 'performance/profile-results.json'), 'utf8'))
  await writeFile(path.join(root, 'PERFORMANCE_REPORT.md'), renderProfileReport(data))
}
