/** Angular, interlocking ribbon monogram based on the founders' MW sketch. */
export default function BrandLogo() {
  return (
    <>
      <svg
        className="brand-mark"
        viewBox="0 0 316 104"
        fill="none"
        aria-hidden="true"
      >
        <path d="M8 92 48 14H73L94 43 112 14H137L188 92H157L124 43 105 71H83L59 42 34 92Z" />
        <path d="M137 14H164L202 76 219 56H237L251 75 282 10H308L268 92H242L229 77 215 92H190Z" />
        <path d="m48 14 25 39 21-10M112 14l12 29M282 10l-16 35" />
      </svg>
      <span className="brand-name">
        STUDIO
        <br />
        <strong>MW</strong>
      </span>
    </>
  );
}

/** Preserve existing catalog identifiers while presenting the new brand everywhere. */
export function brandName(value: string) {
  return value === "WM STUDIO" ? "STUDIO MW" : value;
}

export function brandText(value: string) {
  return value
    .replace(/WM Studio Collective/gi, "Studio MW")
    .replace(/WM STUDIO/g, "STUDIO MW");
}
