import type { BrainBookSummary } from "@/lib/brain/types";

export function BookCover({ book, compact = false }: { book: Pick<BrainBookSummary, "title" | "authors" | "cover">; compact?: boolean }) {
  const realCover = book.cover.status === "cached";
  return <div className={`book-cover brain-book-cover ${realCover ? "has-real-cover" : "is-placeholder"} ${compact ? "book-cover--compact" : ""}`}>
    <img src={book.cover.public_path} alt="" loading="lazy" />
    {!realCover && <div className="book-cover__fallback"><span className="book-cover__sigil" /><span className="book-cover__title">{book.title}</span><span className="book-cover__author">{book.authors.join(", ")}</span></div>}
  </div>;
}
