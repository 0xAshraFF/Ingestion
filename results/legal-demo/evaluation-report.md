# Legal Demo Results

Sample: Legal Demo Sample Pack

## Model and Confidence Metrics

| input doc | model used | confidence metric | accuracy proxy | quality band | fallback used |
|---|---:|---:|---:|---:|---:|
| clear_notice.pdf | local_pdf_text_extractor | 87% | 87% | amber | no |
| noisy_scan_notice.jpg | local_ocr_heuristic | 52% | 52% | red | no |
| handwritten_operator_note.jpg | manual_transcript_adapter | 52% | 52% | red | no |
| debt_collection_letter.pdf | local_pdf_text_extractor | 87% | 87% | amber | no |
| civil_summons.pdf | local_pdf_text_extractor | 87% | 87% | amber | no |

## Overall Metrics

- Overall quality band: red
- Average OCR confidence: 73%
- Pages processed: 5
- Citations generated: 8
- Unsupported warnings: 1

## Extracted Fields

- Dates: April 10, 2026, March 1, 2026, March 31, 2026, April 12, 2026
- Amounts: $1,250.00, $650.00, $842.16
- Parties: Landlord: Morgan Field, Tenant: Jamie Rivera
- Addresses: 14 Cedar Street
- Deadlines: DUE RENT, due rent or respond in writing., before stating total unpaid balance.

## Generated Draft

# Case fact summary

Reviewer warning: Quality band is red with average OCR confidence 73%.

## Known facts
1. This notice states that the tenant has five days to pay the past due rent or respond in writing. If payment is not made, the landlord may start a nonpayment proceeding in housin... [clear_notice.pdf p.1]
2. This notice states that the tenant has five days to pay the past due rent or respond in writing. If payment is not made, the landlord may start a nonpayment proceeding in housin... [noisy_scan_notice.jpg p.1]
3. Date: April 10, 2026 Landlord: Morgan Field Tenant: Jamie Rivera Premises: 14 Cedar Street, Apartment 3B, Albany, NY 12207 Amount claimed due: $1,250.00 Rental period: March 1, ... [clear_notice.pdf p.1]
4. Date: April 10, 2026 Landlord: Morgan Field Tenant: Jamie Rivera Premises: 14 Cedar Street, Apartment 3B, Albany, NY 12207 Amount claimed due: $1,250.00 Rental period: March 1, ... [noisy_scan_notice.jpg p.1]
5. Operator note from intake review: Tenant Jamie Rivera says rent for March was partially paid by money order on April 2. Receipt photo is blurry and amount may be $650.00. Ask re... [handwritten_operator_note.jpg p.1]

## Potential issues
- Confirm red or amber OCR pages before using the draft externally.
- Verify every amount, date, party name, and deadline against source evidence.

## Missing information
- Extraction quality is red; reviewer confirmation is required before relying on this draft.

## Source evidence
- clear_notice.pdf page 1: "This notice states that the tenant has five days to pay the past due rent or respond in writing.
If payment is not made, the landlord may start a nonpayment pro"
- noisy_scan_notice.jpg page 1: "This notice states that the tenant has five days to pay the past due rent or respond in writing.
If payment is not made, the landlord may start a nonpayment pro"
- clear_notice.pdf page 1: "Date: April 10, 2026
Landlord: Morgan Field
Tenant: Jamie Rivera
Premises: 14 Cedar Street, Apartment 3B, Albany, NY 12207
Amount claimed due: $1,250.00
Rental "
- noisy_scan_notice.jpg page 1: "Date: April 10, 2026
Landlord: Morgan Field
Tenant: Jamie Rivera
Premises: 14 Cedar Street, Apartment 3B, Albany, NY 12207
Amount claimed due: $1,250.00
Rental "
- handwritten_operator_note.jpg page 1: "Operator note from intake review:
Tenant Jamie Rivera says rent for March was partially paid by money order on April 2.
Receipt photo is blurry and amount may b"
- debt_collection_letter.pdf page 1: "I am requesting more information about the debt described in your notice.
Please provide the name of the original creditor, an itemization of the amount claimed"

Applied reviewer preferences:
- For case fact summaries, list dates, parties, amounts, and uncertainty before drafting conclusions.
