# Author: Klaasvaakie ( |\ )
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from pathlib import Path

ROOT = Path(r"C:\Users\wimpi\Documents\GitHub\Kasihub")
OUT = ROOT / "output" / "pdf" / "kasishares-executive-readiness-brief.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

INK = HexColor("#11211D")
GREEN = HexColor("#087A50")
LIME = HexColor("#B9E769")
AMBER = HexColor("#F2A83B")
RED = HexColor("#C94C4C")
MIST = HexColor("#F2F6F4")
SLATE = HexColor("#5D6B66")
WHITE = colors.white

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", fontName="Helvetica-Bold", fontSize=28, leading=32, textColor=WHITE, spaceAfter=10))
styles.add(ParagraphStyle(name="CoverSub", fontName="Helvetica", fontSize=13, leading=19, textColor=HexColor("#D8E7DF")))
styles.add(ParagraphStyle(name="H1X", fontName="Helvetica-Bold", fontSize=20, leading=25, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle(name="H2X", fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=INK, spaceAfter=5))
styles.add(ParagraphStyle(name="BodyX", fontName="Helvetica", fontSize=9.6, leading=14, textColor=INK))
styles.add(ParagraphStyle(name="SmallX", fontName="Helvetica", fontSize=8.2, leading=11, textColor=SLATE))
styles.add(ParagraphStyle(name="Metric", fontName="Helvetica-Bold", fontSize=24, leading=27, textColor=GREEN, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="MetricLabel", fontName="Helvetica-Bold", fontSize=8.5, leading=10, textColor=SLATE, alignment=TA_CENTER))

def p(text, style="BodyX"):
    return Paragraph(text, styles[style])

def header_footer(canv, doc):
    canv.saveState()
    canv.setFillColor(INK)
    canv.rect(0, A4[1]-12*mm, A4[0], 12*mm, fill=1, stroke=0)
    canv.setFillColor(WHITE)
    canv.setFont("Helvetica-Bold", 8)
    canv.drawString(18*mm, A4[1]-8*mm, "KaSiHub | KasiShares readiness")
    canv.setFillColor(SLATE)
    canv.setFont("Helvetica", 7.5)
    canv.drawString(18*mm, 10*mm, "Executive brief | Internal decision support | 12 August 2026")
    canv.drawRightString(A4[0]-18*mm, 10*mm, f"Page {doc.page}")
    canv.restoreState()

def status_chip(label, color):
    return Table([[p(label, "SmallX")]], colWidths=[28*mm], rowHeights=[8*mm], style=TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), color), ("TEXTCOLOR", (0,0), (-1,-1), WHITE),
        ("ALIGN", (0,0), (-1,-1), "CENTER"), ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("FONTNAME", (0,0), (-1,-1), "Helvetica-Bold"), ("BOX", (0,0), (-1,-1), 0, color),
    ]))

def bullet(text):
    return p(f'<font color="#087A50">&#8226;</font> &nbsp;{text}')

story = []

# Cover
cover = [
    Spacer(1, 30*mm),
    p("KasiShares", "CoverTitle"),
    p("Executive readiness brief", "CoverTitle"),
    Spacer(1, 6*mm),
    p("Where the international USDT share-purchase system stands, what must still be proven, and the shortest safe path to an invited pilot.", "CoverSub"),
    Spacer(1, 24*mm),
]
cover_metrics = Table([
    [p("50-60%", "Metric"), p("3", "Metric"), p("0", "Metric")],
    [p("Engineering foundation in place", "MetricLabel"), p("Critical bridges before money moves", "MetricLabel"), p("Live campaigns or invitations", "MetricLabel")],
], colWidths=[55*mm]*3, rowHeights=[16*mm, 14*mm])
cover_metrics.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), HexColor("#E7F0EB")), ("BOX", (0,0), (-1,-1), 0.5, HexColor("#D4E0D9")), ("INNERGRID", (0,0), (-1,-1), 0.5, HexColor("#D4E0D9")), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5)]))
cover.append(cover_metrics)
cover.append(Spacer(1, 14*mm))
cover.append(p("Executive position", "H2X"))
cover.append(p("KaSiHub has much of the right foundation: controlled payment intent creation, BSC/TRON transaction evidence readers, invitation-only campaign mechanics, administrator controls, and a Phase 1 BOGO model. The system is not ready to accept real share-purchase funds because verified payment evidence is not yet connected to a single, idempotent share-settlement and certificate-issuance flow."))
cover_table = Table([[cover]], colWidths=[174*mm])
cover_table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), INK), ("LEFTPADDING", (0,0), (-1,-1), 18*mm), ("RIGHTPADDING", (0,0), (-1,-1), 18*mm), ("TOPPADDING", (0,0), (-1,-1), 0), ("BOTTOMPADDING", (0,0), (-1,-1), 22*mm)]))
story.append(cover_table)
story.append(PageBreak())

