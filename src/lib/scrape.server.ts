export type ScrapedProduct = {
  name: string | null;
  price: number | null;
  image: string | null;
  category: string | null;
  outOfStock: boolean;
};

/** Palavras-chave por categoria (usadas para sugerir a categoria do item). */
const CATEGORY_KEYWORDS: Record<string, RegExp> = {
  Beleza: /(perfum|maquiag|makeup|batom|lipstick|serum|sérum|creme facial|skincare|shampoo|acondicionador|conditioner|cabelo|haar|hair|kerastase|nail|esmalte|mascara|máscara facial|fragranc|eau de|colonia|colônia|beleza|beauty|cosmet)/i,
  "Cuidado Pessoal": /(desodor|deodor|gel de banho|sabonete|higiene|escova de dente|dental|toothpaste|barb|shav|minoxidil|farmac|pharma|vitamin|suplement|creme corporal|absorvente|papel higi)/i,
  "Casa/Limpeza": /(limpeza|detergente|desinfet|amaciante|lava|vassoura|papel toalha|casa|home|decor|cozinha|kitchen|toalha|almofada|movel|móvel|furniture|caja|caixa|organiz|maison|relojes|watch box|watch case|jardim|garden|cama|lençol|lampada|lâmpada|vela)/i,
  Alimentação: /(alimento|comida|food|café|cafe|chá|arroz|feijão|leite|snack|chocolate|bebida|drink|azeite|cerveja|vinho|wine|supermerc|grocer)/i,
  Eletrônicos:
    /(eletr[oô]nic|electronic|fone de ouvido|headphone|earbud|smartphone|celular|iphone|notebook|laptop|tablet|monitor|teclado|keyboard|mouse|carregador|charger|cabo usb|smartwatch|tv |televis|c[aâ]mera|camera|console|playstation|xbox|nintendo|impressora|printer|ssd|pendrive)/i,
};

/** Sugere uma categoria a partir do texto do produto (nome, breadcrumbs, URL). */
function suggestCategory(text: string): string | null {
  const haystack = text.toLowerCase();
  for (const [category, pattern] of Object.entries(CATEGORY_KEYWORDS)) {
    if (pattern.test(haystack)) return category;
  }
  return null;
}


function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function matchMeta(html: string, keys: string[]) {
  for (const key of keys) {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*content=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${key}["']`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const found = html.match(pattern);
      if (found?.[1]) return decodeEntities(found[1]);
    }
  }
  return null;
}

function parsePrice(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  // Last separator decides the decimal mark (handles 1.299,90 and 1,299.90).
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned.replace(/,/g, ".");
  }
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function fromJsonLd(html: string): Partial<ScrapedProduct> {
  const blocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (!blocks) return {};
  for (const block of blocks) {
    const json = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      continue;
    }
    const candidates: Record<string, unknown>[] = [];
    const push = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(push);
        return;
      }
      const record = node as Record<string, unknown>;
      candidates.push(record);
      if (record["@graph"]) push(record["@graph"]);
    };
    push(parsed);

    const product = candidates.find((c) => {
      const type = c["@type"];
      const types = Array.isArray(type) ? type : [type];
      return types.some((t) => typeof t === "string" && t.toLowerCase() === "product");
    });
    if (!product) continue;

    const offersRaw = product["offers"];
    const offer = (Array.isArray(offersRaw) ? offersRaw[0] : offersRaw) as
      | Record<string, unknown>
      | undefined;
    const priceRaw = offer?.["price"] ?? offer?.["lowPrice"] ?? product["price"];
    const imageRaw = product["image"];
    const image = Array.isArray(imageRaw) ? imageRaw[0] : imageRaw;

    return {
      name: typeof product["name"] === "string" ? product["name"] : null,
      price: parsePrice(priceRaw == null ? null : String(priceRaw)),
      image: typeof image === "string" ? image : null,
    };
  }
  return {};
}

