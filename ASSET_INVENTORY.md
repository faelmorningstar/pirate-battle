# Inventário dos assets oficiais — Pirate Battle

Data: 09/10/2026. Fonte local: `reference-assets/game-developer-challenge-main/assets/`.
Todos os caminhos abaixo são relativos a essa pasta, salvo quando apontam para `src/`.

## Escopo e critério

Este documento é um planejamento de uso, sem integração de assets ou alteração de código, visual e mecânicas. Foram encontrados **520 arquivos**, incluindo versões alternativas e metadados; isso não significa 520 artes diferentes. A lista exata de arquivos está no apêndice.

Como numa caixa de peças, imagens de exemplo mostram a montagem desejada, enquanto PNGs separados e atlas são as peças reutilizáveis. O caminho mais simples numa integração futura é usar PNGs locais individuais e manter textos e botões em HTML/React. Atlas podem reduzir carregamentos e organizar sprites PixiJS, mas exigem recortes e tratamento de resolução. As duas opções são alternativas: não carregar ambas para o mesmo elemento sem necessidade.

Prioridades: **alta** para elementos centrais já existentes; **média** para ambientação e feedback; **baixa** para detalhes sem função atual. Destinos: **referência** para orientar uma implementação; **asset local no runtime** para futura execução no navegador; **descartado do runtime** para recursos sem utilidade atual. Descartar aqui não significa apagar arquivos.

A pasta `reference-assets/` está ignorada em `.gitignore`. Uma futura integração precisará disponibilizar somente os arquivos escolhidos em uma pasta incluída na entrega (por exemplo, `public/assets/` ou imports em `src/assets/`), incluindo seus metadados e origem. Não basta usar o caminho local ignorado em produção. O README do desafio identifica o pacote como fornecido, mas não foi localizado um arquivo de licença na cópia analisada; preservar a origem e esclarecer os termos antes de redistribuir. Nenhum download foi realizado.

## Estado atual usado no mapeamento

- `src/App.tsx`: menu com Play/Options, instruções de teclado, abas Ranking/Match History, Options e resultado com score, duração, motivo e status de registro.
- `src/components/GameCanvas.tsx`: arena PixiJS; água, ilha, barras de vida, projéteis e explosão desenhados com Graphics; três navios carregados por URLs do GitHub, com fallback geométrico e timeout de 2,5 segundos.
- Os navios atuais são `ship_12.png` (jogador), `ship_5.png` (Chaser) e `ship_20.png` (Shooter). Todos existem localmente.
- HUD atual em texto: Hull/Score/Time. Pausa: aviso textual e botão Pause/Resume; saída por Exit game. Há seis botões de toque e teclado W/A/D, Space/Q/E e P.
- `OptionsPanel.tsx`: campos numéricos de duração e spawn, Save/Cancel/Reset. `DataPanels.tsx`: listas de ranking/histórico, estados de carregamento/erro/vazio e paginação.
- `App.css`: cartões, botões e controles com foco visível, ajustes para toque e área segura mobile. Não há sistema de áudio no código de jogo analisado.
- Havia uma alteração prévia em `GameCanvas.tsx`; ela foi preservada.

## 1. Referência visual

- **Arquivos:** `preview.png` (918×515); `sample.png`, `sample_menu.png`, `sample_options.png`, `sample_pause.png`, `sample_result.png`, `sample_ranking.png`, `sample_history.png` (1800×1000 cada).
- **Aplicação:** preview apresenta o conjunto de navios/partes/tiles; sample orienta arena, HUD e controles; demais samples correspondem ao menu, Options, pausa, resultado, Ranking e Match History atuais.
- **Prioridade:** alta para orientar composição e coerência; baixa para preview na interface final.
- **Risco:** as imagens contém textos, números, navios e controles já compostos. Transformá-las em tela executável impediria leitura por tecnologia assistiva, atualização de dados e adaptação a celular. Os valores ilustrados (por exemplo, vida 76/100) não são regras para a vida atual de 3 pontos.
- **Destino:** referência; descartar do runtime como telas completas.
- **Complementos:** `vector/ships_miscellaneous_vector.svg` e `vector/tiles_vector.svg`: referência/editáveis, prioridade baixa, sem recortes individuais prontos para o código atual. `logo_jungle_gaming.svg`: referência de marca/crédito, prioridade baixa; só usar localmente num crédito pertinente, com nome acessível se informativo. Não substituir o título do jogo pela marca do fornecedor.
- **Legado:** `vector/ships_miscellaneous_vector.swf` e `vector/tile_vector.swf`: descartados do runtime, prioridade baixa; dependem do formato Flash e não se encaixam no navegador atual.

## 2. Cenário e tiles

