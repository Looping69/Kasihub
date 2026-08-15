# Author: Klaasvaakie ( |╲ )
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether, Table, TableStyle

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "kasihub-presale-staging-test-readiness.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#091525")
BLUE = colors.HexColor("#1779D1")
CYAN = colors.HexColor("#39BEE8")
PALE = colors.HexColor("#EAF5FB")
INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#617086")
GREEN = colors.HexColor("#127A55")
RED = colors.HexColor("#A73636")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=27, leading=32, textColor=colors.white, alignment=TA_CENTER, spaceAfter=12))
styles.add(ParagraphStyle(name="CoverSub", parent=styles["Normal"], fontName="Helvetica", fontSize=12, leading=18, textColor=colors.HexColor("#D8E9F6"), alignment=TA_CENTER))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=19, leading=24, textColor=NAVY, spaceBefore=8, spaceAfter=10))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=BLUE, spaceBefore=10, spaceAfter=5))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.4, leading=13.2, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="Bulletx", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.2, leading=12.8, leftIndent=12, firstLineIndent=-7, textColor=INK, spaceAfter=4))
styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.2, leading=11, textColor=MUTED))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=10, leading=14, textColor=NAVY, backColor=PALE, borderColor=CYAN, borderWidth=0.8, borderPadding=9, spaceAfter=10))

def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 13*mm, w, 13*mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 8.5)
    canvas.drawString(18*mm, h - 8.5*mm, "KaSiHub | Presale staging assurance")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18*mm, 10*mm, "Author: Klaasvaakie ( |\\ )")
    canvas.drawRightString(w - 18*mm, 10*mm, f"Page {doc.page}")
    canvas.restoreState()

def bullet(text, number=None):
    prefix = f"<b>{number}.</b>" if number is not None else "<font color='#1779D1'>&#8226;</font>"
    return Paragraph(f"{prefix} {text}", styles["Bulletx"])

story = []

# Cover
cover = Table([[Paragraph("PRESALE STAGING<br/>TEST READINESS", styles["CoverTitle"])],
               [Paragraph("Controlled validation of campaign, USDT settlement, inventory movement and share incorporation", styles["CoverSub"])],
               [Spacer(1, 12*mm)],
               [Paragraph("LEGACY-TIER RELEASE CONTROL", ParagraphStyle(name="Tag", parent=styles["Smallx"], textColor=CYAN, alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=10))]], colWidths=[174*mm], rowHeights=[62*mm, 30*mm, 18*mm, 18*mm])
cover.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),NAVY),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("BOX",(0,0),(-1,-1),1.2,CYAN),("LEFTPADDING",(0,0),(-1,-1),14*mm),("RIGHTPADDING",(0,0),(-1,-1),14*mm)]))
story += [Spacer(1, 25*mm), cover, Spacer(1, 16*mm), Paragraph("Release position", styles["H2x"]), Paragraph("The payment-authority fix is deployed to Encore staging. Production remains untouched. This document defines the evidence required before a limited presale pilot may be considered.", styles["Callout"]), Paragraph("Prepared for staging operators and independent verifiers. A submitted transaction hash is never treated as payment evidence.", styles["Smallx"]), PageBreak()]

story += [Paragraph("1. Purpose and safety boundary", styles["H1x"]), Paragraph("This runbook verifies the private share-presale path in staging without changing production or treating user-submitted information as proof of payment.", styles["Bodyx"]), Paragraph("Non-negotiable controls", styles["H2x"])]
for t in [
    "Use staging accounts, a staging campaign and a staging-only invitation.",
    "Confirm the staging frontend points to the Encore staging backend.",
    "Never use production credentials, campaigns or the production share ledger.",
    "Keep the campaign paused until two operators verify the receiving address, token contract, network and confirmation threshold.",
    "Use only the smallest approved test transfer. A typed or submitted hash is not proof of payment.",
    "Do not incorporate shares until central settlement and the expected allocation have both been independently checked.",
]: story.append(bullet(t))

