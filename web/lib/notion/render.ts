/**
 * ============================================================================
 * Notion blokları → HTML
 *
 * NEDEN KENDİ RENDERER'IMIZI YAZIYORUZ (notion-to-md gibi bir paket yerine):
 *
 *   1. GÜVENLİK — Ürettiğimiz HTML sayfaya `dangerouslySetInnerHTML` ile
 *      basılacak. Hangi etiketlerin çıkabileceğini TAM OLARAK bilmemiz gerek.
 *      Üçüncü parti bir dönüştürücünün çıktısı zamanla değişebilir.
 *
 *   2. VİDEO GÖMME — YouTube linklerini güvenli, izleme yapmayan
 *      (youtube-nocookie) iframe'e çeviriyoruz. Genel amaçlı paketler
 *      bunu ya hiç yapmaz ya da ham iframe basar.
 *
 *   3. MARKA — Çıktı `docs/brand.md`'deki sınıf adlarını kullanır, böylece
 *      Faz 3'te stil vermek tek CSS dosyasıyla mümkün olur.
 *
 * TÜM METİN KAÇIŞ (escape) EDİLİR. İçeriği kulüp yöneticisi yazıyor, yani
 * kaynak güvenilir; yine de kaçış yapmak doğru olan. Notion'a yapıştırılan
 * bir metnin içinde HTML olması, sayfayı bozmamalı.
 * ============================================================================
 */
import type {BlockWithChildren} from "./parse";
import {blockData, blockRichText, type NotionRichText} from "./client";

/* -------------------------------------------------------------------------- */
/*                              YARDIMCILAR                                   */
/* -------------------------------------------------------------------------- */

/** HTML özel karakterlerini kaçırır */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Bir URL'nin gömülmesi güvenli mi?
 * Yalnızca http(s) kabul edilir — `javascript:` ve `data:` şemaları XSS yolu.
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** YouTube video kimliğini çıkarır (çeşitli URL biçimlerinden) */
function youtubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/")[2] || null;
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/")[2] || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Zengin metni (rich text) HTML'e çevirir.
 * Kalın, italik, üstü çizili, satır içi kod ve bağlantı desteklenir.
 */
function renderRichText(items: NotionRichText[]): string {
  return items
    .map((item) => {
      let html = escapeHtml(item.plain_text ?? "");
      const a = item.annotations ?? {};

      if (a.code) html = `<code class="nx-code-inline">${html}</code>`;
      if (a.bold) html = `<strong>${html}</strong>`;
      if (a.italic) html = `<em>${html}</em>`;
      if (a.strikethrough) html = `<s>${html}</s>`;
      if (a.underline) html = `<u>${html}</u>`;

      if (item.href && isSafeUrl(item.href)) {
        // rel="noopener noreferrer" — yeni sekmede açılan bağlantıların
        // kaynak sayfaya erişmesini engeller (tabnabbing koruması)
        html =
          `<a href="${escapeHtml(item.href)}" class="nx-link" ` +
          `target="_blank" rel="noopener noreferrer">${html}</a>`;
      }

      return html;
    })
    .join("");
}

/** Bir bloğun metnini HTML olarak döner */
function inline(block: BlockWithChildren): string {
  return renderRichText(blockRichText(block));
}

/* -------------------------------------------------------------------------- */
/*                            BLOK DÖNÜŞTÜRÜCÜLER                             */
/* -------------------------------------------------------------------------- */