- **Arquivos:** `png/default/tiles/tile_1.png` a `tile_96.png` e correspondentes em `png/retina/tiles/`; `tilesheet/tiles_sheet.png` (1024×384), `tiles_sheet_retina.png` (2048×768) e `tilesheets.txt`; `vector/tiles_vector.svg`.
- **Aplicação:** água, costa, areia/grama, vegetação, pedras e estruturas da arena; substituir visualmente `drawSea`/`createIsland` numa etapa futura. O preview ajuda a reconhecer famílias, pois os nomes numerados não descrevem função.
- **Prioridade:** alta para água/costa/ilha; média para vegetação e pedras; baixa para estruturas sem função atual.
- **Risco:** tiles normais usam grade 64×64 sem margem (16 colunas × 6 linhas); retina usa 128×128. É necessário confirmar a correspondência dos números com a posição na folha antes de montar o mapa. Filtragem pode causar emendas. Uma arte de ilha não deve sugerir passagem onde a colisão circular atual bloqueia o navio; não inferir novas colisões da transparência.
- **Destino:** PNGs ou folha selecionada como asset local no runtime; SVG como referência. Tiles extras ficam fora do runtime até haver uso definido.
- **Fundo de interface:** `ui_scene_background.png` (918×515), prioridade média, candidato local para menu/Options/resultado/listas. É uma cena composta e não um mapa de colisão. Ajustar cobertura sem distorcer, com camada que preserve contraste dos textos; não usar como substituto da arena interativa.

## 3. Navios e partes

- **Arquivos:** `png/{default,retina}/ships/ship_1.png` a `ship_24.png`, `dinghy_large_1.png` a `dinghy_large_3.png` e `dinghy_small_1.png` a `dinghy_small_3.png`: 30 por versão.
- **Partes:** `png/{default,retina}/ship_parts/`: 67 por versão; cannon, cannon_mobile, cannon_loose, cannon_ball; crew_1–6; flag_1–6; hull_large_1–4 e hull_small_1–4; sail_large_1–24 e sail_small_1–13; nest, pole, wood_1–4.
- **Atlas:** `spritesheet/ships_miscellaneous_sheet.png` + `.xml` e `ships_miscellaneous_sheet_retina.png` + `.xml`: cada XML tem 102 recortes (30 navios + 67 partes + 5 efeitos). Ambos os PNGs medem 1024×512. XML contém `imagePath` e `SubTexture` com name/x/y/width/height; não é o JSON de spritesheet usado pelo atlas UI.
- **Aplicação:** `ship_12`, `ship_5` e `ship_20` substituiriam as três fontes externas, preservando seleção atual. Outras versões podem orientar deterioração; wood pode compor destroços. Partes soltas e botes não têm entidade própria no jogo atual.
- **Prioridade:** alta para os três navios atuais; média para feedback visual de dano; baixa para montagem modular, tripulantes e botes.
- **Risco:** manter âncora central, orientação, tamanho visual e raios de colisão existentes. A renderização atual força 58×74; `ship_12` tem 66×113, portanto há risco de distorção ao manter essa escala. Variações numeradas não definem automaticamente estados de vida. Partes exigem alinhamento e ordem de desenho; XML exige conversão ou recortes manuais numa futura etapa.
- **Destino:** três navios como assets locais no runtime; demais sprites como referência/opcionais fora do runtime até seleção. Preferir navio pronto ao montar casco e vela, porque reduz trabalho de alinhamento.

## 4. Projéteis e efeitos

- **Arquivos:** `png/{default,retina}/ship_parts/cannon_ball.png`; `png/{default,retina}/effects/explosion_1.png` a `explosion_3.png`, `fire_1.png` e `fire_2.png`; mesmos nomes no atlas de navios. `wood_1–4` pode fornecer detalhes de destroços.
- **Aplicação:** cannon_ball nos disparos frontais/laterais/inimigos; explosion nos efeitos de destruição atualmente desenhados como círculo; fire como feedback visual de dano, se escolhido em etapa posterior.
- **Prioridade:** alta para projétil/explosão; média para fogo; baixa para destroços.
- **Risco:** `cannon_ball` mede 10×10 nas duas versões examinadas; preservar visibilidade em água e os parâmetros de colisão atuais. Os três PNGs de explosão são artes distintas, não há timeline de animação declarada nos XML. Não presumir que são frames sequenciais. Animações precisam limitar flashes, duração e quantidade de objetos; transparência e brilho não podem esconder tiros.
- **Destino:** asset local no runtime para os escolhidos; fogo/destroços como referência até uma decisão visual. Não criar novas regras de dano a partir deles.

## 5. Menu, título, painéis e botões

