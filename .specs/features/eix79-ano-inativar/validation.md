# EIX-79 · Ano de fabricação e inativação — Validação

## Validation: EIX-79 — PASS

**Data**: 2026-10-16
**Verifier**: sub-agente independente (autor ≠ verificador)
**Spec**: `.specs/features/eix79-ano-inativar/spec.md`
**Diff**: base `eff0160` contra a árvore de trabalho ainda sem commit em `feat/eix-79-us06-ano-inativar`.

Os 19 critérios de aceite têm evidência rastreável. Não foram encontradas lacuna de implementação bloqueante, regressão de segurança nem mutante sobrevivente. O PASS cobre a verificação automatizada e a revisão estática. O teste de aceite em dispositivo continua pendente.

## Conclusão das tasks

T1 a T5 foram implementadas e revisadas de forma independente pelos testes de schema, repositório e telas. A T6 é verificada por este relatório. O Verifier não fez commit, push, PR nem atualização no Linear, e não alterou nenhum arquivo de implementação ou de teste. Este relatório é a única escrita dele na árvore de trabalho.

## Critérios de aceite contra a spec

Todos os caminhos abaixo apontam para asserções reais. `COLUNAS` inclui `ano_fabricacao` explicitamente; `scania` é o fixture com ano nulo. Nos testes parametrizados de veículos selecionáveis, `status` é a lista exata de status permitidos para a finalidade. Reticências indicam campos omitidos do objeto, e não uma expressão literal do código.