story += [Paragraph("2. Readiness gates", styles["H1x"]), Paragraph("All gates must be green before funds move.", styles["Callout"])]
gates = [
    "GitHub quality gates pass for the deployed commit.",
    "Encore staging deployment completes and the registration-routing endpoint returns the international USDT policy.",
    "Staging has an active, approved receiving configuration for the selected network.",
    "The test buyer has an authenticated international profile with completed KYC.",
    "The campaign is isolated from production and has a deliberately small test allocation.",
    "Starting totals for total, reserved and sold shares have been recorded.",
    "A rollback owner and a second verifier are present.",
]
for i,t in enumerate(gates,1): story.append(bullet(t,i))
story += [PageBreak()]

story += [Paragraph("3. End-to-end staging test", styles["H1x"])]
steps = [
    "Create a staging-only campaign and invitation while the campaign is paused.",
    "Confirm the public offer does not expose a payment address before reservation.",
    "Activate the staging campaign and reserve a small quantity with the invited test buyer.",
    "Confirm the order receives its address, token, amount, expiry, network and confirmation requirement from the central payment intent.",
    "Submit an invalid or wrong-destination hash first. It must not settle or allocate shares; rejection must release the reservation once.",
    "Create a fresh order and send the smallest approved USDT transfer to the exact locked address on the exact network.",
    "Submit the hash. The order must remain pending until canonical chain evidence reaches the required confirmations.",
    "Confirm one payment obligation and one intent settle, exactly once.",
    "Confirm campaign inventory moves from reserved to sold exactly once, including the configured bonus allocation.",
    "Retry proof submission. Payment, sold inventory and allocation totals must not change again.",
    "Prepare incorporation. Only the settled order may appear; preparation must not issue duplicate shares.",
    "Apply incorporation once, then retry. Confirm one allocation and one certificate reference exist for the presale order.",
]
for i,t in enumerate(steps,1): story.append(bullet(t,i))

story += [Paragraph("4. Failure tests", styles["H1x"])]
for t in [
    "Unknown, malformed, reused, wrong-network, wrong-token, wrong-recipient, reverted, underpaid and low-confirmation transactions must not settle.",
    "A chain-provider outage must leave the payment retryable and must not release or sell shares.",
    "An expired intent must reject new proof without silently changing campaign totals.",
    "Concurrent proof retries must produce one settlement event and one inventory movement.",
    "Interrupted presale fulfilment after settlement must complete safely when retried.",
]: story.append(bullet(t))
story += [PageBreak()]

story += [Paragraph("5  Evidence and exit decision", styles["H1x"]), Paragraph("Evidence to retain", styles["H2x"])]
for t in [
    "Deployed Git commit and GitHub workflow URLs.",
    "Encore staging deployment result and health/policy response.",
    "Campaign, invitation, order, obligation, intent and attempt identifiers.",
    "Transaction hash and canonical explorer evidence for the approved transfer.",
    "Before-and-after reserved, sold, incorporated and certificate totals.",
    "Buyer and administrator screenshots plus console and network results.",
    "Tester, second verifier, date, outcome and all defects.",
]: story.append(bullet(t))

decision_data = [
    [Paragraph("GO", ParagraphStyle(name="Go", parent=styles["H2x"], textColor=GREEN)), Paragraph("Every readiness gate and end-to-end step passes, with retained evidence and independent verification.", styles["Bodyx"])],
    [Paragraph("STOP", ParagraphStyle(name="Stop", parent=styles["H2x"], textColor=RED)), Paragraph("Any mismatch in payment state, inventory, incorporation, authentication or environment routing.", styles["Bodyx"])],
]
decision = Table(decision_data, colWidths=[28*mm, 134*mm])
decision.setStyle(TableStyle([("GRID",(0,0),(-1,-1),0.6,colors.HexColor("#C8D5E3")),("BACKGROUND",(0,0),(-1,-1),colors.white),("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7)]))
story += [Spacer(1,4*mm), decision, Spacer(1,8*mm), Paragraph("Production activation remains a separate, explicit decision. Passing staging is evidence for consideration, not automatic authority to activate production.", styles["Callout"]), Paragraph("Deployment position at publication: Encore staging is active and healthy. The Vercel preview artifact is not claimed ready until Vercel reports READY and browser verification is completed.", styles["Smallx"])]

doc = SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=20*mm, bottomMargin=18*mm, title="KaSiHub Presale Staging Test Readiness", author="Klaasvaakie ( |\\ )")
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUT)
