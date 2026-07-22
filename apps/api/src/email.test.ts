import { describe, expect, it } from "vitest";
import { escapeHtml, renderEmailLayout, renderEmailText } from "./email.js";
import { magicLinkEmailHtml, magicLinkEmailText } from "./auth.js";

describe("renderEmailLayout", () => {
  const html = renderEmailLayout({
    eyebrow: "A sealed letter arrives",
    title: "A letter arrives for you",
    paragraphs: ["The door stands open."],
    cta: { label: "Step Inside", href: "https://mysterytrove.com/verify?t=1" },
    note: "Nothing will follow you.",
  });

  it("carries the brand markers", () => {
    expect(html).toContain("/brand/logo-email.png");
    expect(html).toContain("background-color:#05080e");
    expect(html).toContain("background-color:#0b1018");
    expect(html).toContain("A sealed letter arrives");
    expect(html).toContain("A letter arrives for you");
    expect(html).toContain("The door stands open.");
    expect(html).toContain('href="https://mysterytrove.com/verify?t=1"');
    expect(html).toContain("Step Inside");
    expect(html).toContain("Nothing will follow you.");
    expect(html).toContain(
      "MysteryTrove.com &middot; mysteries you step inside and solve"
    );
  });

  it("escapes HTML in paragraphs, titles, and CTA attributes", () => {
    const evil = renderEmailLayout({
      eyebrow: "test",
      title: "<script>alert(1)</script>",
      paragraphs: ["<script>alert(2)</script>"],
      cta: { label: "<b>x</b>", href: 'https://example.com/?a="onlick="evil' },
    });
    expect(evil).not.toContain("<script>");
    expect(evil).toContain("&lt;script&gt;");
    expect(evil).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(evil).toContain("&quot;");
    expect(evil).not.toContain('"onlick="evil');
  });

  it("omits the CTA block when no CTA is given", () => {
    const plain = renderEmailLayout({
      eyebrow: "test",
      title: "Hello",
      paragraphs: ["Just a note."],
    });
    expect(plain).toContain("Just a note.");
    expect(plain).not.toContain("linear-gradient");
  });
});

describe("renderEmailText", () => {
  it("includes title, paragraphs, CTA URL, note, and footer", () => {
    const text = renderEmailText({
      title: "A letter arrives for you.",
      paragraphs: ["First paragraph.", "Second paragraph."],
      cta: { label: "Step Inside", href: "https://mysterytrove.com/verify?t=1" },
      note: "Ignore it if it wasn't you.",
    });
    expect(text).toContain("A letter arrives for you.");
    expect(text).toContain("First paragraph.");
    expect(text).toContain("Second paragraph.");
    expect(text).toContain("Step Inside: https://mysterytrove.com/verify?t=1");
    expect(text).toContain("Ignore it if it wasn't you.");
    expect(text).toContain(
      "— MysteryTrove.com · mysteries you step inside and solve"
    );
  });
});

describe("magic-link template", () => {
  const link = "https://mysterytrove.com/signin/verify?token=abc123&next=%2Fgallery";

  it("HTML carries the verify link and the 15-minute copy", () => {
    const html = magicLinkEmailHtml(link);
    expect(html).toContain(`href="${escapeHtml(link)}"`);
    expect(html).toContain("A sealed letter arrives");
    expect(html).toContain("A letter arrives for you");
    expect(html).toContain("Step Inside");
    expect(html).toContain("The link burns away in 15 minutes");
    expect(html).toContain(
      "If you didn't request this, ignore it — nothing will follow you."
    );
  });

  it("text version carries the verify link and the 15-minute copy", () => {
    const text = magicLinkEmailText(link);
    expect(text).toContain(`Step inside: ${link}`);
    expect(text).toContain("the next fifteen minutes");
    expect(text).toContain(
      "If you didn't request this, ignore it — nothing will follow you."
    );
  });
});
