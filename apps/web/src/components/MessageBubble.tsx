import styles from "./MessageBubble.module.css";

export default function MessageBubble({
  variant,
  name,
  text,
  avatarUrl,
}: {
  variant: "player" | "npc";
  name: string;
  text: string;
  avatarUrl?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const avatar = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.avatar} src={avatarUrl} alt="" />
  ) : (
    <span className={styles.avatar} aria-hidden="true">
      {initial}
    </span>
  );

  return (
    <div
      className={`${styles.row} ${
        variant === "player" ? styles.rowPlayer : styles.rowNpc
      }`}
    >
      {variant === "npc" ? avatar : null}
      <div className={styles.body}>
        <span className={styles.name}>{name}</span>
        <div
          className={`${styles.bubble} ${
            variant === "player" ? styles.player : styles.npc
          }`}
        >
          {text}
        </div>
      </div>
      {variant === "player" ? avatar : null}
    </div>
  );
}
