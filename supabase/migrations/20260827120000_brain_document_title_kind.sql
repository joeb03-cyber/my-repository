-- Align the normalized Brain schema with the parser's preserved document-title
-- structure. Document titles remain non-reader structural records.

alter table public.highlights
  drop constraint if exists highlights_content_kind_check;

alter table public.highlights
  add constraint highlights_content_kind_check
  check (content_kind in (
    'highlight', 'document_title', 'chapter_label', 'section_label', 'locator',
    'summary', 'note', 'list_item', 'exercise', 'worksheet_element', 'unknown',
    'possible_personal_summary'
  ));
