from pathlib import Path
import random
import textwrap

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pypdf import PdfReader
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors


ROOT = Path("inputs/legal-demo")
DOCS = ROOT / "documents"
TEXT = ROOT / "text"
DOCS.mkdir(parents=True, exist_ok=True)
TEXT.mkdir(parents=True, exist_ok=True)
random.seed(42)


CLEAR_NOTICE_TEXT = """\
SYNTHETIC FIVE-DAY NOTICE OF PAST DUE RENT

Date: April 10, 2026
Landlord: Morgan Field
Tenant: Jamie Rivera
Premises: 14 Cedar Street, Apartment 3B, Albany, NY 12207
Amount claimed due: $1,250.00
Rental period: March 1, 2026 through March 31, 2026

This notice states that the tenant has five days to pay the past due rent or respond in writing.
If payment is not made, the landlord may start a nonpayment proceeding in housing court.

This synthetic notice is provided only as a sample input for document understanding and grounded drafting.
"""

DEBT_COLLECTION_TEXT = """\
SYNTHETIC DEBT COLLECTION RESPONSE LETTER

Date: April 12, 2026
Consumer: Jamie Rivera
Collector: Northbridge Recovery Services
Reference number: NRS-7781
Amount listed by collector: $842.16

I am requesting more information about the debt described in your notice.
Please provide the name of the original creditor, an itemization of the amount claimed, and copies of documents showing that I am responsible for the debt.
Until you provide verification, please treat this debt as disputed.

This synthetic letter follows the structure of public CFPB sample-letter guidance and contains no real account information.
"""

HANDWRITTEN_NOTE_TEXT = """\
Operator note from intake review:
Tenant Jamie Rivera says rent for March was partially paid by money order on April 2.
Receipt photo is blurry and amount may be $650.00.
Ask reviewer to verify payment proof before stating total unpaid balance.
Tenant also says repair issue was reported on March 18.
"""


def make_pdf(path: Path, title: str, body: str):
    doc = SimpleDocTemplate(str(path), pagesize=letter, rightMargin=48, leftMargin=48, topMargin=52, bottomMargin=52)
    styles = getSampleStyleSheet()
    story = [Paragraph(title, styles["Title"]), Spacer(1, 16)]
    for block in body.strip().split("\n\n"):
        if ":" in block and len(block.splitlines()) > 1:
            rows = []
            for line in block.splitlines():
                if ":" in line:
                    key, value = line.split(":", 1)
                    rows.append([key.strip(), value.strip()])
                else:
                    rows.append(["", line.strip()])
            table = Table(rows, colWidths=[150, 330])
            table.setStyle(TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
                ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(table)
        else:
            story.append(Paragraph(block.replace("\n", "<br/>"), styles["BodyText"]))
        story.append(Spacer(1, 12))
    doc.build(story)


def load_font(size: int, italic: bool = False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Bradley Hand Bold.ttf",
        "/System/Library/Fonts/Supplemental/Comic Sans MS.ttf",
        "/System/Library/Fonts/Supplemental/Arial Italic.ttf" if italic else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def make_noisy_scan(path: Path, text: str):
    img = Image.new("RGB", (1300, 1700), "white")
    draw = ImageDraw.Draw(img)
    font = load_font(34)
    y = 90
    for para in text.strip().split("\n"):
        if not para:
            y += 20
            continue
        for line in textwrap.wrap(para, width=54):
            draw.text((90, y), line, fill=(25, 25, 25), font=font)
            y += 48
    img = img.rotate(-1.6, expand=True, fillcolor=(245, 245, 238))
    img = img.resize((760, 990)).filter(ImageFilter.GaussianBlur(0.85))
    pixels = img.load()
    for _ in range(15000):
        x = random.randrange(img.width)
        y = random.randrange(img.height)
        r, g, b = pixels[x, y]
        delta = random.randrange(-28, 28)
        pixels[x, y] = tuple(max(0, min(255, v + delta)) for v in (r, g, b))
    img.save(path, quality=74)


def make_handwritten_note(path: Path, text: str):
    img = Image.new("RGB", (1100, 1450), (252, 250, 238))
    draw = ImageDraw.Draw(img)
    font = load_font(38, italic=True)
    small = load_font(30, italic=True)
    for y in range(120, 1320, 72):
        draw.line((70, y, 1030, y), fill=(210, 222, 235), width=2)
    draw.text((85, 50), "Intake operator note", fill=(128, 38, 35), font=font)
    y = 140
    for para in text.strip().splitlines():
        for line in textwrap.wrap(para, width=42):
            draw.text((90 + random.randrange(-4, 4), y + random.randrange(-3, 3)), line, fill=(25, 45, 130), font=small)
            y += 64
        y += 14
    img = img.rotate(1.2, expand=True, fillcolor=(240, 238, 224))
    img.save(path, quality=88)


def extract_pdf_text(path: Path):
    try:
        reader = PdfReader(str(path))
        return "\n\n".join((page.extract_text() or "").strip() for page in reader.pages).strip()
    except Exception:
        return ""


make_pdf(DOCS / "clear_notice.pdf", "Synthetic Past Due Rent Notice", CLEAR_NOTICE_TEXT)
make_pdf(DOCS / "debt_collection_letter.pdf", "Synthetic Debt Collection Response Letter", DEBT_COLLECTION_TEXT)
make_noisy_scan(DOCS / "noisy_scan_notice.jpg", CLEAR_NOTICE_TEXT)
make_handwritten_note(DOCS / "handwritten_operator_note.jpg", HANDWRITTEN_NOTE_TEXT)

(TEXT / "clear_notice.txt").write_text(CLEAR_NOTICE_TEXT, encoding="utf-8")
(TEXT / "debt_collection_letter.txt").write_text(DEBT_COLLECTION_TEXT, encoding="utf-8")
(TEXT / "noisy_scan_notice.txt").write_text(CLEAR_NOTICE_TEXT, encoding="utf-8")
(TEXT / "handwritten_operator_note.txt").write_text(HANDWRITTEN_NOTE_TEXT, encoding="utf-8")

summons_text = extract_pdf_text(DOCS / "civil_summons.pdf")
if not summons_text:
    summons_text = """SUMMONS IN A CIVIL ACTION
A lawsuit has been filed against you. Within 21 days after service of this summons you must serve on the plaintiff an answer or motion under Rule 12 of the Federal Rules of Civil Procedure."""
(TEXT / "civil_summons.txt").write_text(summons_text, encoding="utf-8")

print("Generated legal demo input assets in inputs/legal-demo")