/** Bir video/embed URL'sini gömülebilir HTML'e çevirir */
function renderMedia(url: string, caption: string): string {
  if (!isSafeUrl(url)) return "";

  const videoId = youtubeId(url);

  if (videoId) {
    // youtube-nocookie: kullanıcı videoyu oynatmadan çerez yazılmaz
    return (
      `<figure class="nx-video">` +
      `<div class="nx-video-frame">` +
      `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(videoId)}" ` +
      `title="${escapeHtml(caption || "Video")}" ` +
      `loading="lazy" allowfullscreen ` +
      `allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture" ` +
      `referrerpolicy="strict-origin-when-cross-origin"></iframe>` +
      `</div>` +
      (caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "") +
      `</figure>`
    );
  }

  // YouTube değilse gömme yapmıyoruz — bilinmeyen bir siteyi iframe'e almak
  // hem güvenlik hem gizlilik riski. Bunun yerine bağlantı kartı gösteriyoruz.
  const label = caption || url;
  return (
    `<a class="nx-bookmark" href="${escapeHtml(url)}" ` +
    `target="_blank" rel="noopener noreferrer">` +
    `<span class="nx-bookmark-title">${escapeHtml(label)}</span>` +
    `<span class="nx-bookmark-url">${escapeHtml(new URL(url).hostname)}</span>` +
    `</a>`
  );
}

/** Bir bloğun URL'sini çıkarır (external / file / url alanlarından) */
function extractUrl(block: BlockWithChildren): string {
  const data = blockData(block) as {
    url?: string;
    external?: {url?: string};
    file?: {url?: string};
  };
  return data.external?.url ?? data.file?.url ?? data.url ?? "";
}

/** Bir bloğun altyazısını çıkarır */
function extractCaption(block: BlockWithChildren): string {
  const data = blockData(block) as {caption?: NotionRichText[]};
  return Array.isArray(data.caption)
    ? data.caption.map((c) => c.plain_text ?? "").join("")
    : "";
}

/**
 * Tek bir bloğu HTML'e çevirir.
 * Liste öğeleri burada sarmalanmaz — gruplama `renderBlocks` içinde yapılır.
 */
function renderBlock(block: BlockWithChildren): string {
  const children = block.children ?? [];
  const childHtml = children.length > 0 ? renderBlocks(children) : "";

  switch (block.type) {
    case "paragraph": {
      const text = inline(block);
      if (!text.trim() && !childHtml) return "";
      return `<p class="nx-p">${text}</p>${childHtml}`;
    }

    case "heading_1":
      return `<h2 class="nx-h2">${inline(block)}</h2>${childHtml}`;

    case "heading_2":
      return `<h3 class="nx-h3">${inline(block)}</h3>${childHtml}`;

    case "heading_3":
      return `<h4 class="nx-h4">${inline(block)}</h4>${childHtml}`;

    case "bulleted_list_item":
    case "numbered_list_item":
      return `<li class="nx-li">${inline(block)}${childHtml}</li>`;

    case "to_do": {
      const data = blockData(block) as {checked?: boolean};
      const checked = data.checked ? " checked" : "";
      // Görev listeleri kullanıcı tarafından işaretlenemez (salt okunur içerik);
      // `disabled` bunu açık hâle getirir.
      return (
        `<li class="nx-todo${data.checked ? " nx-todo-done" : ""}">` +
        `<input type="checkbox"${checked} disabled aria-hidden="true" />` +
        `<span>${inline(block)}</span>${childHtml}</li>`
      );
    }

    case "toggle":
      // Notion'daki açılır blok → HTML'in yerleşik <details> öğesi.
      // JavaScript gerektirmez, klavyeyle erişilebilir, ekran okuyucu dostu.
      return (
        `<details class="nx-toggle">` +
        `<summary>${inline(block)}</summary>` +
        `<div class="nx-toggle-body">${childHtml}</div>` +
        `</details>`
      );

    case "quote":
      return `<blockquote class="nx-quote">${inline(block)}${childHtml}</blockquote>`;

    case "callout": {
      const data = blockData(block) as {icon?: {emoji?: string}};
      const emoji = data.icon?.emoji ?? "";
      return (
        `<aside class="nx-callout">` +
        (emoji
          ? `<span class="nx-callout-icon" aria-hidden="true">${escapeHtml(emoji)}</span>`
          : "") +
        `<div class="nx-callout-body">${inline(block)}${childHtml}</div>` +
        `</aside>`
      );
    }

    case "code": {
      const data = blockData(block) as {language?: string};
      const lang = escapeHtml(data.language ?? "text");
      const code = escapeHtml(
        blockRichText(block)
          .map((t) => t.plain_text ?? "")
          .join(""),
      );
      return (
        `<pre class="nx-pre" data-language="${lang}">` +
        `<code>${code}</code></pre>`
      );
    }

    case "divider":
      return `<hr class="nx-hr" />`;

    case "image": {
      const url = extractUrl(block);
      if (!isSafeUrl(url)) return "";
      const caption = extractCaption(block);
      return (
        `<figure class="nx-figure">` +
        `<img src="${escapeHtml(url)}" alt="${escapeHtml(caption)}" loading="lazy" />` +
        (caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "") +
        `</figure>`
      );
    }

    case "video":
    case "embed":
    case "bookmark":
    case "link_preview":
      return renderMedia(extractUrl(block), extractCaption(block));

    case "table":
    case "table_row":
      // Tablolar bu kampların içeriğinde kullanılmıyor. Gerekirse eklenecek.
      return childHtml;

    case "column_list":
      return `<div class="nx-columns">${childHtml}</div>`;

    case "column":
      return `<div class="nx-column">${childHtml}</div>`;

    case "child_page":
    case "child_database":
      // Alt sayfalar bu haftanın içeriği değil — atlanır.
      return "";

    default:
      // Desteklenmeyen blok tipi: metni varsa paragraf olarak göster,
      // yoksa sessizce atla. İçeriğin kaybolmaması, biçimin bozulmasından
      // daha önemli.
      {
        const text = inline(block);
        return text.trim() ? `<p class="nx-p">${text}</p>${childHtml}` : childHtml;
      }
  }
}