| AC | Resultado esperado pela spec | Evidência (arquivo:linha e asserção) | Resultado |
| --- | --- | --- | --- |
| ANO-01 | Ano inteiro de 1950 até o ano atual de São Paulo + 1 | `src/features/veiculos/__tests__/schema.test.ts:36` `expect(...ano_fabricacao).toBe(1950)`; linha 37 `.toBe(2027)`; linha 41 `.toEqual(['Informe um ano entre 1950 e 2027.'])`; linhas 54/56 recusam 2028 antes da virada do ano em São Paulo e aceitam depois dela | PASS |
| ANO-02 | Ano obrigatório, numérico e inteiro; erro no campo em português | `src/features/veiculos/__tests__/schema.test.ts:45` `expect(mensagens(...)).toEqual(...)` confere a mensagem exata de ano obrigatório para vazio/undefined/null; a linha 49 confere a mensagem exata de ano inteiro; `src/features/veiculos/__tests__/VeiculoFormView.test.tsx:169` `expect(screen.getByText(...)).toBeOnTheScreen()` e a linha 170 `expect(criarVeiculo).not.toHaveBeenCalled()` | PASS |
| ANO-03 | A leitura seleciona e valida o ano, aceitando null | `src/features/veiculos/__tests__/repository.test.ts:133` `expect(query.select).toHaveBeenCalledWith(COLUNAS)`; linha 196 `expect(await buscarVeiculoPorId('2')).toEqual({ ok: true, data: scania })` | PASS |
| ANO-04 | Criar e atualizar gravam o ano informado | `src/features/veiculos/__tests__/repository.test.ts:219` `expect(query.insert).toHaveBeenCalledWith({...ano_fabricacao:2020...})`; linha 298 `expect(query.update).toHaveBeenCalledWith(expect.objectContaining({...ano_fabricacao:2020}))`; `src/features/veiculos/__tests__/VeiculoFormView.test.tsx:184` `expect(atualizarVeiculo).toHaveBeenCalledWith('9', expect.objectContaining({ ano_fabricacao: 2020 }))` | PASS |
| ANO-05 | Erro 23514 de ano vai para o campo de ano com mensagem em português; erros de placa continuam iguais | `src/features/veiculos/__tests__/repository.test.ts:289` `expect(resultado).toEqual({ok:false,campo:'ano_fabricacao',mensagem:...})` confere a mensagem exata em português; as linhas 247/248 conferem campo e mensagem da placa; `src/features/veiculos/__tests__/VeiculoFormView.test.tsx:206` `expect(screen.getAllByText(mensagem)).toHaveLength(2)` | PASS |
| ANO-06 | O status Inativo não muda e o formulário não oferece opções de status | `src/features/veiculos/__tests__/VeiculoFormView.test.tsx:194` `expect(screen.queryByRole('tab')).toBeNull()` e a linha 197 `expect(atualizarVeiculo).toHaveBeenCalledWith('9',expect.objectContaining({status:'Inativo',modelo:'FH 460'}))`; `src/features/veiculos/__tests__/repository.test.ts:265` confere `.neq('status','Inativo')` e a linha 282 confere `.eq('status','Inativo')` | PASS |
| INA-01 | UPDATE condicional por id e status Disponivel grava Inativo, sem DELETE | `src/features/veiculos/__tests__/repository.test.ts:71` `expect(query.update).toHaveBeenCalledWith({status:'Inativo'})`; as linhas 72/73 conferem os filtros de id e status; linha 75 `expect(query.delete).not.toHaveBeenCalled()`; `supabase/tests/rls.test.ts:267` confere o status gravado por perfil e por status anterior | PASS |
| INA-02 | Nenhuma linha atualizada devolve o erro em português da spec, sem falso sucesso | `src/features/veiculos/__tests__/repository.test.ts:80` `expect(await inativarVeiculo('1')).toEqual({ok:false,mensagem:...})` confere a mensagem exata da spec; `src/features/veiculos/__tests__/VeiculosListView.test.tsx:123` `expect(screen.queryByText(...)).toBeNull()` descarta a mensagem de sucesso | PASS |
| INA-03 | Operação pendente mostra loading e impede envio duplicado | `src/features/veiculos/__tests__/VeiculosListView.test.tsx:105` `.toBeDisabled()`; linha 106 `expect(screen.getByTestId('button-loading')).toBeOnTheScreen()`; linha 108 `expect(inativarVeiculo).toHaveBeenCalledTimes(1)` | PASS |
| INA-04 | O Alert nativo tem Cancelar e uma confirmação destrutiva | `src/features/veiculos/__tests__/VeiculosListView.test.tsx:56` `expect(alerta).toHaveBeenCalledWith(...,expect.stringContaining('ABC-1234'),[...style:'cancel',...style:'destructive',onPress:expect.any(Function)])` | PASS |
| INA-05 | Cancelar preserva o veículo e não chama o repositório | `src/features/veiculos/__tests__/VeiculosListView.test.tsx:61` `expect(inativarVeiculo).not.toHaveBeenCalled()`; a linha 62 confere que a placa continua visível. O botão Cancelar nativo não tem callback de mutação | PASS |
| INA-06 | Sucesso recarrega com o filtro atual e mostra a Snackbar de sucesso | `src/features/veiculos/__tests__/VeiculosListView.test.tsx:76` confere a mensagem exata de sucesso; a linha 77 confere o badge Inativo; as linhas 92/94 tiram a placa da lista sob o filtro Disponível e exigem `toHaveBeenLastCalledWith({busca:undefined,status:'Disponivel'})` | PASS |
| INA-07 | Falha preserva o veículo e mostra a Snackbar de erro | `src/features/veiculos/__tests__/VeiculosListView.test.tsx:121` `expect(screen.getByText(...)).toBeOnTheScreen()` confere o erro devolvido; a linha 122 confere que a placa continua visível e a linha 123 descarta o sucesso | PASS |
| INA-08 | Sem botão Inativar para EmViagem, EmManutencao ou Inativo | `src/features/veiculos/__tests__/VeiculosListView.test.tsx:133` `expect(screen.queryByRole('button',{name:'Inativar'})).toBeNull()` para os três status | PASS |
| INA-09 | Guards e policies de escrita de Admin/Gestor de Frota continuam intactos | `supabase/tests/rls.test.ts:264` `expect(resultado.rows).toEqual(atualiza ? [{status:'Inativo'}] : [])`; linha 267 `expect(persistido.rows[0]!.status).toBe(atualiza ? 'Inativo' : status)` para quatro perfis e quatro status; linha 296 `expect(deleteVeiculo.rows).toHaveLength(0)`; guard inalterado em `app/(app)/_layout.tsx:37` e `src/navigation/menu.ts:71` | PASS |
| SEL-01 | O filtro Inativo consulta Inativo e mantém o header nativo | `src/features/veiculos/__tests__/VeiculosListView.test.tsx:142` `expect(listarVeiculos).toHaveBeenLastCalledWith({busca:undefined,status:'Inativo'})`; linha 140 `.props.horizontal).toBe(true)`; as linhas 168/169 descartam marca repetida no conteúdo; o título nativo continua em `app/(app)/_layout.tsx:39` | PASS |
| SEL-02 | A seleção para viagem consulta só Disponivel | `src/features/veiculos/__tests__/repository.test.ts:105` `expect(query.in).toHaveBeenCalledWith('status',status)` com `['Disponivel']` para viagem | PASS |
| SEL-03 | A seleção para manutenção consulta Disponivel e EmManutencao | `src/features/veiculos/__tests__/repository.test.ts:105` `.toHaveBeenCalledWith('status',status)` com `['Disponivel','EmManutencao']`; linha 114 `expect(await listarVeiculosSelecionaveis('manutencao')).toEqual({ok:true,data:[volvo,manutencao]})` | PASS |
| SEL-04 | As consultas de selecionáveis excluem Inativo/EmViagem sem mudar os consumidores | `src/features/veiculos/__tests__/repository.test.ts:105` confere as listas exatas; as linhas 119-121 conferem vazio, erro e resposta inválida. O diff não altera consumidores da EIX-39/40 | PASS |

