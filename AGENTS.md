## O que é

CRUD local de Agentes e Workflows do Claude Code. Os dados são os próprios arquivos de texto:

- Agente → `<claude>/agents/<nome>.md` (subagent do Claude Code; campos de frontmatter que o app não edita são preservados).
- Workflow → `<claude>/workflows/<nome>.md`.
- Skill `/workflow <nome> "<tarefa>"` → `<claude>/skills/workflow/SKILL.md`, instalada no start se não existir.

`<claude>` é `~/.claude` por padrão (`AGENT_WORKFLOWS_CLAUDE_DIR` muda).

## Glossário

- **Workflow**: Etapas ligadas, da Entrada até o Fim.
- **Etapa**: executada por um Agente; tem saídas.
- **Handoff**: saída que avança para outra Etapa ou para o Fim. Handoffs não formam ciclo.
- **Devolução**: saída que volta para uma Etapa anterior, com máximo de voltas.

## Código

Clean Architecture (domain → application → infrastructure/interface → composition root) + SOLID + clean code, sem comentários no código. Daemon Bun só em `127.0.0.1`: token no link inicial → cookie `HttpOnly`, validação de `Host`/`Origin` em todo request, nunca CORS. Testes pela API do daemon (`bun test`).
