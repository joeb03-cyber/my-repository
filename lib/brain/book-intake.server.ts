import "server-only";

export type CatalogCandidate = { title: string; subtitle: string | null; authors: string[]; isbn10: string | null; isbn13: string | null; publisher: string | null; publishedDate: string | null; language: string | null; providerId: string; providerUrl: string; coverUrl: string | null; score: number };
const normalized = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (value: string) => new Set(normalized(value).split(/\s+/).filter(Boolean));
function overlap(left: string, right: string) { const a = tokens(left), b = tokens(right); if (!a.size || !b.size) return 0; let shared = 0; for (const token of Array.from(a)) if (b.has(token)) shared += 1; return shared / Math.max(a.size, b.size); }
function scoreCandidate(title: string, author: string, candidateTitle: string, candidateAuthors: string[]) { const requested = normalized(title), offered = normalized(candidateTitle), base = normalized(candidateTitle.split(":")[0]); const titleScore = requested === offered || requested === base ? 1 : Math.max(overlap(title, candidateTitle), offered.includes(requested) ? .92 : 0); const authorScore = author ? Math.max(...candidateAuthors.map((name) => overlap(author, name)), 0) : .5; return Number((titleScore * .72 + authorScore * .28).toFixed(4)); }
export function slugifyBook(value: string) { return normalized(value).replace(/\s+/g, "-").slice(0, 80) || "untitled-book"; }
export function normalizePerson(value: string) { return normalized(value); }

export async function findBookMetadata(title: string, author: string): Promise<CatalogCandidate | null> {
  const query = new URLSearchParams({ q: `intitle:${title}${author ? ` inauthor:${author}` : ""}`, maxResults: "8", printType: "books" });
  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${query}`, { signal: AbortSignal.timeout(7000), cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json() as any;
    const candidates: CatalogCandidate[] = (payload.items || []).map((item: any): CatalogCandidate => { const info = item.volumeInfo || {}; const identifiers = new Map<string, string>((info.industryIdentifiers || []).map((identifier: any) => [String(identifier.type), String(identifier.identifier)])); const cover = info.imageLinks?.extraLarge || info.imageLinks?.large || info.imageLinks?.medium || info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null; const authors = Array.isArray(info.authors) ? info.authors.map(String) : []; return { title: String(info.title || "").trim(), subtitle: info.subtitle ? String(info.subtitle).trim() : null, authors, isbn10: identifiers.get("ISBN_10") || null, isbn13: identifiers.get("ISBN_13") || null, publisher: info.publisher ? String(info.publisher) : null, publishedDate: info.publishedDate ? String(info.publishedDate) : null, language: info.language ? String(info.language) : null, providerId: String(item.id), providerUrl: String(info.infoLink || `https://books.google.com/books?id=${item.id}`), coverUrl: cover ? String(cover).replace(/^http:/, "https:").replace(/&zoom=\d/, "&zoom=2") : null, score: scoreCandidate(title, author, String(info.title || ""), authors) }; }).filter((item: CatalogCandidate) => item.title).sort((a: CatalogCandidate, b: CatalogCandidate) => b.score - a.score);
    return candidates[0]?.score >= .76 ? candidates[0] : null;
  } catch { return null; }
}

export async function downloadCover(url: string | null) {
  if (!url) return null;
  try { const response = await fetch(url, { signal: AbortSignal.timeout(7000), redirect: "follow", cache: "no-store" }); const contentType = response.headers.get("content-type") || ""; if (!response.ok || !contentType.startsWith("image/")) return null; const bytes = new Uint8Array(await response.arrayBuffer()); if (!bytes.length || bytes.length > 5_000_000) return null; const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg"; return { bytes, contentType: contentType.split(";")[0], extension }; } catch { return null; }
}