Nenhuma falta de precisão na spec foi encontrada. Onde a spec define a mensagem exata, as asserções conferem essa mensagem. Os demais critérios pedem mensagem em português ou estado observável, e os testes miram esses resultados.

## Edge cases

- Virada do ano em São Paulo depois de importar o schema: `src/features/veiculos/__tests__/schema.test.ts:54` e linha 56.
- Veículo antigo com ano nulo abre o campo vazio, impede salvar e permite completar o ano: `src/features/veiculos/__tests__/VeiculoFormView.test.tsx:178`, linhas 180/184.
- Edição concorrente não reativa um veículo inativado: `src/features/veiculos/__tests__/repository.test.ts:259`, linhas 263/265. Editar um veículo inativo também exige que o registro já esteja inativo, linhas 280-282.
- Nenhuma linha atualizada devolve a mensagem exata da spec: `src/features/veiculos/__tests__/repository.test.ts:80`.
- Tentar novamente após falha na carga: `src/features/veiculos/__tests__/VeiculoFormView.test.tsx:230` `.toHaveProp('value','2020')`.
- Cinco filtros com rolagem horizontal: `src/features/veiculos/__tests__/VeiculosListView.test.tsx:140` `.props.horizontal).toBe(true)`.

## Gate

Gate exigido: `npm run typecheck; npm run lint; npm run test` (no Windows: `npm.cmd`).

Typecheck e lint saíram com código 0, executados e confirmados pelo orquestrador. O Verifier conferiu o log local da execução final (não versionado): 89 suítes e 900 testes do app; 16 suítes e 300 testes do Supabase. Total: 1200 aprovados, zero falhas, zero ignorados. Linha de base antes da feature, informada pelo orquestrador: 861 testes do app e 296 do Supabase; diferença de +39/+4 = +43 testes. A revisão do diff não encontrou teste apagado nem asserção enfraquecida para acomodar falha. As asserções que exigiam a ausência do ano foram atualizadas para o comportamento aprovado.

## Sensor de discriminação

Cópia isolada de `src/features/veiculos` numa pasta temporária fora do repositório. O Jest usou o rootDir e os aliases do workspace original, com `roots` restrito à feature copiada e `modulePaths` apontando para o `node_modules` existente. Nenhuma dependência foi instalada, e não foram usados junction nem stash. A cópia sem mutação passou em 5 suítes e 92 testes, com código de saída 0.

Comando do sensor: `node <workspace>/node_modules/jest/bin/jest.js --config <scratch>/jest.json --runInBand --silent <teste-alvo>`.

As linhas de código-fonte abaixo apontam para a versão atual de `repository.ts`; as mutações foram aplicadas nos mesmos trechos em 16/10.