function microdata(html: string, prop: string) {
  // <span itemprop="price" content="26.46"> or <span itemprop="price">26,46 €</span>
  const withContent = html.match(
    new RegExp(`itemprop=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i"),
  );
  if (withContent?.[1]) return decodeEntities(withContent[1]);
  const withSrc = html.match(
    new RegExp(`itemprop=["']${prop}["'][^>]*src=["']([^"']+)["']`, "i"),
  );
  if (withSrc?.[1]) return decodeEntities(withSrc[1]);
  const srcFirst = html.match(
    new RegExp(`src=["']([^"']+)["'][^>]*itemprop=["']${prop}["']`, "i"),
  );
  if (srcFirst?.[1]) return decodeEntities(srcFirst[1]);
  const withText = html.match(
    new RegExp(`itemprop=["']${prop}["'][^>]*>\\s*([^<\\s][^<]{0,199})<`, "i"),
  );
  const text = withText?.[1] ? decodeEntities(withText[1]) : "";
  if (text) return text;
  return null;
}

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "pt-BR,pt;q=0.9,es;q=0.8,en;q=0.7,de;q=0.6",
  "cache-control": "no-cache",
  "upgrade-insecure-requests": "1",
};

function parseHtml(html: string, target: URL): ScrapedProduct {
  const jsonLd = fromJsonLd(html);

  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const name =
    jsonLd.name ??
    matchMeta(html, ["og:title", "twitter:title", "product:title"]) ??
    microdata(html, "name") ??
    (titleTag ? decodeEntities(titleTag) : null);

  const price =
    jsonLd.price ??
    parsePrice(
      matchMeta(html, [
        "product:price:amount",
        "og:price:amount",
        "twitter:data1",
        "price",
        "product:price",
      ]),
    ) ??
    parsePrice(microdata(html, "price")) ??
    parsePrice(microdata(html, "lowPrice"));

  const imageRaw =
    jsonLd.image ??
    matchMeta(html, ["og:image:secure_url", "og:image", "twitter:image"]) ??
    microdata(html, "image") ??
    html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1] ??
    null;
  let image: string | null = null;
  if (imageRaw) {
    try {
      image = new URL(imageRaw, target).toString();
    } catch {
      image = null;
    }
  }

  const breadcrumbs = (
    html.match(/itemprop=["']breadcrumb["'][\s\S]{0,1200}/i)?.[0] ??
    matchMeta(html, ["product:category", "article:section"]) ??
    ""
  ).replace(/<[^>]+>/g, " ");
  const category = suggestCategory(`${name ?? ""} ${breadcrumbs} ${target.pathname}`);


  const outOfStock =
    /(currently unavailable|out of stock|no disponible|indisponível|esgotado|nicht verfügbar|no featured offers)/i.test(
      html,
    );

  return { name: name ? name.slice(0, 140) : null, price, image, category, outOfStock };
}

function isLikelyProductImage(src: string) {
  const lower = src.toLowerCase();
  if (!/\.(jpe?g|png|webp|avif)(\?|$)/.test(lower)) return false;
  return !/logo|brand|icon|sprite|placeholder|badge|flag|payment|banner|avatar|pixel|grey-pixel|nav-sprite/.test(
    lower,
  );
}


/**
 * Plano B para sites protegidos (Cloudflare, Akamai) que respondem 403 ao
 * nosso pedido direto: lemos a versão em texto/markdown da página.
 */
async function scrapeViaReader(target: URL): Promise<ScrapedProduct> {
  const response = await fetch(
    `https://r.jina.ai/${target.toString()}`,
    { headers: { accept: "text/plain", "x-no-cache": "true" }, redirect: "follow" },
  );
  if (!response.ok) throw new Error("Não foi possível acessar a página");
  const md = (await response.text()).slice(0, 400_000);

  const rawTitle = md.match(/^Title:\s*(.+)$/m)?.[1] ?? null;
  let name = rawTitle
    ? decodeEntities(rawTitle)
        .replace(/[✅✔️★]/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
    : null;
  if (name) {
    // "Produto bei flaconi" / "Produto | Loja" / "Produto - Loja" / "Produto : Amazon.es: Fashion"
    name = name
      .replace(/\s*:\s*Amazon\.[a-z.]+.*$/i, "")
      .split(/\s+[|–—]\s+|\s+\|\s+/)[0]!
      .trim();
  }

  let price: number | null = null;
  for (const line of md.split(/\r?\n/).slice(0, 400)) {
    const clean = line.trim().replace(/\*+/g, "").trim();
    if (!clean || clean.length > 20) continue;
    if (/(ab|from|desde|frete|versand|spar|gutschein)/i.test(clean)) continue;
    if (!/^(?:R\$|US\$|\$|€|£)?\s*\d[\d.,]*\s*(?:€|\$|R\$|£|EUR|USD|BRL)?$/i.test(clean))
      continue;
    const parsed = parsePrice(clean);
    if (parsed) {
      price = parsed;
      break;
    }
  }

  // Preço rotulado ("Price: 24,99 €" / "Precio: €24,99").
  if (!price) {
    const labeled = md.match(
      /(?:price|precio|preço|preco|preis|prix)[^\n\d€$£]{0,20}((?:R\$|US\$|\$|€|£)?\s?\d[\d.,]*\s?(?:€|\$|R\$|£|EUR|USD|BRL)?)/i,
    )?.[1];
    price = parsePrice(labeled ?? null);
  }

  // Último recurso (Amazon e marketplaces): "1 option from €18.99" na área do produto.
  if (!price) {
    const offer = md
      .slice(0, 25_000)
      .match(
        /(?:option|options|offer|offers|oferta|ofertas|opci[oó]n|opciones)\s+(?:from|desde|de)\s+((?:R\$|US\$|\$|€|£)?\s?\d[\d.,]*)/i,
      )?.[1];
    price = parsePrice(offer ?? null);
  }


  let image: string | null = null;
  const images = [...md.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)].map(
    (m) => m[1]!,
  );
  const preferred =
    images.find(
      (src) => isLikelyProductImage(src) && /m\.media-amazon\.com\/images\/I\//i.test(src),
    ) ??
    images.find((src) => isLikelyProductImage(src) && /product|catalog/i.test(src)) ??
    images.find(isLikelyProductImage) ??
    null;
  if (preferred) {
    try {
      image = new URL(preferred, target).toString();
    } catch {
      image = null;
    }
  }

  const category = suggestCategory(`${name ?? ""} ${target.pathname}`);

  const outOfStock =
    /(currently unavailable|out of stock|no disponible|indisponível|esgotado|nicht verfügbar|no featured offers)/i.test(
      md,
    );

  return { name: name ? name.slice(0, 140) : null, price, image, category, outOfStock };
}


const TRACKING_PARAMS =
  /^(utm_|gclid|fbclid|msclkid|mc_cid|mc_eid|_ga|ref|referrer|source|igshid|srsltid|gad_|wt_|cmp|campaign)/i;

/** Remove parâmetros de rastreio (ex.: ?utm_source=chatgpt.com) mantendo os úteis. */
function cleanUrl(input: URL): URL {
  const cleaned = new URL(input.toString());
  for (const key of [...cleaned.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) cleaned.searchParams.delete(key);
  }
  cleaned.hash = "";
  return cleaned;
}

/** Último recurso: deduz o nome do produto pelo slug da URL. */
function nameFromSlug(target: URL): string | null {
  const segments = target.pathname.split("/").filter(Boolean);
  let slug = segments.pop() ?? "";
  slug = slug.replace(/\.(html?|htm|php|aspx)$/i, "");
  if (/^(p|product|producto|produto|item|dp)$/i.test(slug) && segments.length) {
    slug = segments.pop()!;
  }
  const words = slug
    .replace(/[_+]/g, "-")
    .split("-")
    .filter(
      (part) =>
        (part.length > 1 || /^\d$/.test(part)) &&
        !/^\d{4,}$/.test(part) &&
        !/^[a-z]?\d{4,}$/i.test(part) &&
        !/^(id|ref|sku|pid)$/i.test(part),
    );
  if (words.length < 2) return null;
  const text = words.join(" ").toLowerCase();
  return (text.charAt(0).toUpperCase() + text.slice(1)).slice(0, 140);
}

export async function scrapeProduct(url: string): Promise<ScrapedProduct> {
  const raw = new URL(url);
  if (raw.protocol !== "http:" && raw.protocol !== "https:") {
    throw new Error("URL inválida");
  }
  const target = cleanUrl(raw);

  let direct: ScrapedProduct | null = null;
  try {
    const response = await fetch(target.toString(), {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });
    if (response.ok) {
      const html = (await response.text()).slice(0, 800_000);
      // Páginas de bloqueio/captcha (Amazon, Cloudflare) são curtas e sem dados úteis.
      const blocked =
        html.length < 15_000 ||
        /(captcha|Enter the characters you see|Robot Check|verifica que eres|just a moment)/i.test(
          html.slice(0, 20_000),
        );
      if (!blocked) direct = parseHtml(html, target);
    }
  } catch {
    direct = null;
  }


  let result: ScrapedProduct =
    direct ?? { name: null, price: null, image: null, category: null, outOfStock: false };

  // Bloqueado, ou veio incompleto (sem preço ou sem imagem): tenta o leitor.
  if (!result.price || !result.image || !result.name) {
    try {
      const fallback = await scrapeViaReader(target);
      result = {
        name: result.name ?? fallback.name,
        price: result.price ?? fallback.price,
        image: result.image ?? fallback.image,
        category: result.category ?? fallback.category,
        outOfStock: result.outOfStock || fallback.outOfStock,
      };
    } catch {
      // segue com o que já temos
    }
  }

  // Sites com proteção anti-bot forte: pelo menos preenche o nome pelo link.
  const looksLikeDomain =
    !!result.name && result.name.toLowerCase().replace(/\s/g, "") === target.hostname.replace(/^www\./, "");
  if (!result.name || looksLikeDomain) {
    result = { ...result, name: nameFromSlug(target) ?? result.name };
  }

  if (!result.category) {
    result = {
      ...result,
      category: suggestCategory(`${result.name ?? ""} ${target.pathname}`),
    };
  }

  if (!result.name && !result.price && !result.image) {
    throw new Error("Não foi possível acessar a página");
  }


  return result;
}


