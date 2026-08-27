import type { BrainBookSummary, BrainBooksIndex } from "./types";

/** Public editorial decisions. Imported titles and source provenance remain unchanged. */
export const hiddenPublicBookSlugs = new Set(["100m-offers", "1929"]);

export const bookDisplayTitleOverrides: Record<string, string> = {
  "awakening-intuition": "Awakening Intuition",
  "being-aware-of-being-aware": "Being Aware of Being Aware",
  "breaking-the-habit-of-being-yourself": "Breaking the Habit of Being Yourself",
  "collected-essays-of-joel-goldsmith": "Collected Essays of Joel Goldsmith",
  "eye-of-the-i": "Eye of the I",
  "going-to-pieces-without-falling-apart": "Going to Pieces Without Falling Apart",
  "head-strong": "Head Strong",
  "i-am-the-word": "I Am the Word",
  "infinite-self": "Infinite Self",
  "kundalini-evolution-and-enlightenment": "Kundalini, Evolution and Enlightenment",
  "life-force": "Life Force",
  "light-radiation-and-you": "Light, Radiation, and You",
  "matrix-reimprinting-using-eft": "Matrix Reimprinting Using EFT",
  "no-boundary": "No Boundary",
  "orthodoxy-and-the-religion-of-the-future": "Orthodoxy and the Religion of the Future",
  "owning-your-own-shadow": "Owning Your Own Shadow",
  "real-magic": "Real Magic",
  "the-art-of-pilgrimage": "The Art of Pilgrimage",
  "the-book-of-love-and-creation": "The Book of Love and Creation",
  "the-dynamic-laws-of-prayer": "The Dynamic Laws of Prayer",
  "the-dynamic-laws-of-prosperity": "The Dynamic Laws of Prosperity",
  "the-emotionally-absent-mother": "The Emotionally Absent Mother",
  "the-end-of-your-world": "The End of Your World",
  "the-infinite-way": "The Infinite Way",
  "the-mystical-i": "The Mystical I",
  "the-power-of-eight": "The Power of Eight",
  "the-secret-language-of-your-body": "The Secret Language of Your Body",
  "the-tao-of-fully-feeling": "The Tao of Fully Feeling",
  "the-three-domains-of-freedom": "The Three Domains of Freedom",
  "the-thunder-of-silence": "The Thunder of Silence",
  "the-way-of-the-superior-man": "The Way of the Superior Man",
  "there-s-a-spiritual-solution-to-every-problem": "There's a Spiritual Solution to Every Problem",
  "this-is-marketing": "This Is Marketing",
  "timeless-secrets-of-health-and-rejuvenation": "Timeless Secrets of Health and Rejuvenation",
  "to-have-or-to-be": "To Have or to Be?",
  "tuning-the-human-biofield": "Tuning the Human Biofield",
  "way-of-the-peaceful-warrior": "Way of the Peaceful Warrior",
  "you-can-heal-your-life": "You Can Heal Your Life",
};

export function bookAlphabeticalKey(title: string) {
  return title.replace(/^(?:the|an|a)\s+/i, "").trim();
}

export function refineBookSummary(book: BrainBookSummary): BrainBookSummary {
  return { ...book, title: bookDisplayTitleOverrides[book.slug] || book.title };
}

export function refineBooksIndex(index: BrainBooksIndex): BrainBooksIndex {
  const books = index.books
    .filter((book) => !hiddenPublicBookSlugs.has(book.slug))
    .map(refineBookSummary)
    .sort((a, b) => bookAlphabeticalKey(a.title).localeCompare(bookAlphabeticalKey(b.title), "en", { sensitivity: "base", numeric: true }));
  return { ...index, bookCount: books.length, books };
}
