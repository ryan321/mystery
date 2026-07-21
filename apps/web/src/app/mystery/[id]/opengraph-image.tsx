import { ImageResponse } from "next/og";
import { assetUrl, getCase } from "../../../lib/api";
import { difficultyLabel } from "../../../lib/format";

export const alt = "MysteryTrove case";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#d4b56a";
const GOLD_DIM = "#8a7348";
const CREAM = "#e8dfd0";
const FOG = "#9aafc4";

/** Cover bytes → data URL (ImageResponse can't reach out on its own). */
async function coverDataUrl(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let title = "Can you solve a murder?";
  let subtitle = "Interactive whodunit";
  let cover: string | null = null;
  try {
    const c = await getCase(id);
    title = c.meta.title;
    const bits = [difficultyLabel(c.meta.difficulty), c.meta.tone].filter(
      Boolean
    );
    if (bits.length) subtitle = bits.join(" · ");
    cover = await coverDataUrl(assetUrl(c.coverUrl));
  } catch {
    // Unknown/private case — the generic branded card below still works.
  }

  // Shrink the title as it grows so it never crowds the card.
  const titleSize = title.length > 42 ? 48 : title.length > 24 ? 60 : 72;

  const wordmark = (
    <div
      style={{
        display: "flex",
        color: GOLD,
        fontSize: 26,
        letterSpacing: 10,
        textTransform: "uppercase",
      }}
    >
      Mystery Trove
    </div>
  );

  const heading = (
    <div
      style={{
        display: "flex",
        marginTop: 36,
        color: CREAM,
        fontSize: titleSize,
        fontWeight: 700,
        lineHeight: 1.15,
      }}
    >
      {title}
    </div>
  );

  const subline = (
    <div
      style={{
        display: "flex",
        marginTop: 22,
        color: GOLD_DIM,
        fontSize: 28,
        letterSpacing: 4,
        textTransform: "uppercase",
      }}
    >
      {subtitle}
    </div>
  );

  if (!cover) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(180deg, #060a12 0%, #0a101a 45%, #080c14 100%)",
            padding: 64,
            textAlign: "center",
          }}
        >
          {wordmark}
          {heading}
          {subline}
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          background: "#0a101a",
        }}
      >
        <div
          style={{
            width: 640,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "64px 56px 64px 64px",
          }}
        >
          {wordmark}
          {heading}
          {subline}
          <div
            style={{
              display: "flex",
              marginTop: 48,
              color: FOG,
              fontSize: 22,
              letterSpacing: 2,
            }}
          >
            Question the cast. Search the scene. Accuse when ready.
          </div>
        </div>
        <div
          style={{
            width: 560,
            height: "100%",
            display: "flex",
            position: "relative",
            borderLeft: `2px solid ${GOLD_DIM}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt=""
            width={560}
            height={630}
            style={{ objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background:
                "linear-gradient(90deg, rgba(10,16,26,0.55) 0%, rgba(10,16,26,0) 40%)",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
