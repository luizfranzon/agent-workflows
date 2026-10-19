const AGENT_COLORS = ["#c4a7f5", "#5b8def", "#e0a43a", "#7fd4c8", "#e8a07f", "#7fdc95", "#f0877f", "#8fb2ff"];

export function agentColor(agentName: string) {
  const hash = [...agentName].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7);
  return AGENT_COLORS[hash % AGENT_COLORS.length]!;
}
