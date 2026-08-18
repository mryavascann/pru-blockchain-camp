import assert from "node:assert/strict";

import {
  normalizeCampSlug,
  renderInstructorContent,
} from "../lib/camps/content";
import {inspectRasterImage} from "../lib/camps/media";

assert.equal(normalizeCampSlug("  Güçlü Web3 Eğitimi  "), "guclu-web3-egitimi");

const html = renderInstructorContent(
  "## Güvenlik\n\n<script>alert(1)</script>\n\n- İmzayı doğrula",
  [
    {title: "Viem <docs>", url: "https://viem.sh/"},
    {title: "Tehlikeli", url: "javascript:alert(1)"},
  ],
);
assert.match(html, /<h2>Güvenlik<\/h2>/);
assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.doesNotMatch(html, /<script>/);
assert.match(html, /href="https:\/\/viem\.sh\/"/);
assert.doesNotMatch(html, /javascript:/);

const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
assert.equal(inspectRasterImage(pngHeader)?.mimeType, "image/png");
assert.equal(inspectRasterImage(new Uint8Array([1, 2, 3])), null);

console.log("✓ Eğitmen platformu yardımcıları: 9 kontrol geçti.");

