from __future__ import annotations

from pathlib import Path
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether, HRFlowable,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "kasihub-shares-page-and-journey-api-map.pdf"
REVISION = "89ac2cbe024e45cd63cf7d85f521ac8ce785b4a3+working-tree"
BRANCH = "Klaasvaakie/crypto-certificate-safe-release"

NAVY = colors.HexColor("#07182B")
BLUE = colors.HexColor("#123B68")
GOLD = colors.HexColor("#D9A72E")
PALE_GOLD = colors.HexColor("#FFF7DE")
PALE_BLUE = colors.HexColor("#EAF2FA")
INK = colors.HexColor("#182536")
MUTED = colors.HexColor("#5D6B7B")
GREEN = colors.HexColor("#177451")
RED = colors.HexColor("#9F2E34")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverKicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=GOLD, alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=27, leading=31, textColor=colors.white, alignment=TA_CENTER, spaceAfter=14))
styles.add(ParagraphStyle(name="CoverSub", parent=styles["Normal"], fontSize=12, leading=18, textColor=colors.HexColor("#D6E2EF"), alignment=TA_CENTER, spaceAfter=20))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=BLUE, spaceBefore=4, spaceAfter=10, keepWithNext=True))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=BLUE, spaceBefore=9, spaceAfter=6, keepWithNext=True))
styles.add(ParagraphStyle(name="H3x", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=INK, spaceBefore=7, spaceAfter=4, keepWithNext=True))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontSize=9.1, leading=13, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontSize=7.2, leading=9.5, textColor=INK))
styles.add(ParagraphStyle(name="Tiny", parent=styles["BodyText"], fontSize=6.5, leading=8.2, textColor=INK))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontSize=9, leading=13, textColor=INK, backColor=PALE_GOLD, borderColor=GOLD, borderWidth=.7, borderPadding=8, spaceBefore=5, spaceAfter=8))
styles.add(ParagraphStyle(name="Risk", parent=styles["BodyText"], fontSize=8.5, leading=12, textColor=RED, backColor=colors.HexColor("#FCEEEF"), borderColor=colors.HexColor("#DDA9AC"), borderWidth=.6, borderPadding=7, spaceAfter=6))
styles.add(ParagraphStyle(name="Flow", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=7.6, leading=10, alignment=TA_CENTER, textColor=INK))


def P(text: str, style="Bodyx"):
    return Paragraph(text, styles[style])


def table(headers, rows, widths, font=7.2, repeat=1):
    data = [[P(str(x), "Smallx") for x in headers]] + [[P(str(x), "Smallx" if font >= 7 else "Tiny") for x in row] for row in rows]
    t = Table(data, colWidths=widths, repeatRows=repeat, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), .35, colors.HexColor("#B9C6D3")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F8FB")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def flow(items):
    cells = []
    widths = []
    for i, item in enumerate(items):
        cells.append(P(item, "Flow")); widths.append(30*mm)
        if i < len(items)-1:
            cells.append(P("TO", "Flow")); widths.append(7*mm)
    t = Table([cells], colWidths=widths, hAlign="CENTER")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), PALE_BLUE), ("BOX", (0,0), (-1,0), .7, colors.HexColor("#93ABC1")),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("BACKGROUND", (1,0), (1,0), colors.white), ("BACKGROUND", (3,0), (3,0), colors.white),
        ("BACKGROUND", (5,0), (5,0), colors.white), ("BACKGROUND", (7,0), (7,0), colors.white),
    ]))
    return t


def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.restoreState()