- **Arquivos:** `png/{default,retina}/ui/menu/`: `panel_menu.png`, `title_pirate_battle.png`, `button_primary_{normal,hover,pressed,disabled}.png`, `button_secondary_{normal,pressed}.png` (8 por versão). Disponíveis nos dois atlas UI JSON/PNG.
- **Aplicação:** `.menu-card`, título h1, Play/Options, Save/Cancel/Reset, abas e ações de resultado; painel também pode servir às listas.
- **Prioridade:** alta para painel, título e botões principais; média para ações secundárias.
- **Risco:** não há sprites de focus, hover/disabled secundário, campos numéricos, tabs ou mensagens de erro. Manter foco visível, semântica de button/input, rótulos HTML e estado disabled real. O título rasterizado exige nome acessível; não duplicar leitura se houver texto equivalente. Usar bordas do painel para redimensionar sem esticar cantos (nove fatias); conteúdo longo precisa caber ou rolar.
- **Destino:** asset local no runtime para fundos/decorativos selecionados; samples como referência. Textos dinâmicos continuam em React.

## 6. HUD

- **Arquivos:** `png/{default,retina}/ui/hud/`: `counter_panel.png`, `icon_heart.png`, `icon_score.png`, `icon_time.png`, `health_frame.png`, `health_fill_{green,amber,red}.png`, `enemy_health_frame.png`, `enemy_health_fill_{green,red}.png` (11 por versão); recortes nos atlas UI.
- **Aplicação:** substituir decoração do header Hull/Score/Time e barras acima do jogador/inimigos, mantendo os valores e máximos atuais (jogador 3, inimigos 2).
- **Prioridade:** alta.
- **Risco:** recortar o preenchimento da esquerda para a direita, sem comprimir a textura inteira. Moldura e preenchimento devem estar alinhados. Cor verde/âmbar/vermelha não pode ser o único indicador de vida; conservar números/texto acessível. Contraste, escala em celular e sobreposição com navios precisam de revisão. Evitar anunciar cada frame a leitores de tela.
- **Destino:** assets locais no runtime; números e tempo continuam dinâmicos. Os fill_rect estão documentados abaixo.

## 7. Controles desktop e mobile

- **Arquivos:** `png/{default,retina}/ui/controls/`: `button_round_{normal,hover,pressed}.png`; `icon_turn_left`, `icon_turn_right`, `icon_forward`, `icon_fire_front`, `icon_fire_left`, `icon_fire_right`, `icon_pause`, `icon_play`, `icon_home`, `icon_restart`, `icon_settings`, `icon_close`, `icon_plus`, `icon_minus` (todos `.png`; 17 por versão). Dois atlas UI.
- **Aplicação:** seis botões de toque de `GameCanvas`; Pause/Resume/Exit; ícones nas ações existentes de menu/resultado/Options. Desktop mantém instruções W/A/D, Space/Q/E e P, pois não há sprites de teclas nesse pacote.
- **Prioridade:** alta para movimento, disparos e pausa; média para navegação; baixa para plus/minus se os inputs atuais continuarem suficientes.
- **Risco:** manter nomes acessíveis já existentes e áreas de toque confortáveis (proposta de pelo menos 44×44 pixels CSS), espaço entre ações, suporte a múltiplos dedos e liberação em pointerup/cancel/leave. Hover não serve como único feedback em toque; falta sprite de foco. Ícones não são substitutos de instruções. Respeitar orientação horizontal e safe-area atuais.
- **Destino:** assets locais no runtime sobre botões HTML existentes; referência para ícones sem ação atual. Não mudar atalhos nem comportamento.

## 8. Telas de pausa, resultado e ranking

- **Arquivos:** `sample_pause.png`, `sample_result.png`, `sample_ranking.png`, `sample_history.png`: referências; reutilizar `panel_menu`, botões primary/secondary/round e ícones play/home/restart/score/turn_left/turn_right dos atlas UI.
- **Aplicação:** pausa hoje textual; resultado em `App.tsx`; Ranking/Match History e paginação em `DataPanels.tsx`. Não há atlas ou sprite de tela completa separado para essas funções.
- **Prioridade:** alta para resultado/pausa e legibilidade; média para decoração de ranking/histórico.
- **Risco:** sample_pause mostra Options, mas essa ação não existe na pausa atual: não adicioná-la por inferência. Ranking/histórico precisam conservar dados reais, paginação e estados vazio/erro/carregamento; resultado precisa preservar status do registro. Painel largo exige redimensionamento e adaptação mobile. Se a pausa virar diálogo numa etapa futura, controlar foco e retorno ao botão de origem. Não embutir dados de exemplo nos sprites.
- **Destino:** samples como referência; partes de UI como assets locais no runtime. Nenhuma imagem de sample como tela executável.

## 9. Sons

- **Arquivos (27 WAV):**
  - Interface: `ui_open.wav`, `ui_close.wav`, `ui_hover.wav`, `ui_click.wav`, `ui_back.wav`.
  - Sessão: `game_start.wav`, `game_pause.wav`, `game_resume.wav`, `game_over.wav`, `game_complete.wav`.
  - Alertas/pontos: `time_warning.wav`, `health_low.wav`, `score_point.wav`.
  - Ataques: `cannon_fire_1.wav`, `cannon_fire_2.wav`, `cannon_fire_3.wav`, `cannon_broadside.wav`.
  - Impactos/destruição: `cannonball_water_hit_1.wav`, `cannonball_water_hit_2.wav`, `ship_wood_hit_1.wav`, `ship_wood_hit_2.wav`, `ship_collision.wav`, `ship_explosion_1.wav`, `ship_explosion_2.wav`, `ship_sinking.wav`.
  - Loops: `ship_sailing_loop.wav`, `ocean_ambience_loop.wav`.
