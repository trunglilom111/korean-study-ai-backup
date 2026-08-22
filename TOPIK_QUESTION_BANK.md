# TOPIK Master Question Bank

## Data contract

The import API accepts batches of 1–500 questions. Every batch must include a source name and a clear license note.

```json
{
  "entityType": "question",
  "sourceName": "Licensed TOPIK collection",
  "sourceUrl": "https://example.com/source",
  "licenseNote": "Permission received from the rights holder on YYYY-MM-DD.",
  "items": []
}
```

Each item accepts either camelCase or snake_case. `section` is stored internally as `skill`; `question_text` is stored as `prompt`. `correct_answer` can be a zero-based option index or the exact option text.

```json
{
  "question_id": "licensed-topik-i-reading-001",
  "exam_type": "TOPIK I",
  "section": "reading",
  "question_number": 1,
  "question_type": "main-idea",
  "difficulty": 2,
  "question_text": "중심 생각을 고르십시오.",
  "passage": "...",
  "options": ["...", "...", "...", "..."],
  "correct_answer": 1,
  "audio_url": null,
  "transcript": null,
  "explanation_vi": "...",
  "explanation_ko": "...",
  "vocabulary": ["어휘"],
  "grammar": ["-기 위해서"],
  "tags": ["reading", "main-idea"],
  "exam_year": 2026,
  "exam_round": "practice-01",
  "source_kind": "licensed",
  "rights_status": "licensed",
  "metadata": {}
}
```

## Rights and provenance

- `original`: written for TOPIK Master. It must be labelled as exam-style content, not an official past paper.
- `licensed`: the source owner has granted permission to store and use the content. Keep the proof outside the public repository and record a clear license note.
- `public-link-only`: the material may be linked to but not copied. The import validator rejects full question imports with this status.
- `permission-required`: do not publish until permission is confirmed.

Official practice links can be kept as external resources, but their question text, images and audio must not be copied into the database unless the relevant item explicitly permits reuse.

## Publishing flow

1. Stage a JSON batch.
2. Validate required fields, answer bounds, tags, source and rights status.
3. Review the staged items as the TOPIK Master owner.
4. Commit to `draft`.
5. Verify formatting, audio, explanations and source evidence.
6. Change approved questions to `published`.

Vocabulary and grammar references are resolved against the existing catalogs during commit. Missing references are returned in `links.unresolvedVocabulary` and `links.unresolvedGrammar`; they do not silently create duplicate catalog entries.