# Page 2
story += [p("Current state: the engine exists; the gearbox is missing", "H1X"), p("The work is not a wholesale rebuild. It is a controlled integration of existing payment, KYC and share components."), Spacer(1, 5*mm)]
rows = [
    [p('<font color="#FFFFFF">Workstream</font>', "H2X"), p('<font color="#FFFFFF">Evidence</font>', "H2X"), p('<font color="#FFFFFF">Readiness</font>', "H2X")],
    [p("International KYC"), p("KaSiHub international KYC policy and approval gate exist; ClickUp marks the work in progress."), status_chip("In progress", AMBER)],
    [p("USDT payment foundation"), p("Server-controlled wallets, intent expiry, idempotency, transaction-hash replay protection and payment state history are present."), status_chip("Foundation built", GREEN)],
    [p("BSC/TRON verification"), p("Chain adapters parse transaction evidence, exact token transfer logs and confirmations. Live RPC configuration and controlled proof remain."), status_chip("In progress", AMBER)],
    [p("Private campaign flow"), p("Admin campaigns, invitation links and payment-instruction isolation exist. No live campaign or invitation is active."), status_chip("Prototype ready", GREEN)],
    [p("Share settlement"), p("The current presale payment path is separate from the general payment-intent machinery; verified evidence is not yet the sole trigger for certificate issuance."), status_chip("Not connected", RED)],
    [p("Phase 1 BOGO"), p("Existing business rule is confirmed: BOGO applies only to Phase 1. Paid-versus-issued share accounting still needs to be joined to settlement."), status_chip("Design gap", RED)],
]
t = Table(rows, colWidths=[33*mm, 103*mm, 33*mm], repeatRows=1)
t.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), INK), ("TEXTCOLOR", (0,0), (-1,0), WHITE), ("GRID", (0,0), (-1,-1), 0.35, HexColor("#D8E2DC")), ("VALIGN", (0,0), (-1,-1), "TOP"), ("BACKGROUND", (0,1), (-1,-1), WHITE), ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, MIST]), ("LEFTPADDING", (0,0), (-1,-1), 4*mm), ("RIGHTPADDING", (0,0), (-1,-1), 4*mm), ("TOPPADDING", (0,0), (-1,-1), 3*mm), ("BOTTOMPADDING", (0,0), (-1,-1), 3*mm)]))
story.append(t)
story += [Spacer(1, 7*mm), p("Why the split matters", "H2X"), p("A provider receiving USDT is not the same thing as approving a share sale. Remitano may receive inbound funds on approved wallets, but KaSiHub must independently verify the on-chain transfer and record the settlement exactly once.")]
story.append(PageBreak())

# Page 3 flow
story += [p("The three critical bridges", "H1X"), p("These are the remaining controls that stop a payment screen from becoming an uncontrolled sale."), Spacer(1, 6*mm)]
flow = [
    [p("1", "Metric"), p("Eligibility gate", "H2X"), p("International buyer is KYC-verified before an order or payment intent can proceed. The current general payment intent gate exists; the presale path still needs to use it.")],
    [p("2", "Metric"), p("Evidence to settlement", "H2X"), p("A submitted transaction hash is checked on the selected chain for exact USDT contract, receiver, amount, execution status and confirmations. Only that result may settle the order.")],
    [p("3", "Metric"), p("Settlement to shares", "H2X"), p("One idempotent transaction records settlement, applies Phase 1 BOGO correctly, decrements inventory, creates the certificate and leaves an audit trail. Retries must not create extra shares.")],
]
ft = Table(flow, colWidths=[20*mm, 42*mm, 107*mm])
ft.setStyle(TableStyle([("GRID", (0,0), (-1,-1), 0.5, HexColor("#D6E5DC")), ("BACKGROUND", (0,0), (0,-1), HexColor("#E7F3EB")), ("BACKGROUND", (1,0), (-1,-1), WHITE), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("LEFTPADDING", (0,0), (-1,-1), 5*mm), ("RIGHTPADDING", (0,0), (-1,-1), 5*mm), ("TOPPADDING", (0,0), (-1,-1), 6*mm), ("BOTTOMPADDING", (0,0), (-1,-1), 6*mm)]))
story.append(ft)
story += [Spacer(1, 10*mm), p("Target operating flow", "H2X")]
process = Table([[p("Verified international member", "SmallX"), p("Private invitation", "SmallX"), p("Remitano receiving wallet", "SmallX"), p("On-chain verification", "SmallX"), p("KaSiHub settlement + certificate", "SmallX")]], colWidths=[33.5*mm]*5, rowHeights=[17*mm])
process.setStyle(TableStyle([("BACKGROUND", (0,0), (0,0), HexColor("#E8F4EB")), ("BACKGROUND", (1,0), (1,0), HexColor("#EEF4F7")), ("BACKGROUND", (2,0), (2,0), HexColor("#FFF1D8")), ("BACKGROUND", (3,0), (3,0), HexColor("#E8F4EB")), ("BACKGROUND", (4,0), (4,0), HexColor("#D8EEE1")), ("GRID", (0,0), (-1,-1), 0.5, HexColor("#CBDBD1")), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("ALIGN", (0,0), (-1,-1), "CENTER"), ("LEFTPADDING", (0,0), (-1,-1), 3*mm), ("RIGHTPADDING", (0,0), (-1,-1), 3*mm), ("TOPPADDING", (0,0), (-1,-1), 4*mm), ("BOTTOMPADDING", (0,0), (-1,-1), 4*mm)]))
story.append(process)
story += [Spacer(1, 8*mm), p("Important boundary", "H2X"), p("Remitano is allowed to be the inbound receiver. It is not the authority that determines whether shares are issued. The authoritative fact remains: KaSiHub has independently verified and settled the exact on-chain payment.")]
story.append(PageBreak())