/**
 * Blok dizisini HTML'e çevirir.
 *
 * Ardışık liste öğelerini tek bir `<ul>` / `<ol>` içinde gruplar — aksi hâlde
 * her madde ayrı bir listeye girer ve tarayıcı aralarına boşluk koyar.
 */
export function renderBlocks(blocks: BlockWithChildren[]): string {
  const output: string[] = [];

  let listType: "ul" | "ol" | "todo" | null = null;
  let listBuffer: string[] = [];

  function flush(): void {
    if (listBuffer.length === 0) return;

    const tag = listType === "ol" ? "ol" : "ul";
    const className =
      listType === "todo" ? "nx-todo-list" : listType === "ol" ? "nx-ol" : "nx-ul";

    output.push(`<${tag} class="${className}">${listBuffer.join("")}</${tag}>`);
    listBuffer = [];
    listType = null;
  }

  for (const block of blocks) {
    const desired: "ul" | "ol" | "todo" | null =
      block.type === "bulleted_list_item"
        ? "ul"
        : block.type === "numbered_list_item"
          ? "ol"
          : block.type === "to_do"
            ? "todo"
            : null;

    if (desired === null) {
      flush();
      const html = renderBlock(block);
      if (html) output.push(html);
      continue;
    }

    if (listType !== null && listType !== desired) flush();
    listType = desired;
    listBuffer.push(renderBlock(block));
  }

  flush();
  return output.join("\n");
}

/**
 * Bir haftanın içeriğini HTML'e çevirir ve içerik hash'i üretir.
 *
 * `contentHash`, senkron sırasında "bu hafta gerçekten değişti mi?"
 * sorusunun cevabıdır. Değişmemişse veritabanına yazılmaz ve önbellek
 * geçersizleştirilmez — gereksiz iş ve gereksiz sayfa yeniden üretimi olmaz.
 */
export function renderWeekContent(blocks: BlockWithChildren[]): {
  html: string;
  hash: string;
} {
  const html = renderBlocks(blocks);
  return {html, hash: hashString(html)};
}

/**
 * Basit, hızlı ve deterministik dize hash'i (FNV-1a, 32 bit).
 *
 * Kriptografik değil — burada amaç güvenlik değil, "değişti mi?" sorusuna
 * ucuz cevap vermek. Çakışma ihtimali bu kullanım için ihmal edilebilir
 * (aynı hafta içeriğinin farklı iki hâlinin aynı hash'i vermesi gerekirdi).
 */
function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
