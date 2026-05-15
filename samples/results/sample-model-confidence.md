# Sample Results

## Legal Demo Model Metrics

| sample doc | model used | confidence metric | accuracy proxy | quality band | fallback used |
|---|---:|---:|---:|---:|---:|
| clear_notice.pdf | local_pdf_text_extractor | 87% | 87% | amber | no |
| noisy_scan_notice.jpg | local_ocr_heuristic | 52% | 52% | red | no |
| handwritten_operator_note.jpg | manual_transcript_adapter | 52% | 52% | red | no |
| debt_collection_letter.pdf | local_pdf_text_extractor | 87% | 87% | amber | no |
| civil_summons.pdf | local_pdf_text_extractor | 87% | 87% | amber | no |

## Handwritten Notes Summary

- Overall quality band: red
- Average OCR confidence: 74%
- Pages processed: 5
- Citations generated: 8
- Unsupported warnings: 1
