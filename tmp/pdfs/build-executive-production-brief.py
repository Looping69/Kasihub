from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfgen.canvas import Canvas
from pathlib import Path

OUT = Path(r"C:\Users\wimpi\Documents\GitHub\Kasihub\output\pdf\kasihub-production-readiness-executive-brief.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor('#10233F'); BLUE = colors.HexColor('#0569BD'); ORANGE = colors.HexColor('#F58220')
PALE = colors.HexColor('#EEF5FA'); GREEN = colors.HexColor('#17865D'); AMBER = colors.HexColor('#B96B08')
RED = colors.HexColor('#B43B3B'); INK = colors.HexColor('#17233C'); MUTED = colors.HexColor('#64748B')
WHITE = colors.white; LINE = colors.HexColor('#D9E4EC')

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleX', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=28, leading=32, textColor=WHITE, alignment=TA_LEFT, spaceAfter=8))
styles.add(ParagraphStyle(name='Deck', parent=styles['BodyText'], fontSize=12, leading=17, textColor=colors.HexColor('#DDEAF5')))
styles.add(ParagraphStyle(name='H1X', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=NAVY, spaceAfter=10))
styles.add(ParagraphStyle(name='H2X', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=BLUE, spaceBefore=6, spaceAfter=5))
styles.add(ParagraphStyle(name='BodyX', parent=styles['BodyText'], fontSize=9.5, leading=14, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name='SmallX', parent=styles['BodyText'], fontSize=7.5, leading=10, textColor=MUTED))
styles.add(ParagraphStyle(name='Metric', parent=styles['BodyText'], fontName='Helvetica-Bold', fontSize=20, leading=21, textColor=NAVY, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='MetricLabel', parent=styles['BodyText'], fontSize=7.5, leading=10, textColor=MUTED, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='CardTitle', parent=styles['BodyText'], fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=NAVY, spaceAfter=4))
styles.add(ParagraphStyle(name='WhiteSmall', parent=styles['BodyText'], fontSize=8, leading=11, textColor=WHITE))

def P(txt, style='BodyX'): return Paragraph(txt, styles[style])

def header_footer(canvas: Canvas, doc):
    canvas.saveState(); w,h=A4
    if doc.page > 1:
        canvas.setFillColor(NAVY); canvas.rect(0,h-12*mm,w,12*mm,fill=1,stroke=0)
        canvas.setFillColor(WHITE); canvas.setFont('Helvetica-Bold',8); canvas.drawString(16*mm,h-7.5*mm,'KaSiHub | Executive Production Readiness')
    canvas.setStrokeColor(LINE); canvas.line(16*mm,12*mm,w-16*mm,12*mm)
    canvas.setFillColor(MUTED); canvas.setFont('Helvetica',7); canvas.drawString(16*mm,7.5*mm,'Prepared 13 August 2026 | Internal decision brief')
    canvas.drawRightString(w-16*mm,7.5*mm,f'Page {doc.page}')
    canvas.restoreState()

def status_card(title, body, color):
    return Table([[P(title,'CardTitle')],[P(body,'SmallX')]], colWidths=[53*mm], style=TableStyle([
        ('BACKGROUND',(0,0),(-1,-1),colors.white),('BOX',(0,0),(-1,-1),0.8,color),('LINEBEFORE',(0,0),(0,-1),4,color),
        ('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)
    ]))

story=[]
cover = Table([[P('KaSiHub Production Readiness','TitleX')],[P('Executive status, remaining controls, and the path to accepting international USDT share purchases','Deck')],[Spacer(1,18*mm)],[P('<b>Current verdict:</b> Production infrastructure is live and structurally ready. Commercial activation remains deliberately paused pending first-admin access, payment-route approval, and a controlled end-to-end rehearsal.','WhiteSmall')]], colWidths=[178*mm], style=TableStyle([
    ('BACKGROUND',(0,0),(-1,-1),NAVY),('LEFTPADDING',(0,0),(-1,-1),16*mm),('RIGHTPADDING',(0,0),(-1,-1),16*mm),('TOPPADDING',(0,0),(0,0),30*mm),('BOTTOMPADDING',(0,-1),(0,-1),18*mm)
]))
story += [cover, Spacer(1,10*mm), P('Decision snapshot','H1X')]
metrics=[[P('11','Metric'),P('100,000','Metric'),P('$25','Metric'),P('0','Metric')],[P('isolated production databases','MetricLabel'),P('Phase 1 shares configured','MetricLabel'),P('price per paid share','MetricLabel'),P('live campaigns or payment routes','MetricLabel')]]
story += [Table(metrics,colWidths=[44.5*mm]*4,style=TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),0.7,LINE),('INNERGRID',(0,0),(-1,-1),0.5,LINE),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)])),Spacer(1,7*mm)]
story += [Table([[status_card('LIVE AND VERIFIED','Encore production is Ready. All 11 schemas match staging structure, while production began without staging users, orders, campaigns, or payment records.',GREEN),status_card('CONFIGURED, NOT SELLING','Four membership plans and Phase 1 economics are installed. Phase 1 is paused and BOGO is configured.',AMBER),status_card('BLOCKED BY CONTROL','No first production administrator exists. No wallet route, campaign, invitation, or payment acceptance is active.',RED)]],colWidths=[59.3*mm]*3,style=TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),2),('RIGHTPADDING',(0,0),(-1,-1),2)])),Spacer(1,7*mm)]
story += [P('Executive meaning','H2X'),P('The platform is no longer waiting for core engineering. It is waiting for controlled operational activation. The safest route is to establish accountable administration, load approved receiving details, rehearse the complete flow without funds, and only then open a limited invitation campaign.')]
story += [PageBreak(),P('What is complete','H1X')]
done=[('Production boundary','Dedicated Encore production environment and deployment branch; no staging database clone.'),('Infrastructure','11 PostgreSQL databases, private object storage, backend service, chain RPC configuration, and webhook signing secret.'),('Schema parity','Columns, defaults, constraints, and indexes fingerprinted equal between staging and production.'),('Reference configuration','Member/admin roles, four source-approved membership plans, and USDT/USD server quote default.'),('Share economics','Phase 1: 100,000 shares, USD 25 per paid share, BOGO enabled, status paused.'),('Core contract','Live international registration policy returned HTTP 200 and routes international applicants to KYC plus USDT.')]
table=[[P('Workstream','WhiteSmall'),P('Verified outcome','WhiteSmall')]]+[[P(a),P(b)] for a,b in done]
story += [Table(table,colWidths=[43*mm,135*mm],repeatRows=1,style=TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('TEXTCOLOR',(0,0),(-1,0),WHITE),('GRID',(0,0),(-1,-1),0.5,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,1),(-1,-1),[WHITE,PALE]),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)])),Spacer(1,8*mm),P('What remains intentionally off','H1X')]
off=[('Production administrator','Zero production users and zero assigned admins. This prevents unaccountable campaign or configuration changes.'),('Receiving routes','No production Remitano/BSC/TRON receiving route has been activated.'),('Campaign and invitation','No production campaign or purchaser invitation exists.'),('Payment intake','No real payment instruction is exposed and no funds can be accepted through the presale flow.'),('Frontend cutover','Forge and Vercel have not been redirected to the new production Encore runtime.'),('Legal/operational approval','Final campaign terms, receiver confirmation, operator ownership, and go-live authorization still require named approval.')]
story += [Table([[P(a,'CardTitle'),P(b)] for a,b in off],colWidths=[48*mm,130*mm],style=TableStyle([('BOX',(0,0),(-1,-1),0.6,LINE),('INNERGRID',(0,0),(-1,-1),0.4,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))]
story += [PageBreak(),P('Controlled activation path','H1X'),P('The remaining work is sequential. Skipping a gate creates financial or governance risk.')]
steps=[('1','Establish authority','Create the first production administrator using an owner-controlled identity and temporary credential; verify login and role enforcement.'),('2','Approve payment route','Confirm exact USDT token contract, BSC/TRON receiver addresses, provider ownership, confirmation depth, and operator responsibilities.'),('3','Create draft campaign','Load the approved USD 25 Phase 1 campaign and invitation limits, leaving campaign and phase paused.'),('4','No-money rehearsal','Test signup, international routing, KYC gate, invitation, order quote, rejected proof, admin review, expiry, and incorporation controls.'),('5','Limited activation','Open a tightly capped invitation campaign, monitor orders and chain evidence, and retain immediate pause/rollback controls.'),('6','Frontend cutover','Point the selected public frontend to production Encore, then perform guarded browser and runtime verification.')]
for n,t,b in steps:
    story.append(Table([[P(n,'Metric'),P(t,'CardTitle'),P(b)]],colWidths=[15*mm,39*mm,124*mm],style=TableStyle([('BACKGROUND',(0,0),(0,0),BLUE),('TEXTCOLOR',(0,0),(0,0),WHITE),('BOX',(0,0),(-1,-1),0.6,LINE),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))); story.append(Spacer(1,3*mm))
story += [Spacer(1,4*mm),P('Readiness assessment','H1X')]
readiness=[('Platform infrastructure',90,GREEN),('Database and backend contracts',90,GREEN),('Commercial configuration',65,AMBER),('Operational access and governance',35,RED),('Payment-route activation',25,RED),('End-to-end production proof',20,RED)]
for label,pct,col in readiness:
    filled=105*mm*pct/100; empty=105*mm-filled
    bar=Table([[P(label,'SmallX'),'','',P(f'{pct}%','SmallX')]],colWidths=[57*mm,filled,empty,16*mm],rowHeights=[5*mm],style=TableStyle([('BACKGROUND',(1,0),(1,0),col),('BACKGROUND',(2,0),(2,0),colors.HexColor('#E6EDF2')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0)]))
    story += [bar,Spacer(1,2.5*mm)]
story += [PageBreak(),P('Executive decisions required','H1X')]
decisions=[('First production administrator','Name the accountable owner and provide the email identity. Use a temporary credential and rotate after first login.','Immediate'),('Approved receiving architecture','Confirm whether both BSC and TRON routes are enabled at launch, the exact USDT token contracts, and the two Remitano deposit addresses.','Before rehearsal'),('Campaign authority','Approve total allocation, BOGO terms, invitation caps, opening/closing dates, and who may pause or close the campaign.','Before draft finalization'),('Cutover surface','Choose Vercel, Forge, or both as the production frontend authority.','After rehearsal'),('Hosting maturity','Accept Encore Managed as interim hosting or authorize AWS/GCP production infrastructure.','Before material scale')]
story += [Table([[P('Decision','WhiteSmall'),P('Required action','WhiteSmall'),P('Deadline','WhiteSmall')]]+[[P(a),P(b),P(c,'SmallX')] for a,b,c in decisions],colWidths=[47*mm,103*mm,28*mm],repeatRows=1,style=TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('GRID',(0,0),(-1,-1),0.5,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,1),(-1,-1),[WHITE,PALE]),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)])),Spacer(1,9*mm)]
story += [P('Bottom line','H1X'),Table([[P('<b>We are one controlled activation cycle away from a limited real-money pilot.</b><br/><br/>The system should not be described as selling shares yet. It has the production infrastructure and core transaction controls, but it deliberately cannot accept a purchaser until accountable admin access, approved receiving routes, a draft campaign, and a successful no-money rehearsal are complete.','BodyX')]],colWidths=[178*mm],style=TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),1,BLUE),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10)])),Spacer(1,7*mm),P('<b>Evidence basis:</b> Encore production rollout 20pe5oeagip95thu2a10; GitHub main ad0f814; live production registration-policy response; direct schema fingerprints and production row/configuration checks performed 12-13 August 2026.','SmallX')]

doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=16*mm,leftMargin=16*mm,topMargin=18*mm,bottomMargin=17*mm,title='KaSiHub Production Readiness Executive Brief',author='Klaasvaakie ( |\\ )')
doc.build(story,onFirstPage=header_footer,onLaterPages=header_footer)
print(OUT)