- **Aplicação:** cliques/navegação em React; tiros/impactos/destruição nos eventos atuais de combate; start/pause/resume/end na sessão; alerts no HUD; loops na partida. O código atual não possui reprodução de áudio. Nomes sugerem finalidade; não foi feita escuta para avaliar volume ou qualidade.
- **Prioridade:** média para tiros, dano e estados da sessão; baixa para hover, loops e detalhes. Sons são complementares ao feedback visual.
- **Risco:** navegador pode bloquear áudio sem gesto inicial; liberar a partir de Play. Oferecer mute/volume e evitar sobreposição excessiva; parar loops na pausa/saída e liberar recursos. Alertas não podem comunicar informação exclusivamente por áudio. Impacto na água só cabe se um evento existente representar esse impacto; não criar colisões novas para usar um som.
- **Destino:** assets locais no runtime em futura integração seletiva; loops/hover podem ficar fora do runtime até haver controle de áudio. Sem dependência de download em execução.

## Análise de ui_sheet.json e ui_sheet_retina.json

Um atlas funciona como uma folha de adesivos: `frame` diz onde recortar; `ui.layout` diz onde posicionar o conteúdo dentro do adesivo. Misturar essas coordenadas desloca texto, ícones e preenchimentos.

### Estrutura e resolução

- Ambos possuem 36 frames com os mesmos nomes: menu 8, HUD 11 e controles 17. Todos têm `rotated: false` e `trimmed: false`; `spriteSourceSize` começa em (0,0) e tem o mesmo tamanho de `sourceSize`/frame.
- `meta.app`: Pirate Battle UI asset pack; `version`: 1.0; `format`: RGBA8888. Normal: `image: ui_sheet.png`, `size: 1024×1024`, `scale: "1"`. Retina: `image: ui_sheet_retina.png`, `size: 2048×2048`, `scale: "2"`.
- `frame`, `sourceSize` e `spriteSourceSize` usam pixels físicos; a retina dobra largura/altura dos sprites. As posições da folha são rearranjadas, portanto **não dobrar x/y do atlas normal**. Usar cada JSON com seu PNG correspondente.
- `meta.ui`: version 1, `coordinate_space: untrimmed_sprite_top_left`, `units: logical_pixels`, `image_paths_relative_to: atlas_json`. Bordas e campos `ui` usam pixels lógicos 1×, inclusive na retina; não dobrar as medidas de layout quando o desenho já usa tamanho lógico. `anchor` é normalizado.
- `ui.family` identifica menu/hud/controls; `ui.image` aponta ao PNG individual relativamente ao JSON (`../png/default/...` ou `../png/retina/...`). Todos os 72 caminhos foram encontrados localmente.
- `ui.alpha_bounds` descreve a região visível, sem trocar o recorte físico. Esses limites diferem entre normal e retina, mesmo em unidades lógicas; não assumir margens idênticas. Não usá-los como hitbox automática.
- `anchor` é (0.5,0.5) no painel e nos botões; (0,0) nas barras de vida. Título, counter_panel e ícones não declaram âncora; definir explicitamente no consumidor.
- Campos customizados `ui` e `borders` precisam ser consumidos pela aplicação para produzir layout; só carregar a textura não aplica esses dados automaticamente. Na conversão XML dos navios, esses dados UI não estão presentes.

### Metadados de layout (pixels lógicos)

- `panel_menu`: 384×480; borders left/right 32 e top/bottom 40; content_rect (26,30,332,420). Usar o retângulo de conteúdo para encaixar elementos e as bordas para preservar a moldura no redimensionamento.
- `title_pirate_battle`: 384×128, sem content_rect.
- Botões de menu: 256×88; group menu_button; outer_rect (8,4,240,80), label_rect (32.5,19.5,191,46.5). Os seis estados compartilham o layout. O texto deve permanecer separado da imagem.
- Botões redondos: 64×64; group round_button; outer_rect (4,4,56,56); icon_center (32,32); icon_render_size 32×32. Os ícones têm fonte 48×48, então devem ser encaixados, não exibidos necessariamente no tamanho da fonte.
- Saúde do jogador: fonte 256×48; group player_health; frame health_frame; fill_rect (30,15,196,20).
- Saúde inimiga: fonte 160×40; group enemy_health; frame enemy_health_frame; fill_rect (24,12,112,15).
- Ambas as barras: clip_axis x, clip_origin left, draw_order [frame,fill]. Os layouts são iguais nas duas resoluções. Preencher/mascarar só a área definida, proporcional à vida, preservando origem e moldura.
- `counter_panel`: 160×56; não define layout interno para número/ícone. Os ícones de tempo/pontos/coração também não especificam posicionamento no contador; essa composição precisa ser decidida na implementação.
- Nenhum recorte declara rótulo acessível, texto dinâmico, tecla, tipografia ou lógica de navegação. Os samples não fornecem esses comportamentos.