| Mutação semântica isolada | Código-fonte | Asserção que discrimina | Resultado obtido |
| --- | --- | --- | --- |
| Aceitar 1949: `ano < 1950` vira `ano < 1949` | `src/features/veiculos/schema.ts:42` | schema.test.ts:41 | Morto, saída 1; 1 falhou, 18 passaram |
| Aceitar um ano a mais no limite superior: `ano > maximo` vira `ano > maximo + 1` | `src/features/veiculos/schema.ts:42` | schema.test.ts:41/54 | Morto, saída 1; 2 falharam, 17 passaram |
| Trocar a guarda Disponivel por EmViagem | `src/features/veiculos/repository.ts:189` | repository.test.ts:73 | Morto, saída 1; 1 falhou, 29 passaram |
| Trocar o payload Inativo do UPDATE por Disponivel | `src/features/veiculos/repository.ts:187` | repository.test.ts:71 | Morto, saída 1; 1 falhou, 29 passaram |
| Incluir Inativo na lista de viagem | `src/features/veiculos/repository.ts:206` | repository.test.ts:105 | Morto, saída 1; 1 falhou, 29 passaram |
| Converter Inativo em Disponivel ao carregar o formulário | `src/features/veiculos/VeiculoFormView.tsx:77` | VeiculoFormView.test.tsx:193 | Morto, saída 1; 1 falhou, 19 passaram |

**Profundidade do sensor**: seis mutações semânticas, incluindo a integridade do status.
**Resultado do sensor**: 6 injetadas, 6 mortas, 0 sobreviventes. Todas morreram por falha de asserção, e não por erro de configuração ou de carregamento de módulo. As primeiras tentativas de configurar a cópia tiveram erros de resolução de dependência; essas tentativas não contam como mutação nem como morte. Uma execução verde de base precedeu as seis mutações válidas.

O `git status --porcelain` da árvore real foi capturado antes e depois do sensor e comparado byte a byte: idêntico. A pasta temporária foi removida depois de validar que o caminho absoluto estava dentro da pasta temporária do sistema e de confirmar que não havia ReparsePoint. A árvore real de implementação nunca foi alterada. Este relatório só foi escrito depois da comparação e da limpeza.

## Qualidade de código e segurança

Diff revisado: nove arquivos da feature e testes novos apenas em `supabase/tests/rls.test.ts`. Nenhuma mudança em `src/ui`, migrations, CI, dependências ou consumidores fora do escopo. Os tipos vêm dos tipos gerados do banco. Nenhum `any` foi introduzido. Primitivos e tokens existentes foram reutilizados, sem botão novo e sem cor, espaçamento ou tamanho visual hardcoded. `flex`/`flexGrow` são propriedades de layout, não valores novos de token visual. Os estados de carregando, vazio, erro e feedback de ação estão cobertos. Nenhuma refatoração sem relação com a task foi identificada.

O RLS continua ativo. Os testes de banco conferem que Admin e Gestor de Frota atualizam e que Financeiro e Motorista têm a escrita recusada, incluindo o estado gravado e o DELETE proibido. A disponibilidade é checada de forma atômica no filtro do UPDATE. Guards de navegação e headers nativos continuam intactos. Erros técnicos do banco são traduzidos antes de chegar à interface. Diretrizes revisadas: `AGENTS.md`, `DESIGN_CYAN.md` e `coding-principles.md` da skill tlc-spec-driven.

Cobertura por camada: limites e validação do schema; payloads, guardas, falhas, respostas e filtros do repositório; render, caminho feliz, edge cases e erros das telas; autorização real por perfil no backend. Nenhuma rota nova foi criada. Os testes alterados correspondem a ACs, a edge cases listados ou à preservação de comportamento anterior. Nenhum teste novo sem critério correspondente foi identificado.

## Lacunas e revisão manual

Nenhuma lacuna de implementação que exija correção foi identificada. O Verifier não fez teste de aceite em dispositivo. Revisar manualmente: teclado numérico e rolagem no Android, cancelamento e confirmação do Alert nativo, comportamento da Snackbar, acessibilidade dos controles e filtros em celular pequeno e tablet. São limites da verificação visual e em dispositivo, e não evidência de critério automatizado falhando.

## Rastreabilidade

ANO-01 a ANO-06, INA-01 a INA-09 e SEL-01 a SEL-04 estão verificados aqui. O orquestrador atualiza as tabelas da spec e do STATE, porque o Verifier só tinha autorização para escrever este relatório. Nenhuma falha comprovada, mutante sobrevivente ou desvio da spec exige lição ou task de correção. O gate determinístico `validate_state.py` já tinha retornado zero erros para o veredito e as evidências deste relatório; a regravação apenas de codificação não muda o resultado da verificação. Nenhum teste ou sensor foi executado de novo por causa dessa regravação.

