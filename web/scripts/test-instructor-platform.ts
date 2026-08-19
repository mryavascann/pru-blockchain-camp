import assert from "node:assert/strict";
import sharp from "sharp";

import {decideApplication} from "../lib/applications/policy";
import {
  normalizeCampSlug,
  renderInstructorContent,
} from "../lib/camps/content";
import {inspectRasterImage} from "../lib/camps/media";

assert.deepEqual(decideApplication(1, false), {
  requiresReview: false,
  status: "APPROVED",
  completionWeeks: [1],
});
assert.deepEqual(decideApplication(1, true), {
  requiresReview: true,
  status: "PENDING",
  completionWeeks: [],
});
assert.deepEqual(decideApplication(2, false), {
  requiresReview: true,
  status: "PENDING",
  completionWeeks: [],
});

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

async function testImages() {
  const png = new Uint8Array(
    await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: {r: 0, g: 0, b: 0, alpha: 1},
      },
    })
      .png()
      .toBuffer(),
  );
  assert.equal((await inspectRasterImage(png))?.mimeType, "image/png");
  assert.equal(
    await inspectRasterImage(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    null,
  );
  assert.equal(await inspectRasterImage(new Uint8Array([1, 2, 3])), null);

  console.log("✓ Eğitmen platformu yardımcıları: 12 kontrol geçti.");
}

void testImages().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