### Recortes completos

Formato abaixo: `(x, y, largura, altura)` em pixels físicos. Nomes são as chaves JSON; o caminho PNG individual está em `ui.image` de cada frame. Os agrupamentos correspondem às categorias acima.

#### menu

- `panel_menu`: normal (4, 4, 384, 480); retina (4, 4, 768, 960).
- `title_pirate_battle`: normal (396, 4, 384, 128); retina (780, 4, 768, 256).
- `button_primary_disabled`: normal (4, 492, 256, 88); retina (4, 972, 512, 176).
- `button_primary_hover`: normal (268, 492, 256, 88); retina (524, 972, 512, 176).
- `button_primary_normal`: normal (532, 492, 256, 88); retina (1044, 972, 512, 176).
- `button_primary_pressed`: normal (4, 588, 256, 88); retina (4, 1156, 512, 176).
- `button_secondary_normal`: normal (268, 588, 256, 88); retina (524, 1156, 512, 176).
- `button_secondary_pressed`: normal (532, 588, 256, 88); retina (1044, 1156, 512, 176).

#### hud

- `counter_panel`: normal (4, 684, 160, 56); retina (4, 1340, 320, 112).
- `health_fill_amber`: normal (172, 684, 256, 48); retina (332, 1340, 512, 96).
- `health_fill_green`: normal (436, 684, 256, 48); retina (852, 1340, 512, 96).
- `health_fill_red`: normal (700, 684, 256, 48); retina (1372, 1340, 512, 96).
- `health_frame`: normal (4, 748, 256, 48); retina (4, 1460, 512, 96).
- `icon_heart`: normal (548, 748, 48, 48); retina (1044, 1460, 96, 96).
- `icon_score`: normal (940, 748, 48, 48); retina (1772, 1460, 96, 96).
- `icon_time`: normal (60, 804, 48, 48); retina (4, 1564, 96, 96).
- `enemy_health_fill_green`: normal (228, 804, 160, 40); retina (316, 1564, 320, 80).
- `enemy_health_fill_red`: normal (396, 804, 160, 40); retina (644, 1564, 320, 80).
- `enemy_health_frame`: normal (564, 804, 160, 40); retina (972, 1564, 320, 80).

#### controls

- `button_round_hover`: normal (796, 588, 64, 64); retina (1564, 1156, 128, 128).
- `button_round_normal`: normal (868, 588, 64, 64); retina (1700, 1156, 128, 128).
- `button_round_pressed`: normal (940, 588, 64, 64); retina (1836, 1156, 128, 128).
- `icon_close`: normal (268, 748, 48, 48); retina (524, 1460, 96, 96).
- `icon_fire_front`: normal (324, 748, 48, 48); retina (628, 1460, 96, 96).
- `icon_fire_left`: normal (380, 748, 48, 48); retina (732, 1460, 96, 96).
- `icon_fire_right`: normal (436, 748, 48, 48); retina (836, 1460, 96, 96).
- `icon_forward`: normal (492, 748, 48, 48); retina (940, 1460, 96, 96).
- `icon_home`: normal (604, 748, 48, 48); retina (1148, 1460, 96, 96).
- `icon_minus`: normal (660, 748, 48, 48); retina (1252, 1460, 96, 96).
- `icon_pause`: normal (716, 748, 48, 48); retina (1356, 1460, 96, 96).
- `icon_play`: normal (772, 748, 48, 48); retina (1460, 1460, 96, 96).
- `icon_plus`: normal (828, 748, 48, 48); retina (1564, 1460, 96, 96).
- `icon_restart`: normal (884, 748, 48, 48); retina (1668, 1460, 96, 96).
- `icon_settings`: normal (4, 804, 48, 48); retina (1876, 1460, 96, 96).
- `icon_turn_left`: normal (116, 804, 48, 48); retina (108, 1564, 96, 96).
- `icon_turn_right`: normal (172, 804, 48, 48); retina (212, 1564, 96, 96).

### Atenção adicional às pastas retina

A resolução 2× é confirmada para UI e tiles, mas não deve ser extrapolada para todos os assets. Os atlas de navios normal/retina têm ambos 1024×512; cannon tem recorte 29×16 em ambos os XML. Os PNGs examinados ship_12 (66×113) e cannon_ball (10×10) também têm tamanhos iguais entre pastas. Escolher por dimensões e conteúdo, não apenas pelo nome retina.

## Sequência sugerida para uma futura integração