## Verificação da entrega — 2026-10-18

O usuário autorizou a instalação de infraestrutura local, o commit, o push e um PR para o Jean Ribeiro. A revisão independente e os resultados de mutação anteriores são evidência histórica de 16/10; não se declara nova execução de mutação.

### Checagens automatizadas executadas

- `npm.cmd run typecheck`: saída 0.
- `npm.cmd run lint`: saída 0.
- `npx.cmd jest --selectProjects app --runInBand`: saída 0, 89 suítes, 900 testes aprovados. Evidência em log local não versionado.
- `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects supabase --runInBand`: saída 0, 16 suítes, 300 testes aprovados. Evidência em log local não versionado.
- O primeiro `npm run test` teve quatro falhas transitórias de Snackbar em módulos sem relação com a feature, enquanto a compilação nativa rodava em paralelo. Uma primeira repetição em série falhou numa asserção de Categorias; a suíte isolada dela (15 testes) e a execução completa seguinte dos 900 testes passaram, sem alterar teste nem código de produção. Essas falhas ficaram registradas nos logs locais, e não foram reportadas como aprovadas.
- `git diff --check`: saída 0. Nenhuma mudança de implementação foi necessária nesta verificação da entrega.

### Checagens com backend local executadas

Estavam disponíveis WSL 3.0.3, kernel Linux do WSL2, Docker Engine 29.8.2 (contêineres Linux), Supabase CLI 2.121.0 e JDK 17. O GitHub CLI foi instalado pelo pacote oficial do winget. As migrations existentes foram copiadas sem alteração para um diretório de trabalho separado, fora do repositório; esse ambiente tem project ID próprio, nenhum projeto remoto vinculado e nenhum seed do projeto. Todas as migrations foram aplicadas com sucesso.

Um script de verificação local (fora da entrega) usou a chave anon pública e sessões reais com senha contra Auth/REST. Ele verificou: quatro perfis fictícios aprovados; escrita do Admin; criação e edição de ano pelo Gestor; atualizações recusadas para Financeiro e Motorista; anos 1949/2028 recusados e 1950/2027/2020 aceitos; ano nulo legado; os quatro filtros de status; recusa condicional para EmViagem/EmManutencao/Inativo; inativação concorrente de Admin e Gestor com exatamente uma linha atualizada; estado inativo gravado; exclusão física recusada, com a linha preservada. O RLS continuou ativo. São checagens de integração pela API, e não checagens de interface no Android.

Um `adb shell` fez uma requisição HTTP do emulador para `10.0.2.2:54321/auth/v1/health` e recebeu HTTP 200. O emulador usado tem perfil `pixel_7`, API 36, 1080×2400 com densidade 420.

### Reprodução local

Crie um diretório de trabalho do Supabase separado, com as migrations e a config copiadas, um project ID único e `db.seed.sql_paths` vazio. Rode `npx supabase start --workdir <sandbox>`. Crie usuários fictícios pela API admin do Auth local e depois atribua perfil e status Ativo apenas no banco do sandbox. Mantenha as chaves administrativas no processo de preparação; nunca as coloque em variáveis do Expo.

O login por e-mail e senha que já existe é habilitado de forma reversível pelo `.env.local`, que é ignorado pelo Git: `EXPO_PUBLIC_LOGIN_EMAIL_HABILITADO=true`, URL da API local `http://10.0.2.2:54321`, chave anon pública local e um client ID web do Google de exemplo, sem segredo. Não foi introduzida autenticação falsa nem desvio no código. O arquivo de env original foi copiado como backup local. O development build usa o Metro na porta 8081 com `adb reverse tcp:8081 tcp:8081`.

O primeiro build nativo bateu no limite de 260 caracteres de caminho do Ninja no Windows, dentro do OneDrive. Um drive virtual ainda gerou caminhos canônicos misturados no autolinking. Por isso o build nativo roda numa cópia isolada em caminho curto, fora do repositório, sem mudar a configuração do projeto. Caches nativos, contas locais, valores de env e diretórios de build ficaram fora do diff entregue.

