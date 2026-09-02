from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

output_path = "output/pdf/kasihub-test-document.pdf"
page_width, page_height = A4

pdf = canvas.Canvas(output_path, pagesize=A4)
pdf.setTitle("KaSiHub Test PDF")
pdf.setAuthor("Klaasvaakie")

pdf.setFillColor(HexColor("#071A2B"))
pdf.rect(0, 0, page_width, page_height, stroke=0, fill=1)
pdf.setFillColor(HexColor("#13A78B"))
pdf.rect(0, page_height - 18, page_width, 18, stroke=0, fill=1)

pdf.setFillColor(white)
pdf.setFont("Helvetica-Bold", 12)
pdf.drawString(56, page_height - 70, "KASIHUB / SYSTEM CHECK")
pdf.setFont("Helvetica-Bold", 30)
pdf.drawString(56, page_height - 132, "Test PDF created successfully")
pdf.setFillColor(HexColor("#B6C7D8"))
pdf.setFont("Helvetica", 13)
pdf.drawString(56, page_height - 164, "A simple verified output for document-delivery testing.")

pdf.setFillColor(HexColor("#102D43"))
pdf.roundRect(56, page_height - 330, page_width - 112, 112, 12, stroke=0, fill=1)
pdf.setFillColor(HexColor("#67E8D0"))
pdf.setFont("Helvetica-Bold", 11)
pdf.drawString(80, page_height - 254, "STATUS")
pdf.setFillColor(white)
pdf.setFont("Helvetica-Bold", 20)
pdf.drawString(80, page_height - 286, "Ready for review")

footer = "Generated as a test artifact"
pdf.setFillColor(HexColor("#B6C7D8"))
pdf.setFont("Helvetica", 9)
pdf.drawString((page_width - stringWidth(footer, "Helvetica", 9)) / 2, 42, footer)
pdf.showPage()
pdf.save()