def normal_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D5DEE7"))
    canvas.line(16*mm, A4[1]-11*mm, A4[0]-16*mm, A4[1]-11*mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(16*mm, A4[1]-8.5*mm, "KaSiHUB Shares Journey - source map")
    canvas.drawRightString(A4[0]-16*mm, 8*mm, f"Revision {REVISION[:7]} | Page {doc.page}")
    canvas.restoreState()


story = []
story += [Spacer(1, 55*mm), P("CONTROLLED ENGINEERING ANALYSIS", "CoverKicker"),
          P("KaSiHub Shares Page<br/>and Complete Journey", "CoverTitle"),
          P("Frontend surfaces, API-by-API gateway map, backend orchestration, data authority, payment settlement, incorporation, certificate generation and failure paths", "CoverSub"),
          Spacer(1, 10*mm), table(["Control", "Value"], [
              ("Repository revision", REVISION), ("Branch", BRANCH), ("Analysis date", str(date.today())),
              ("Evidence basis", "Static source/migration inspection plus a local production-build browser test of member login, controlled API failure, visible retry and multi-phase recovery. No deployed runtime or provider state was asserted."),
          ], [42*mm, 110*mm]), PageBreak()]

story += [P("1. Executive conclusion", "H1x"),
          P("There is no single shares journey. The repository contains three user-facing paths that converge only after controlled backend processing:"),
          table(["Surface", "User", "Primary route", "Authority"], [
              ("Member portfolio", "Existing ecosystem member", "Dashboard <b>SharesView</b>", "Encore shares ledger through the normal ecosystem session"),
              ("Applicant/shareholder portal", "Presale applicant or issued shareholder", "<b>/shares/account</b>", "Presale-scoped session plus order/application/KYC state and read-through to shares ledger"),
              ("Private acquisition", "Invited applicant", "<b>/presale</b> or <b>/presale/[invite]</b>", "Invitation, application, KYC, reservation, payment evidence and incorporation workflows"),
          ], [34*mm, 34*mm, 40*mm, 62*mm]),
          P("The correct end-to-end chain is:", "H2x"),
          flow(["Private invite", "Applicant + KYC", "Reservation", "Verified settlement", "Controlled incorporation"]),
          Spacer(1, 4*mm),
          P("Only incorporation writes the authoritative share purchase and certificate records. A reservation, submitted transaction hash, card-return page, provider process update, confirmed presale order, or generated PDF is not independently proof that shares were issued.", "Callout"),
          P("Key findings and remediation status", "H2x"),
          table(["Status", "Finding / change", "Impact"], [
              ("Fixed", "Member <b>/api/shares</b> now preserves each certificate's linked phase, paid/bonus allocation, issue price and authoritative purchase amount.", "Multi-phase holdings no longer inherit the first/default phase."),
              ("Fixed", "<b>SharesView</b> now stores bounded errors, ends loading on 4xx/5xx, and exposes a Retry portfolio control.", "An upstream failure is visible and recoverable instead of becoming a permanent spinner."),
              ("Improved", "Phase totals and sold shares now come from authoritative inventory metadata. Unconnected Aureus and payout projections are hidden instead of shown as zeros.", "The page distinguishes known ledger facts from unavailable data."),
              ("Medium", "Legacy browser-print certificate functions remain beside authoritative PDF downloads.", "Two certificate experiences exist; the approved sealed-template path should remain the trusted artifact."),
              ("Structural", "Certificate numbering is strongest for presale incorporation (<b>SOL-P&lt;phase&gt;-&lt;sequence&gt;</b>); admin reissue and direct-wallet legacy generators remain separate.", "Repository-wide numbering uniformity is not yet proven."),
          ], [18*mm, 92*mm, 60*mm]), PageBreak()]

story += [P("2. System and trust-boundary map", "H1x"),
          table(["Layer", "Responsibility", "Trust rule"], [
              ("React/Next pages", "Render applicant, shareholder and member experiences; hold transient form state.", "Browser state is never settlement or issuance authority."),
              ("Next route handlers", "Read HttpOnly cookies, validate basic request shape, proxy bounded errors, generate certificate PDFs.", "Gateway may narrow access; Encore remains business authority."),
              ("Encore identity/auth", "Validate hashed session tokens and enforce <b>ecosystem</b> versus <b>presale</b> scope.", "Wrong scope is denied even if a token is otherwise valid."),
              ("Encore presale", "Invitation, application, reservation, payment evidence, continuation, portal and incorporation orchestration.", "Presale DB is isolated from shares DB until incorporation."),
              ("Encore payments/KYC", "Canonical chain checks, receiving configuration, provider reconciliation, Didit/evidence policy.", "Provider evidence and KYC decisions fail closed."),
              ("Encore shares", "Share phases, purchases, certificates, ranges, integrity snapshots and register queries.", "Authoritative ownership source."),
              ("PostgreSQL + private bucket", "Durable state, constraints, idempotency keys, evidence metadata and document bytes.", "Rows and constraints outrank UI projections."),
          ], [30*mm, 73*mm, 67*mm]),
          P("Session separation", "H2x"),
          table(["Cookie", "Scope", "Created by", "Used by"], [
              ("<b>kasihub_session</b>", "ecosystem", "Normal login or verified shareholder conversion", "Member dashboard, /api/shares, member certificate route, admin routes"),
              ("<b>kasishares_session</b>", "presale", "Applicant registration or applicant login", "/shares/account, /presale continuation, KYC, reservation, payment recovery, presale certificate route"),
          ], [35*mm, 27*mm, 50*mm, 58*mm]),
          P("Both cookies are HttpOnly, SameSite=Lax, path=/, secure in production, and normally seven-day sessions. The backend stores token hashes and checks session_scope through shared access guards.", "Bodyx"),
          P("Principal data stores", "H2x"),
          table(["Store", "Core records", "Critical constraints"], [
              ("presale", "campaigns, invitations, applications/versions/declarations, orders, payments/events, email delivery, incorporation batches", "inventory bounds; active-owner uniqueness; idempotency; unique provider references; legal state checks"),
              ("shares", "phases, purchases, certificates, adjustments, phase sequences, distinctive-number sequence", "non-negative inventory; unique operation/certificate links; non-overlapping allocation discipline; complete integrity snapshot"),
              ("identity", "users, profiles, scoped sessions", "presale/ecosystem scope; revoked and expired sessions excluded"),
              ("kyc + documents bucket", "cases, Didit status, private evidence metadata and bytes", "profile ownership; type/size policy; admin-only review"),
              ("payments", "obligations, intents, attempts, events, receiving configuration, custody evidence", "state machine, dedupe and canonical evidence checks"),
          ], [28*mm, 75*mm, 67*mm]), PageBreak()]

story += [P("3. Journey A - existing member SharesView", "H1x"),
          flow(["Dashboard opens", "GET /api/shares", "GET phases + my shares", "Adapter projects data", "Portfolio renders"]),
          P("Frontend behavior", "H2x"),
          table(["Step", "Component behavior", "Result / caveat"], [
              ("1", "<b>SharesView</b> reads <i>currentMember</i> from the client store.", "A missing profile now produces a bounded session error and Retry control."),
              ("2", "Calls <b>GET /api/shares?memberId=&lt;currentMember.id&gt;</b> with no-store.", "The browser-supplied ID is not trusted by Encore; profile access is rechecked."),
              ("3", "Displays active presale campaign cards from <b>GET /api/presale/campaigns</b>.", "Public summary excludes receiving address/token contract and remains invitation-bound."),
              ("4", "Renders hero metrics, active/retracted certificates, authoritative phase inventory, current value, purchase amount, and links to /presale.", "Unavailable payout/Aureus data is not presented as an authoritative zero."),
              ("5", "Certificate actions either use browser-print legacy HTML or protected PDF download routes, depending on control.", "Approved sealed PDF path has stronger holder/integrity checks."),
          ], [12*mm, 92*mm, 66*mm]),
          P("Member API chain", "H2x"),
          table(["Browser / Next API", "Encore API", "Authentication", "Transformation"], [
              ("GET /api/shares?memberId=...", "GET /shares/phases", "kasihub_session", "Maps authoritative total/available inventory, sold count, price, status and BOGO; tolerates the previous response shape during rolling deployment."),
              ("same request", "GET /shares/me/:profileId", "kasihub_session + requireProfileAccess", "Preserves certificate phase, paid/bonus split, purchase amount and issue price; separates active and revoked records."),
              ("GET /api/presale/campaigns", "GET /presale/campaigns", "Public summary", "Shows name, issuer, class, inventory, price and BOGO; no payment instructions."),
              ("GET /api/shares/certificates/:number", "GET /profiles/me then GET /shares/me/:profileId", "kasihub_session", "Selects only signed-in holder certificate; seals or derives PDF data."),
              ("GET /api/shares/certificates/verify/:verificationId", "GET /shares/certificates/verify/:verificationId", "Public verification", "Returns bounded verified/not-found response with no-store."),
              ("POST /api/shares/buy", "none", "kasihub_session", "Always 409: direct share purchases disabled; redirects policy to private presale."),
          ], [42*mm, 46*mm, 34*mm, 48*mm]),
          P("Failure behavior", "H2x"),
          P("The member gateway now returns a bounded error while preserving authorization status and sends <b>Cache-Control: private, no-store</b>. SharesView renders an explicit failure card, does not estimate holdings while the register is unavailable, and retries the same authenticated request. A local production-build browser run proved: login -> KasiShares -> controlled 503 -> visible error/retry -> recovered two-phase portfolio.", "Callout"), PageBreak()]

story += [P("4. Applicant and shareholder account journey", "H1x"),
          flow(["Open /shares/account", "Applicant login", "Portal aggregate", "Resume/recover", "Certificate/account"]),
          P("Portal state machine", "H2x"),
          table(["State", "Portal presentation", "Allowed action"], [
              ("No session", "Separate KaSiShares login form", "POST /api/presale/auth/login"),
              ("No application", "No application to continue", "Use active private invitation; optional test URL only when configured"),
              ("Editable application", "Step N of 5 and saved completion", "Follow server-produced encrypted resume URL"),
              ("Invitation unavailable", "Private access no longer available", "Contact support; no bypass"),
              ("Reservation in progress", "Order/payment status card", "Recover payment; cancel only eligible unpaid order with acknowledgement"),
              ("Payment submitted/detected", "Crypto recovery panel", "POST payment recheck; transaction hash remains preserved"),
              ("Confirmed / awaiting issuance", "Paid and bonus allocation shown", "Wait for controlled incorporation"),
              ("Issued", "Authoritative holding + certificate", "Download protected PDF; optionally open ecosystem account"),
              ("Incorporated but certificate missing", "Reconciliation required", "Support/admin must reconcile; UI does not fabricate certificate"),
              ("Revoked", "Revoked status", "No active ownership claim from that certificate"),
          ], [41*mm, 72*mm, 57*mm]),
          P("Portal API chain", "H2x"),
          table(["Next API", "Encore API", "Purpose", "Key control"], [
              ("POST /api/presale/auth/login", "POST /presale/auth/login", "Authenticate applicant", "Sets HttpOnly kasishares_session; bounded 401 message"),
              ("POST /api/presale/auth/logout", "POST /presale/auth/logout", "Revoke backend session and clear cookie", "Cookie is cleared even if backend revoke fails"),
              ("GET /api/presale/portal", "GET /presale/applicant/portal", "Aggregate applicant, KYC, order, continuation and shareholder holdings", "requirePresaleSession; server-derived continuation"),
              ("POST .../:ref/cancel", "POST /presale/orders/:ref/cancel", "Cancel unpaid reservation", "Requires session and acknowledgeNoPaymentSent=true"),
              ("POST .../:ref/payment-recheck", "POST /presale/orders/:ref/payment-recheck", "Re-run canonical settlement verification", "Only signed-in applicant's order"),
              ("GET /api/presale/certificates/:number", "GET /presale/applicant/portal", "Generate holder certificate PDF", "Certificate must be inside signed-in portal holdings"),
              ("POST /api/presale/ecosystem-account", "POST /presale/shareholder/ecosystem-account", "Convert verified issued shareholder into normal member account", "Precondition: verified shareholder with issued shares; creates ecosystem session and pending subscription"),
          ], [43*mm, 49*mm, 43*mm, 35*mm]), PageBreak()]

story += [P("5. Journey C - private acquisition application", "H1x"),
          P("Entry and invitation validation", "H2x"),
          table(["Step", "Frontend", "API/backend", "Failure boundary"], [
              ("0", "Open /presale or /presale/[invite]", "Server passes invite token to PresaleClient", "Without valid invite, offer call fails closed; devPreview=1 is local static/read-only only"),
              ("1", "Fetch offer", "GET /api/presale/offer?invite= -> GET /presale/offer", "Invalid, expired, revoked, exhausted, inactive or out-of-window offer is denied"),
              ("2", "If already logged in, fetch portal", "GET /api/presale/portal", "Server state may restore application/order instead of starting over"),
          ], [10*mm, 48*mm, 61*mm, 51*mm]),
          P("Five application phases", "H2x"),
          table(["Phase", "Frontend data and action", "Backend effect"], [
              ("1. Applicant profile", "Identity/contact, applicant type, password and private invitation context", "POST /api/presale/members -> registerPresaleMember creates/reuses presale user/profile, application, presale session and account email delivery"),
              ("2. Investment profile", "Quantity and investor context", "Progress/draft saved against authenticated application; server retains versioned application state"),
              ("3. Funds and banking", "Source of funds, ownership, bank details, optional SWIFT/BIC", "Client validates every control before phase advance; optional blank SWIFT remains valid"),
              ("4. Identity + declarations", "Didit hosted session/iframe; AML, suitability and accuracy declarations", "KYC session and signed decision determine verified status; cannot advance merely from client choice"),
              ("5. Terms + payment choice", "Scroll authoritative 10-page terms; accept acknowledgement; choose Remitano USDT or WebPay card", "POST order validates invitation, applicant ownership, KYC, declarations, terms version, quantity, inventory and idempotency"),
          ], [32*mm, 68*mm, 70*mm]),
          P("Application and KYC API inventory", "H2x"),
          table(["Next API", "Encore calls", "Input/output"], [
              ("POST /api/presale/members", "POST /presale/members", "Profile/application registration; sets presale cookie; 200 reused or 201 created"),
              ("POST /api/presale/progress", "POST /presale/applicant/progress", "phaseCompleted + bounded draft; completion percent returned"),
              ("POST /api/presale/kyc-session", "GET /profiles/me; POST /kyc/international/cases; POST /kyc/international/cases/:id/didit-session", "Returns secure provider URL/session"),
              ("GET /api/presale/kyc-status", "GET /profiles/me; case/status queries", "Returns backend-derived KYC status and verified flag"),
              ("POST /api/presale/kyc-documents", "GET /profiles/me; create case; POST private document bytes", "identity_document PDF/JPEG/PNG or selfie JPEG/PNG; 1 byte-10 MB; duplicate-safe"),
              ("POST /presale/applications", "Encore direct contract", "Create application draft; owner/campaign uniqueness"),
              ("PATCH /presale/applications/:id/phases/:phase", "Encore direct contract", "Versioned phase save with optimistic concurrency and events"),
          ], [50*mm, 67*mm, 53*mm]), PageBreak()]

story += [P("6. Reservation and payment - API by API", "H1x"),
          P("Order creation", "H2x"),
          table(["Control", "Mechanism"], [
              ("Idempotency", "Browser generates an Idempotency-Key; gateway rejects absence; backend stores a hash unique per invitation."),
              ("Identity binding", "kasishares_session identifies profile; buyer email must match; external profile and application are linked."),
              ("Eligibility", "Active campaign/invitation, remaining invitation/campaign inventory, accepted current terms/declarations and approved KYC."),
              ("Pricing", "USDT quote comes from campaign. WebPay uses invitation override, bounded campaign test price, or configured default in that order."),
              ("Atomic reservation", "Campaign reserved_shares and invitation used_shares are incremented with order creation; deadline is persisted."),
              ("Output", "Order reference, payment rail, quote, deadline and restricted payment instructions; access/resume credential returned where applicable."),
          ], [39*mm, 131*mm]),
          P("Payment routes", "H2x"),
          table(["Next API", "Encore API", "Rail", "Authority / outcome"], [
              ("POST /api/presale/orders/:ref/payment-proof", "POST /presale/orders/:ref/payment-proof", "Remitano/USDT", "Saves hash, loads canonical chain evidence, validates network/token/receiver/amount/confirmations and optional custody; status may remain pending/manual/underpaid/rejected/confirmed"),
              ("POST /api/presale/orders/:ref/payment-recheck", "POST /presale/orders/:ref/payment-recheck", "Remitano/USDT", "Re-evaluates saved hash; safe recovery without creating a second reservation"),
              ("POST /presale/webhooks/usdt", "receivePresalePaymentEvent", "USDT event", "HMAC authenticated, deduplicated event; does not trust arbitrary browser proof"),
              ("POST /api/presale/orders/:ref/webpay-checkout", "POST /presale/orders/:ref/webpay-checkout", "WebPay card", "Returns hosted form URL/fields/checksum; card data never enters KaSiHub form"),
              ("POST /api/presale/webpay/notify", "POST /presale/webhooks/webpay", "WebPay settlement", "Raw form parsed; checksum, merchant/order/amount and uniqueness checked; confirmed settlement applied"),
              ("POST /api/presale/webpay/process", "POST /presale/webhooks/webpay-process", "WebPay process", "Signed process-stage status; FAILED/REJECTED/EXPIRED/REVERSED do not allocate shares"),
              ("GET /api/presale/orders/:ref", "GET /presale/orders/:ref", "Both", "Uses X-Presale-Access-Token bearer, never query string; refreshes order status"),
          ], [42*mm, 45*mm, 25*mm, 58*mm]),
          P("Payment state interpretation", "H2x"),
          table(["State", "Meaning", "Shares issued?"], [
              ("awaiting_payment", "Reservation exists; no accepted payment evidence", "No"),
              ("payment_submitted", "Hash/evidence recorded", "No"),
              ("payment_detected", "Transfer found but confirmation/reconciliation incomplete", "No"),
              ("confirmed", "Canonical/provider settlement requirements satisfied", "Not yet - eligible for incorporation"),
              ("incorporated", "Presale order linked to authoritative shares transaction", "Yes, if certificate/purchase transaction committed"),
              ("expired/cancelled", "Inventory released under controlled rules", "No"),
          ], [35*mm, 95*mm, 40*mm]), PageBreak()]

story += [P("7. Incorporation into the authoritative register", "H1x"),
          flow(["Confirmed orders", "Prepare batch", "Hash manifest", "Apply batch", "Reconcile result"]),
          P("Admin and internal API chain", "H2x"),
          table(["API", "Action", "Control"], [
              ("GET /api/admin/presale/orders -> GET /admin/presale/orders", "Review campaign orders and incorporation status", "Normal admin ecosystem session + requireAdminAccess"),
              ("POST /api/admin/presale/incorporation-batches -> POST /admin/presale/incorporation-batches", "Select confirmed, unincorporated orders; create deterministic manifest and hash", "Admin only; prepared batch evidence persisted"),
              ("POST /api/admin/presale/incorporation-batches/:id/apply", "Apply each order to shares domain", "Admin only; batch and order idempotency; partial interruption is recoverable"),
              ("POST /internal/presale/reconcile-incorporation", "Retry confirmed pending orders", "Internal-only scheduled recovery"),
              ("POST /internal/presale/expire-orders", "Expire unpaid deadlines and release inventory", "Internal-only transactional maintenance"),
              ("POST /internal/presale/retry-crypto-payments", "Retry saved pending crypto evidence", "Internal-only; preserves evidence and classification"),
          ], [62*mm, 68*mm, 40*mm]),
          P("Shares transaction", "H2x"),
          table(["Write", "Authoritative fields / invariant"], [
              ("share_purchases", "profile, phase, paid quantity, amount, operation id, certificate id, presale order reference; unique operation and exact linkage"),
              ("share_certificates", "SOL-P&lt;phase&gt;-&lt;sequence&gt;, total shares, paid/bonus split, distinctive range, presale order reference, status and issue time"),
              ("share_lot_sequence", "Allocates one contiguous, non-overlapping distinctive range; upper design bound 1,200,000"),
              ("share_certificate_phase_sequences", "Transactional phase-local certificate sequence"),
              ("integrity snapshot", "verification id, holder/profile/address snapshots, issue price, canonical payload and SHA-256; all-or-none DB constraint"),
              ("presale order", "incorporation_status becomes incorporated only after authoritative write; retry counts already-incorporated orders"),
          ], [44*mm, 126*mm]),
          P("Failure model", "H2x"),
          P("If an order is marked incorporated but no matching certificate can be read, the portal emits <b>issuance_error</b> and calls for reconciliation. It does not invent a certificate. Batch retry distinguishes already-incorporated work, allowing recovery after a process dies between the shares and presale commits.", "Callout"), PageBreak()]

story += [P("8. Certificate lifecycle and verification", "H1x"),
          table(["Stage", "Backend / route", "Integrity behavior"], [
              ("Issue", "Presale incorporation writes share purchase + certificate", "Sealed holder/allocation/price/range payload and SHA-256 stored with unique verification ID"),
              ("Read in member view", "GET /shares/me/:profileId", "requireProfileAccess; returns holder's ledger records"),
              ("Download as member", "GET /api/shares/certificates/:number", "Gets /profiles/me then holder certificates; refuses missing/other certificate"),
              ("Download as applicant", "GET /api/presale/certificates/:number", "Certificate must exist in signed-in portal holdings"),
              ("Generate", "generateShareCertificatePdf", "Validates allocation sum, range length, issue price pair, integrity pair and issue date; uses approved Solidus template"),
              ("Verify", "GET /shares/certificates/verify/:verificationId", "Recalculates payload hash and compares ledger snapshot fields; public bounded verification route"),
              ("Revoke", "POST /admin/shares/certificates/:number/revoke", "Admin-only status transition"),
              ("Reissue", "POST /admin/shares/certificates/reissue", "Admin-only legacy path; numbering differs from SOL presale protocol"),
          ], [29*mm, 68*mm, 73*mm]),
          P("PDF generation safeguards", "H2x"),
          table(["Validation", "Rejected condition"], [
              ("Identity", "Blank certificate number or holder name"),
              ("Quantity", "Non-positive total; paid/bonus mismatch"),
              ("Distinctive range", "Only one endpoint present, reversed/non-positive range, or range length != total shares"),
              ("Issue price", "Only price/currency present or negative/non-finite value"),
              ("Integrity", "Only verification/hash present or hash not 64 lowercase hex"),
              ("Sealed ledger", "Missing snapshot member, SHA mismatch, payload/ledger mismatch, holder mismatch or issue-price mismatch"),
              ("HTTP response", "Private no-store attachment, sanitized filename and nosniff"),
          ], [47*mm, 123*mm]),
          P("Legacy certificate distinction", "H2x"),
          P("SharesView still contains client-side HTML print functions for KasiShare and Aureus certificates. These use current member/display values and are not the same as the approved template, sealed ledger snapshot and verification route. They should be treated as presentation legacy, not equivalent legal/ledger evidence.", "Risk"), PageBreak()]

public_apis = [
    ("GET", "/api/shares", "/shares/phases + /shares/me/:profileId", "ecosystem", "Member portfolio projection"),
    ("POST", "/api/shares/buy", "none", "ecosystem", "409 direct purchase disabled"),
    ("GET", "/api/shares/certificates/:number", "/profiles/me + /shares/me/:profileId", "ecosystem", "Protected PDF"),
    ("GET", "/api/shares/certificates/verify/:id", "/shares/certificates/verify/:id", "public", "Integrity verification"),
    ("GET", "/api/presale/campaigns", "/presale/campaigns", "public", "Safe campaign summary"),
    ("GET", "/api/presale/offer", "/presale/offer", "invite", "Private offer"),
    ("POST", "/api/presale/members", "/presale/members", "invite", "Applicant/profile creation"),
    ("POST", "/api/presale/auth/login", "/presale/auth/login", "credentials", "Applicant login"),
    ("POST", "/api/presale/auth/logout", "/presale/auth/logout", "presale", "Session termination"),
    ("GET", "/api/presale/portal", "/presale/applicant/portal", "presale", "Aggregate portal"),
    ("POST", "/api/presale/progress", "/presale/applicant/progress", "presale", "Draft progress"),
    ("POST", "/api/presale/kyc-session", "profiles + KYC case + Didit session", "presale", "Start/resume KYC"),
    ("GET", "/api/presale/kyc-status", "profiles + KYC status", "presale", "Poll verification"),
    ("POST", "/api/presale/kyc-documents", "profiles + KYC case/documents", "presale", "Private evidence upload"),
    ("POST", "/api/presale/orders", "/presale/orders", "presale + idempotency", "Create reservation"),
    ("GET", "/api/presale/orders/:ref", "/presale/orders/:ref", "access token", "Refresh order"),
    ("POST", "/api/presale/orders/:ref/payment-proof", "same Encore path", "presale", "Submit crypto hash"),
    ("POST", "/api/presale/orders/:ref/payment-recheck", "same Encore path", "presale", "Retry crypto verification"),
    ("POST", "/api/presale/orders/:ref/webpay-checkout", "same Encore path", "access token", "Hosted card checkout"),
    ("POST", "/api/presale/orders/:ref/cancel", "same Encore path", "presale", "Cancel eligible unpaid order"),
    ("POST", "/api/presale/webpay/notify", "/presale/webhooks/webpay", "provider checksum", "Card settlement webhook"),
    ("POST", "/api/presale/webpay/process", "/presale/webhooks/webpay-process", "provider checksum", "Hosted-process status"),
    ("GET", "/api/presale/certificates/:number", "/presale/applicant/portal", "presale", "Applicant PDF"),
    ("POST", "/api/presale/ecosystem-account", "/presale/shareholder/ecosystem-account", "presale", "Open normal member account"),
]
story += [P("9. Consolidated browser-to-backend API register", "H1x"),
          P("This register lists the complete API surface directly traversed by the three shares journeys. Admin and internal routes are listed separately in section 7.", "Bodyx"),
          table(["Method", "Next route", "Encore target", "Access", "Purpose"], public_apis, [14*mm, 47*mm, 50*mm, 27*mm, 32*mm], font=6.5), PageBreak()]

story += [P("10. State, failure and recovery matrix", "H1x"),
          table(["Failure", "User-visible behavior", "Durable evidence", "Recovery"], [
              ("Invalid invite", "Private invitation required/unavailable", "Invitation/campaign state", "Admin issues or restores valid invite; no client bypass"),
              ("Account email delayed", "Reservation/profile remains saved; warning shown", "presale_email_deliveries failed/pending", "Internal retry email job"),
              ("KYC pending/provider unavailable", "Phase 4 blocks advance; retry/check controls", "KYC case, provider session/events", "Resume Didit or controlled review"),
              ("Malformed optional SWIFT", "Native validation returns user to field", "No invalid reservation written", "Correct or clear optional value"),
              ("Duplicate submit", "Same reservation returned/controlled conflict", "idempotency key hash", "Reuse existing order"),
              ("Crypto verifier unavailable", "Hash preserved; pending message", "payment/order evidence and reason", "Manual recheck + scheduled retry"),
              ("Underpaid/wrong token/receiver/network", "Manual/rejected status", "canonical evidence and classification", "Controlled support/reconciliation; no issue"),
              ("WebPay return before signed notify", "Confirming payment message", "process state/order", "Wait for signed settlement notification"),
              ("WebPay failed/reversed", "Explicit failed status; no allocation", "provider process status/event", "New controlled payment attempt/reservation policy"),
              ("Incorporation interruption", "May remain awaiting/reconciliation", "batch manifest, order incorporation status, shares operation id", "Idempotent apply/reconcile"),
              ("Certificate integrity mismatch", "Generation/verification fails", "sealed payload/hash + ledger fields", "Admin investigation; never regenerate from untrusted browser state"),
              ("Member shares upstream 4xx/5xx", "Bounded portfolio-unavailable message and Retry", "Bounded gateway response plus server logs; no invented holdings", "Retry the authenticated request; browser recovery verified"),
          ], [38*mm, 47*mm, 45*mm, 40*mm]), PageBreak()]

story += [P("11. Corrective action ledger", "H1x"),
          table(["Status", "Action", "Acceptance evidence"], [
              ("Done", "Repair SharesView load state: capture response body/status, render bounded error and Retry; handle missing currentMember explicitly.", "Route/UI contracts plus local production browser 503/retry/recovery proof"),
              ("Done", "Replace /api/shares default-phase projection with certificate/order-linked phase, paid/bonus split, purchase amount and issue price from authoritative response.", "Multi-phase fixture proves phase 1 + phase 2 certificate values"),
              ("Open", "Remove or clearly demote legacy client-side certificate print buttons; route trusted downloads through sealed PDF endpoints.", "No UI implies browser HTML equals authoritative certificate"),
              ("Open", "Unify certificate numbering/reissue protocol across presale, admin and any wallet-purchase paths.", "One documented numbering authority and migration/revocation strategy"),
              ("Partial", "Expose sold/reserved/outstanding metrics from authoritative aggregates instead of hardcoded zero/default projections.", "Sold/outstanding are now derived from phase inventory; reservation aggregation remains separate"),
              ("Open", "Add an end-to-end no-money test spanning invite -> applicant -> KYC-approved fixture -> reservation -> signed provider fixture -> incorporation -> both portals -> certificate verification.", "One auditable scenario with order, purchase, certificate and verification IDs"),
          ], [18*mm, 96*mm, 56*mm]),
          P("Release gate", "H2x"),
          P("Do not declare the shares journey operational from a frontend build, a Vercel Ready badge, an Encore check, a payment success screen, or a generated certificate alone. Prove the exact deployed revision, gateway and Encore routes, database migrations, authenticated browser journey, signed settlement callback, incorporation write, holder-specific certificate download and public integrity verification as separate gates.", "Callout"),
          P("12. Source index", "H1x"),
          table(["Area", "Primary sources"], [
              ("Member UI", "src/components/views/shares-view.tsx; src/components/views/active-presale-campaigns.tsx; src/lib/shares-portfolio.ts"),
              ("Applicant UI", "src/app/shares/account/shares-account-client.tsx; src/app/shares/account/page.tsx"),
              ("Presale UI", "src/app/presale/presale-client.tsx; src/app/presale/page.tsx; src/app/presale/[invite]/page.tsx"),
              ("Next gateways", "src/app/api/shares/**; src/app/api/presale/**; src/app/api/admin/shares/**; src/app/api/admin/presale/**"),
              ("Backend", "encore/domains/shares/api.ts; encore/domains/presale/api.ts; applicant-continuation.ts; settlement.ts; shareholder-portfolio.ts; payments/**; kyc/**"),
              ("Certificates", "src/lib/share-certificate-pdf.ts; src/lib/share-certificate-integrity.ts; public/certificate-templates/solidus-shareholder-certificate.pdf"),
              ("Tests", "src/lib/shares-portfolio.test.ts; src/app/api/shares/route.test.ts; src/components/views/shares-view.contract.test.ts; encore/domains/shares/portfolio-contract.test.ts"),
              ("Schema", "encore/migrations/shares/1-9; encore/migrations/presale/1-15; identity scoped-session migration; payments and KYC migrations"),
          ], [36*mm, 134*mm]),
          P("Document status: source-mapped, regenerated and visually verified against the working-tree fix based on the revision printed above. The local production browser path is verified. Deployment, live provider credentials, live database contents and real-money behavior remain unverified.", "Smallx")]


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=16*mm, rightMargin=16*mm,
                            topMargin=17*mm, bottomMargin=16*mm,
                            title="KaSiHub Shares Page and Journey - Frontend and Backend API Map",
                            author="S.A.N.I.")
    doc.build(story, onFirstPage=cover_page, onLaterPages=normal_page)
    print(OUT)


if __name__ == "__main__":
    build()
