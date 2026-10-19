---
name: workflow
description: Executa um Workflow de agentes (definido em ~/.claude/workflows/<nome>.md ou .claude/workflows/<nome>.md) sobre uma tarefa. Use quando o usuário pedir para rodar, usar ou executar um workflow pelo nome, ex. "usa o workflow tradutor para traduzir isto" ou "/workflow feature implementar X".
arguments: [workflow, tarefa]
---
Execute o Workflow `$workflow` sobre a tarefa: $tarefa

Se foi invocado sem argumentos, descubra pelo pedido do usuário o nome do Workflow e a tarefa. Se o nome não bater com nenhum arquivo, liste os Workflows existentes e pergunte qual usar.

## Carregar
Leia `.claude/workflows/$workflow.md` do projeto; se não existir, `~/.claude/workflows/$workflow.md`. Se nenhum existir, pare e avise.

Formato:
- `Entrada → <Etapa>`: primeira Etapa.
- `## <Etapa>` + `agente: <subagent>` + `saídas:`.
- `- handoff → <Etapa|Fim>`: avança.
- `- devolução → <Etapa> (máx N)`: volta para Etapa anterior, no máximo N vezes.

O Workflow já foi validado pelo app agent-workflows. Se algo estiver incoerente (Agente inexistente, saída para Etapa inexistente), pare e mostre o problema.

## Preparar
Crie `.workflows/runs/<slug-da-tarefa>/` no projeto, e garanta que `.workflows/` está no `.gitignore`:
- `brief.md`: a tarefa + seção "Decisões".
- `state.md`: Etapa atual, histórico (Etapa → saída → resumo) e devoluções por Etapa.

## Executar cada Etapa
Na primeira vez da Etapa, dispare o subagent `agente` com `name` = nome da Etapa e só esta mensagem:

    [Handoff: <Etapa anterior ou Entrada> → <Etapa atual>]
    Tarefa e decisões: .workflows/runs/<slug>/brief.md
    Leia também: <artefatos das Etapas anteriores>
    Escreva seu resultado em: .workflows/runs/<slug>/<etapa>.md
    Anexe decisões novas em brief.md, seção "Decisões".
    Termine com exatamente:
    RESULTADO
    saida: <uma de: lista das saídas da Etapa>
    resumo: <até 5 linhas>

Em devolução para uma Etapa já executada, envie com SendMessage ao subagent já nomeado daquela Etapa o caminho do artefato de quem devolveu, pedindo para corrigir só o apontado e terminar com o mesmo bloco RESULTADO. Se não for possível retomá-lo, dispare um novo com a mensagem de handoff + o artefato de quem devolveu.

Após cada Etapa:
- Confirme que `saida` é uma das saídas listadas; senão, peça ao subagent para corrigir.
- Atualize `state.md`.
- Devolução acima do máximo: pare e pergunte ao usuário como seguir.
- Leia só o bloco RESULTADO; o detalhe fica nos artefatos.
- Se a Etapa terminar com uma pergunta ao usuário, repasse a pergunta e espere a resposta antes de continuar.

## Fim
Mostre o histórico de Etapas e o resultado final (o artefato da última Etapa). Se houve mudança em código, mostre também `git diff --stat`. Não faça commit.

<!-- gerenciado por agent-workflows: apague esta linha para manter suas edições -->