1. Usar localmente os três navios já selecionados: elimina a dependência de rede para essas imagens com pouca mudança de estrutura.
2. Aplicar fundos de UI em botões/painéis React existentes, mantendo texto, foco e estados; acrescentar HUD e ícones de toque com seus metadados.
3. Selecionar tiles e efeitos, revisando alinhamento visual com colisões existentes antes de trocar a arte.
4. Integrar sons com mute/volume e controle de ciclo de vida. Esta sequência é apenas recomendação; nenhuma dessas alterações foi executada.

## Apêndice: cobertura exata dos arquivos

Cada item lista uma pasta e todos os arquivos nela encontrados. Variantes default/retina foram contadas separadamente para permitir conferência do pacote.

### `./` — 10 arquivos

`logo_jungle_gaming.svg`, `preview.png`, `sample.png`, `sample_history.png`, `sample_menu.png`, `sample_options.png`, `sample_pause.png`, `sample_ranking.png`, `sample_result.png`, `ui_scene_background.png`.

### `png/default/effects/` — 5 arquivos

`explosion_1.png`, `explosion_2.png`, `explosion_3.png`, `fire_1.png`, `fire_2.png`.

### `png/default/ship_parts/` — 67 arquivos

`cannon.png`, `cannon_ball.png`, `cannon_loose.png`, `cannon_mobile.png`, `crew_1.png`, `crew_2.png`, `crew_3.png`, `crew_4.png`, `crew_5.png`, `crew_6.png`, `flag_1.png`, `flag_2.png`, `flag_3.png`, `flag_4.png`, `flag_5.png`, `flag_6.png`, `hull_large_1.png`, `hull_large_2.png`, `hull_large_3.png`, `hull_large_4.png`, `hull_small_1.png`, `hull_small_2.png`, `hull_small_3.png`, `hull_small_4.png`, `nest.png`, `pole.png`, `sail_large_1.png`, `sail_large_10.png`, `sail_large_11.png`, `sail_large_12.png`, `sail_large_13.png`, `sail_large_14.png`, `sail_large_15.png`, `sail_large_16.png`, `sail_large_17.png`, `sail_large_18.png`, `sail_large_19.png`, `sail_large_2.png`, `sail_large_20.png`, `sail_large_21.png`, `sail_large_22.png`, `sail_large_23.png`, `sail_large_24.png`, `sail_large_3.png`, `sail_large_4.png`, `sail_large_5.png`, `sail_large_6.png`, `sail_large_7.png`, `sail_large_8.png`, `sail_large_9.png`, `sail_small_1.png`, `sail_small_10.png`, `sail_small_11.png`, `sail_small_12.png`, `sail_small_13.png`, `sail_small_2.png`, `sail_small_3.png`, `sail_small_4.png`, `sail_small_5.png`, `sail_small_6.png`, `sail_small_7.png`, `sail_small_8.png`, `sail_small_9.png`, `wood_1.png`, `wood_2.png`, `wood_3.png`, `wood_4.png`.

### `png/default/ships/` — 30 arquivos

`dinghy_large_1.png`, `dinghy_large_2.png`, `dinghy_large_3.png`, `dinghy_small_1.png`, `dinghy_small_2.png`, `dinghy_small_3.png`, `ship_1.png`, `ship_10.png`, `ship_11.png`, `ship_12.png`, `ship_13.png`, `ship_14.png`, `ship_15.png`, `ship_16.png`, `ship_17.png`, `ship_18.png`, `ship_19.png`, `ship_2.png`, `ship_20.png`, `ship_21.png`, `ship_22.png`, `ship_23.png`, `ship_24.png`, `ship_3.png`, `ship_4.png`, `ship_5.png`, `ship_6.png`, `ship_7.png`, `ship_8.png`, `ship_9.png`.

### `png/default/tiles/` — 96 arquivos

`tile_1.png`, `tile_10.png`, `tile_11.png`, `tile_12.png`, `tile_13.png`, `tile_14.png`, `tile_15.png`, `tile_16.png`, `tile_17.png`, `tile_18.png`, `tile_19.png`, `tile_2.png`, `tile_20.png`, `tile_21.png`, `tile_22.png`, `tile_23.png`, `tile_24.png`, `tile_25.png`, `tile_26.png`, `tile_27.png`, `tile_28.png`, `tile_29.png`, `tile_3.png`, `tile_30.png`, `tile_31.png`, `tile_32.png`, `tile_33.png`, `tile_34.png`, `tile_35.png`, `tile_36.png`, `tile_37.png`, `tile_38.png`, `tile_39.png`, `tile_4.png`, `tile_40.png`, `tile_41.png`, `tile_42.png`, `tile_43.png`, `tile_44.png`, `tile_45.png`, `tile_46.png`, `tile_47.png`, `tile_48.png`, `tile_49.png`, `tile_5.png`, `tile_50.png`, `tile_51.png`, `tile_52.png`, `tile_53.png`, `tile_54.png`, `tile_55.png`, `tile_56.png`, `tile_57.png`, `tile_58.png`, `tile_59.png`, `tile_6.png`, `tile_60.png`, `tile_61.png`, `tile_62.png`, `tile_63.png`, `tile_64.png`, `tile_65.png`, `tile_66.png`, `tile_67.png`, `tile_68.png`, `tile_69.png`, `tile_7.png`, `tile_70.png`, `tile_71.png`, `tile_72.png`, `tile_73.png`, `tile_74.png`, `tile_75.png`, `tile_76.png`, `tile_77.png`, `tile_78.png`, `tile_79.png`, `tile_8.png`, `tile_80.png`, `tile_81.png`, `tile_82.png`, `tile_83.png`, `tile_84.png`, `tile_85.png`, `tile_86.png`, `tile_87.png`, `tile_88.png`, `tile_89.png`, `tile_9.png`, `tile_90.png`, `tile_91.png`, `tile_92.png`, `tile_93.png`, `tile_94.png`, `tile_95.png`, `tile_96.png`.