# Page 4
story += [p("Recommended path to an invited pilot", "H1X"), p("The sequence below prevents a public launch from becoming the test environment."), Spacer(1, 5*mm)]
steps = [
    [p('<font color="#FFFFFF">Now</font>', "H2X"), p("Lock commercial inputs", "H2X"), p("Approve Phase 1 price currency/USDT conversion policy, issued-share BOGO rule, exact approved USDT contracts, receiving wallets, confirmation thresholds, order expiry and high-value review threshold.")],
    [p('<font color="#FFFFFF">Build</font>', "H2X"), p("Connect the three bridges", "H2X"), p("Use international KYC gate in the presale route; make the chain verifier settle the share order; implement atomic BOGO certificate issuance and compensation for failures.")],
    [p('<font color="#FFFFFF">Prove</font>', "H2X"), p("Run controlled transfers", "H2X"), p("Configure production-grade RPC access and conduct low-value TRON and BSC transfers. Verify normal, delayed-confirmation, wrong-token, wrong-wallet, underpayment and duplicate-hash cases.")],
    [p('<font color="#FFFFFF">Pilot</font>', "H2X"), p("Invite a very small cohort", "H2X"), p("Use caps, manual reconciliation, explicit operator approvals and daily monitoring. Expand only after certificates, ledger, reports and support playbook agree.")],
]
st = Table(steps, colWidths=[26*mm, 45*mm, 98*mm])
st.setStyle(TableStyle([("GRID", (0,0), (-1,-1), 0.4, HexColor("#D8E2DC")), ("BACKGROUND", (0,0), (0,-1), INK), ("TEXTCOLOR", (0,0), (0,-1), WHITE), ("ROWBACKGROUNDS", (1,0), (-1,-1), [WHITE, MIST]), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 4*mm), ("RIGHTPADDING", (0,0), (-1,-1), 4*mm), ("TOPPADDING", (0,0), (-1,-1), 4*mm), ("BOTTOMPADDING", (0,0), (-1,-1), 4*mm)]))
story.append(st)
story += [Spacer(1, 8*mm), p("Executive decisions required before money moves", "H2X")]
for x in [
    "Approve whether the Phase 1 price remains USD-denominated with a server-controlled USDT quote, or becomes a fixed USDT price.",
    "Approve the BOGO contract: one paid share creates two issued shares, and define what inventory quantity that consumes.",
    "Approve exact BSC and TRON USDT contracts, receiving wallets, confirmation thresholds and the pilot cap.",
    "Approve the pilot owner, reconciliation cadence and stop conditions.",
]: story.append(bullet(x))
story += [Spacer(1, 8*mm), p("Source basis", "H2X"), p("Repository architecture and implementation review, plus KaSiHub Integrations ClickUp tasks covering payment foundation, international KYC, blockchain attestation, settlement, KasiShares integration and Remitano scope. Status is an engineering readiness view, not legal, financial or regulatory advice.", "SmallX")]

doc = SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=22*mm, bottomMargin=18*mm)
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUT)