### Checagens de interação e visuais no Android executadas

O APK de desenvolvimento foi compilado com sucesso na cópia de caminho curto (`BUILD SUCCESSFUL`, 519 tasks) e instalado no emulador. O pacote instalado é `com.eixocerto.app`. O Metro serve a árvore de código original; a cópia de build só contorna o limite de tamanho de caminho nativo. Na cópia de build, use `npx expo run:android --device <nome do AVD> --no-bundler`; no diretório do código, rode `npx expo start --dev-client --lan --max-workers 2`; depois abra o development client pela porta 8081 redirecionada com o ADB.

O agente interagiu com o emulador pelo ADB e conferiu a saída do UIAutomator e capturas de tela. Isto é um smoke test de interface no emulador, e não aceite manual humano:

- O login real do Admin por e-mail e senha funcionou. A navegação Frota → Veículos carregou os registros locais.
- Formulário de novo veículo: o teclado numérico apareceu no Ano de Fabricação, e a rolagem deixou o Salvar alcançável com o teclado aberto. O ano 1949 mostrou `Informe um ano entre 1950 e 2027.` e não salvou. Trocar por 2027 criou o veículo e mostrou `Veículo cadastrado.`
- Reabrir o Editar carregou 2027. Salvar 1950 mostrou `Veículo atualizado.` Reabrir depois da inativação ainda mostrou 1950, o que prova que o valor gravado sobreviveu à navegação e à recarga.
- O filtro Disponível mostrou o veículo criado. Inativar abriu uma confirmação nativa com a placa e a explicação sobre o histórico. Cancelar voltou para a lista com o veículo ainda presente. Confirmar numa segunda tentativa tirou o veículo do filtro Disponível e mostrou `Veículo inativado.`
- A rolagem horizontal dos filtros revelou o Inativo. Selecioná-lo e rolar os resultados mostrou o veículo inativado. Editá-lo mostrou o status Inativo como texto simples, sem abas para mudar o status.
- O teclado numérico e o layout de edição de inativo foram conferidos visualmente no Pixel 7. As capturas de tela e os snapshots XML do UIAutomator ficaram guardados localmente, fora do repositório.

Nenhum defeito da feature foi encontrado. Um tutorial de escrita à mão do Gboard, que aparece no primeiro uso, interceptou as primeiras tentativas de automação; ele foi fechado e a escrita com caneta foi desativada temporariamente para o teste, sem mudar o código do app.

### Limites da verificação

O spinner da operação pendente foi rápido demais para uma inspeção visual confiável na rede local; a cobertura de loading e de envio duplicado é automatizada, e não se declara observação manual. Os erros de ano obrigatório, decimal, não numérico e acima do limite, além do feedback de falha da API, são cobertos pelo Jest; o smoke test no emulador exercitou especificamente o erro do limite inferior e os valores-limite aceitos. O Gestor e os dois perfis bloqueados foram exercitados por sessões reais de Auth/REST, e não por logins separados no Android. A concorrência foi exercitada por chamadas REST reais simultâneas. Layout em tablet e celular pequeno, TalkBack, aceite humano e teste em dispositivo físico continuam sem execução. O PR deve manter essas distinções para a revisão.

## Ajuste da revisão — 2026-10-18

Na revisão do PR #39, a edição de um veículo inativado em outra sessão enquanto o formulário estava aberto mostrava "Veículo não encontrado.". O bloqueio estava certo (a edição não reativa o veículo), mas a mensagem não explicava o motivo.

- `src/features/veiculos/repository.ts:169`: quando o UPDATE de um veículo ativo não altera nenhuma linha, o repositório relê o veículo. Se ele está Inativo, devolve `Este veículo foi inativado enquanto você editava. Volte à lista e abra o cadastro de novo.`; nos demais casos, continua `Veículo não encontrado.`.
- `src/features/veiculos/__tests__/repository.test.ts:259` confere a mensagem nova e a releitura pelo id, sem segundo UPDATE; a linha 270 confere que a edição de um inativo sem linha atualizada não relê o status; a linha 309 confere que, sem veículo na releitura, a mensagem continua `Veículo não encontrado.`.
- O edge case correspondente da spec foi atualizado. O sensor de discriminação não foi executado de novo para este ajuste.