### `png/default/ui/controls/` — 17 arquivos

`button_round_hover.png`, `button_round_normal.png`, `button_round_pressed.png`, `icon_close.png`, `icon_fire_front.png`, `icon_fire_left.png`, `icon_fire_right.png`, `icon_forward.png`, `icon_home.png`, `icon_minus.png`, `icon_pause.png`, `icon_play.png`, `icon_plus.png`, `icon_restart.png`, `icon_settings.png`, `icon_turn_left.png`, `icon_turn_right.png`.

### `png/default/ui/hud/` — 11 arquivos

`counter_panel.png`, `enemy_health_fill_green.png`, `enemy_health_fill_red.png`, `enemy_health_frame.png`, `health_fill_amber.png`, `health_fill_green.png`, `health_fill_red.png`, `health_frame.png`, `icon_heart.png`, `icon_score.png`, `icon_time.png`.

### `png/default/ui/menu/` — 8 arquivos

`button_primary_disabled.png`, `button_primary_hover.png`, `button_primary_normal.png`, `button_primary_pressed.png`, `button_secondary_normal.png`, `button_secondary_pressed.png`, `panel_menu.png`, `title_pirate_battle.png`.

### `png/retina/effects/` — 5 arquivos

`explosion_1.png`, `explosion_2.png`, `explosion_3.png`, `fire_1.png`, `fire_2.png`.

### `png/retina/ship_parts/` — 67 arquivos

`cannon.png`, `cannon_ball.png`, `cannon_loose.png`, `cannon_mobile.png`, `crew_1.png`, `crew_2.png`, `crew_3.png`, `crew_4.png`, `crew_5.png`, `crew_6.png`, `flag_1.png`, `flag_2.png`, `flag_3.png`, `flag_4.png`, `flag_5.png`, `flag_6.png`, `hull_large_1.png`, `hull_large_2.png`, `hull_large_3.png`, `hull_large_4.png`, `hull_small_1.png`, `hull_small_2.png`, `hull_small_3.png`, `hull_small_4.png`, `nest.png`, `pole.png`, `sail_large_1.png`, `sail_large_10.png`, `sail_large_11.png`, `sail_large_12.png`, `sail_large_13.png`, `sail_large_14.png`, `sail_large_15.png`, `sail_large_16.png`, `sail_large_17.png`, `sail_large_18.png`, `sail_large_19.png`, `sail_large_2.png`, `sail_large_20.png`, `sail_large_21.png`, `sail_large_22.png`, `sail_large_23.png`, `sail_large_24.png`, `sail_large_3.png`, `sail_large_4.png`, `sail_large_5.png`, `sail_large_6.png`, `sail_large_7.png`, `sail_large_8.png`, `sail_large_9.png`, `sail_small_1.png`, `sail_small_10.png`, `sail_small_11.png`, `sail_small_12.png`, `sail_small_13.png`, `sail_small_2.png`, `sail_small_3.png`, `sail_small_4.png`, `sail_small_5.png`, `sail_small_6.png`, `sail_small_7.png`, `sail_small_8.png`, `sail_small_9.png`, `wood_1.png`, `wood_2.png`, `wood_3.png`, `wood_4.png`.

### `png/retina/ships/` — 30 arquivos

`dinghy_large_1.png`, `dinghy_large_2.png`, `dinghy_large_3.png`, `dinghy_small_1.png`, `dinghy_small_2.png`, `dinghy_small_3.png`, `ship_1.png`, `ship_10.png`, `ship_11.png`, `ship_12.png`, `ship_13.png`, `ship_14.png`, `ship_15.png`, `ship_16.png`, `ship_17.png`, `ship_18.png`, `ship_19.png`, `ship_2.png`, `ship_20.png`, `ship_21.png`, `ship_22.png`, `ship_23.png`, `ship_24.png`, `ship_3.png`, `ship_4.png`, `ship_5.png`, `ship_6.png`, `ship_7.png`, `ship_8.png`, `ship_9.png`.

### `png/retina/tiles/` — 96 arquivos

