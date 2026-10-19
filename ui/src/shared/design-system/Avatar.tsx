import type { CSSProperties } from "react";

type AvatarSize = 18 | 24 | 32 | 40;
type Provider = "claude" | "codex";

type AvatarProps =
  | { kind: "provider"; provider: Provider; size?: AvatarSize }
  | { kind: "agent"; name: string; color: string; size?: AvatarSize }
  | { kind: "person"; name: string; size?: AvatarSize };

const PROVIDER_NAMES: Record<Provider, string> = { claude: "Claude", codex: "Codex" };

export function Avatar(props: AvatarProps) {
  const size = props.size ?? 24;
  const name = props.kind === "provider" ? PROVIDER_NAMES[props.provider] : props.name;
  const variantClass = props.kind === "provider" ? `avatar--${props.provider}` : `avatar--${props.kind}`;
  const style = {
    "--avatar-size": `${size}px`,
    ...(props.kind === "agent" && { "--avatar-color": props.color }),
  } as CSSProperties;

  return (
    <span className={`avatar ${variantClass}`} style={style} role="img" aria-label={name}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