`tile_1.png`, `tile_10.png`, `tile_11.png`, `tile_12.png`, `tile_13.png`, `tile_14.png`, `tile_15.png`, `tile_16.png`, `tile_17.png`, `tile_18.png`, `tile_19.png`, `tile_2.png`, `tile_20.png`, `tile_21.png`, `tile_22.png`, `tile_23.png`, `tile_24.png`, `tile_25.png`, `tile_26.png`, `tile_27.png`, `tile_28.png`, `tile_29.png`, `tile_3.png`, `tile_30.png`, `tile_31.png`, `tile_32.png`, `tile_33.png`, `tile_34.png`, `tile_35.png`, `tile_36.png`, `tile_37.png`, `tile_38.png`, `tile_39.png`, `tile_4.png`, `tile_40.png`, `tile_41.png`, `tile_42.png`, `tile_43.png`, `tile_44.png`, `tile_45.png`, `tile_46.png`, `tile_47.png`, `tile_48.png`, `tile_49.png`, `tile_5.png`, `tile_50.png`, `tile_51.png`, `tile_52.png`, `tile_53.png`, `tile_54.png`, `tile_55.png`, `tile_56.png`, `tile_57.png`, `tile_58.png`, `tile_59.png`, `tile_6.png`, `tile_60.png`, `tile_61.png`, `tile_62.png`, `tile_63.png`, `tile_64.png`, `tile_65.png`, `tile_66.png`, `tile_67.png`, `tile_68.png`, `tile_69.png`, `tile_7.png`, `tile_70.png`, `tile_71.png`, `tile_72.png`, `tile_73.png`, `tile_74.png`, `tile_75.png`, `tile_76.png`, `tile_77.png`, `tile_78.png`, `tile_79.png`, `tile_8.png`, `tile_80.png`, `tile_81.png`, `tile_82.png`, `tile_83.png`, `tile_84.png`, `tile_85.png`, `tile_86.png`, `tile_87.png`, `tile_88.png`, `tile_89.png`, `tile_9.png`, `tile_90.png`, `tile_91.png`, `tile_92.png`, `tile_93.png`, `tile_94.png`, `tile_95.png`, `tile_96.png`.

### `png/retina/ui/controls/` — 17 arquivos

`button_round_hover.png`, `button_round_normal.png`, `button_round_pressed.png`, `icon_close.png`, `icon_fire_front.png`, `icon_fire_left.png`, `icon_fire_right.png`, `icon_forward.png`, `icon_home.png`, `icon_minus.png`, `icon_pause.png`, `icon_play.png`, `icon_plus.png`, `icon_restart.png`, `icon_settings.png`, `icon_turn_left.png`, `icon_turn_right.png`.

### `png/retina/ui/hud/` — 11 arquivos

`counter_panel.png`, `enemy_health_fill_green.png`, `enemy_health_fill_red.png`, `enemy_health_frame.png`, `health_fill_amber.png`, `health_fill_green.png`, `health_fill_red.png`, `health_frame.png`, `icon_heart.png`, `icon_score.png`, `icon_time.png`.

### `png/retina/ui/menu/` — 8 arquivos

`button_primary_disabled.png`, `button_primary_hover.png`, `button_primary_normal.png`, `button_primary_pressed.png`, `button_secondary_normal.png`, `button_secondary_pressed.png`, `panel_menu.png`, `title_pirate_battle.png`.

### `sounds/` — 27 arquivos

`cannon_broadside.wav`, `cannon_fire_1.wav`, `cannon_fire_2.wav`, `cannon_fire_3.wav`, `cannonball_water_hit_1.wav`, `cannonball_water_hit_2.wav`, `game_complete.wav`, `game_over.wav`, `game_pause.wav`, `game_resume.wav`, `game_start.wav`, `health_low.wav`, `ocean_ambience_loop.wav`, `score_point.wav`, `ship_collision.wav`, `ship_explosion_1.wav`, `ship_explosion_2.wav`, `ship_sailing_loop.wav`, `ship_sinking.wav`, `ship_wood_hit_1.wav`, `ship_wood_hit_2.wav`, `time_warning.wav`, `ui_back.wav`, `ui_click.wav`, `ui_close.wav`, `ui_hover.wav`, `ui_open.wav`.

### `spritesheet/` — 8 arquivos

`ships_miscellaneous_sheet.png`, `ships_miscellaneous_sheet.xml`, `ships_miscellaneous_sheet_retina.png`, `ships_miscellaneous_sheet_retina.xml`, `ui_sheet.json`, `ui_sheet.png`, `ui_sheet_retina.json`, `ui_sheet_retina.png`.

### `tilesheet/` — 3 arquivos

`tiles_sheet.png`, `tiles_sheet_retina.png`, `tilesheets.txt`.

### `vector/` — 4 arquivos

`ships_miscellaneous_vector.svg`, `ships_miscellaneous_vector.swf`, `tile_vector.swf`, `tiles_vector.svg`.

