from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from pathlib import Path

HERE=Path(__file__).resolve().parent
OUT=HERE/'poster.pdf'
FONTS=Path('/System/Library/Fonts/Supplemental')
for n,f in [('Arial','Arial.ttf'),('Arial-Bold','Arial Bold.ttf'),('Georgia','Georgia.ttf'),('Georgia-Bold','Georgia Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(n,str(FONTS/f)))
W,H=18*72,24*72
ink=HexColor('#16252d'); teal=HexColor('#167a78'); rust=HexColor('#bb6649'); gold=HexColor('#d2aa59'); paper=HexColor('#f7f5ef'); warm=HexColor('#ece8dc'); muted=HexColor('#506067')
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
c.setTitle('Storm deaths, adaptation, and exposure | ECON 238 Week Four')
c.setAuthor('Felix Brener')
c.setFillColor(paper);c.rect(0,0,W,H,fill=1,stroke=0)

def txt(x,y,s,size=20,font='Arial',color=ink):
    c.setFillColor(color);c.setFont(font,size);c.drawString(x,y,s)
def para(text,x,top,width,size=18,leading=None,color=ink,font='Arial'):
    st=ParagraphStyle('p',fontName=font,fontSize=size,leading=leading or size*1.34,textColor=color,spaceAfter=0)
    p=Paragraph(text,st);_,h=p.wrap(width,1000);p.drawOn(c,x,top-h);return top-h

def rule(x,y,w,color=ink,weight=1):
    c.setStrokeColor(color);c.setLineWidth(weight);c.line(x,y,x+w,y)

def label(x,y,s,color=teal):
    txt(x,y,s.upper(),15,'Arial-Bold',color)

M=72; CW=W-2*M
label(M,H-80,'ECON 238  /  WEEK FOUR  /  FALL 2026')
txt(W-255,H-80,'FELIX BRENER',15,'Arial-Bold',ink)
rule(M,H-102,CW,ink,2)
txt(M,H-180,'Storm deaths fell per resident.',61,'Georgia-Bold',ink)
txt(M,H-250,'The explanation is less simple.',55,'Georgia',teal)
para('In the NWS historical series, U.S. tornado, flood, and hurricane deaths declined only modestly in raw counts from the 1940s to 2020–25. Relative to population, the decline is much larger. That is consistent with adaptation, but it does not identify which investments worked or how much risk remains.',M,H-283,CW,22,30)

# Key numbers
by=H-465
txt(M,by+17,'1940s / 2020-25 (six years)',14,'Arial-Bold',muted)
for i,(big,small) in enumerate([('1.88 / 0.68','deaths per million residents / year'),('262 / 230','average annual deaths, three categories'),('140m / 336m','average U.S. population')]):
    x=M+i*(CW/3)
    c.setFillColor(warm);c.rect(x,by-112,CW/3-12,112,fill=1,stroke=0)
    txt(x+17,by-45,big,34,'Georgia-Bold',teal)
    para(small,x+17,by-60,CW/3-38,17,20)
label(M,by-151,'Figure 1   /   Average annual deaths by NWS category')

# Category chart
periods=['1940s','1950s','1960s','1970s','1980s','1990s','2000s','2010s','2020–25']
series=[('Tornado',teal,[178.8,140.9,93.5,98.6,52.1,57.9,55.8,91,68]),('Flood',rust,[61.9,79.1,129.7,181.9,109.7,99.2,64.7,98.8,123.5]),('Hurricane',gold,[21.6,87.7,58.7,21.7,11.8,14,115.4,5.3,38.2])]
chart_x=M+47;chart_y=by-400;chart_w=CW-65;chart_h=205
for val in [0,50,100,150,200]:
    y=chart_y+val/200*chart_h
    rule(chart_x,y,chart_w,HexColor('#c9cfca'),1)
    txt(M,y-4,str(val),13,'Arial',muted)
step=chart_w/9;bw=step*.21
for i,p in enumerate(periods):
    cx=chart_x+step*(i+.5)
    for j,(_,color,vals) in enumerate(series):
        height=vals[i]/200*chart_h
        c.setFillColor(color);c.rect(cx+(j-1)*bw-bw/2,chart_y,bw-2,height,fill=1,stroke=0)
    c.setFont('Arial',12);c.setFillColor(muted);c.drawCentredString(cx,chart_y-22,p)
ly=chart_y-59
for i,(name,color,_) in enumerate(series):
    x=M+20+i*170;c.setFillColor(color);c.rect(x,ly-2,17,17,fill=1,stroke=0);txt(x+27,ly,name,16,'Arial',ink)

# Rate plot and context
sec_top=chart_y-85
rule(M,sec_top,CW,ink,2)
label(M,sec_top-35,'Figure 2   /   Combined deaths per million U.S. residents')
rates=[1.878,1.868,1.464,1.405,.733,.655,.801,.609,.683]
rx=M+50;ry=sec_top-245;rw=660;rh=170
for val in [0,.5,1,1.5,2]:
    y=ry+val/2*rh;rule(rx,y,rw,HexColor('#c9cfca'),1);txt(M,y-4,f'{val:g}',13,'Arial',muted)
pts=[]
for i,val in enumerate(rates):
    x=rx+i*rw/8;y=ry+val/2*rh;pts.append((x,y))
c.setStrokeColor(teal);c.setLineWidth(4)
for a,b in zip(pts,pts[1:]):c.line(*a,*b)
for i,(x,y) in enumerate(pts):
    c.setFillColor(teal);c.circle(x,y,5,fill=1,stroke=0)
    c.setFont('Arial',11);c.setFillColor(muted);c.drawCentredString(x,ry-22,periods[i])
for i in [0,8]:
    x,y=pts[i];c.setFont('Arial-Bold',18);c.setFillColor(ink);c.drawCentredString(x,y+15,f'{rates[i]:.2f}')
# Interpretation beside plot
ix=M+760
label(ix,sec_top-84,'Read this carefully')
para('The per-resident index is about 64% lower at the endpoint. Flood deaths rose in raw counts, tornado deaths fell, and hurricane counts swing with major events. A national population denominator does not measure who actually faced a storm.',ix,sec_top-103,CW-760,17,23)

# Bottom analysis panels
bottom_top=ry-65
rule(M,bottom_top,CW,ink,2)
gap=27; col=(CW-2*gap)/3
label(M,bottom_top-35,'Flood migration')
para('A Census study of 1999–2023 finds growth in blocks classified as flood-prone, but the parcel-level picture is steadier.',M,bottom_top-54,col,16,21)
fy=bottom_top-121
rule(M,fy,col,HexColor('#b9c3bd'),1)
txt(M,fy-22,'Flood-prone blocks',15,'Arial-Bold',ink);txt(M+col-83,fy-22,'growth',15,'Arial',teal)
rule(M,fy-32,col,HexColor('#b9c3bd'),1)
txt(M,fy-54,'Exposed parcels',15,'Arial-Bold',ink);txt(M+col-112,fy-54,'14.2–14.4%',15,'Arial',teal)
rule(M,fy-64,col,HexColor('#b9c3bd'),1)

x2=M+col+gap
label(x2,bottom_top-35,'Temperature context')
para('Burke et al. estimate that ambient temperature accounts for 5–12% of deaths in the countries studied, with cold exceeding heat. That modeled attribution is a different measure from NWS incident fatalities.',x2,bottom_top-54,col,16,21)

x3=M+2*(col+gap)
label(x3,bottom_top-35,'Economics')
para('Better warnings, buildings, and response capacity may help explain the decline, but this series cannot isolate their effects. Compare the full cost of the next protective investment with expected avoided harm; use local exposure, not one national trend.',x3,bottom_top-54,col,16,21)
# Footnote area
foot_top=bottom_top-195
rule(M,foot_top,CW,ink,1)
label(M,foot_top-30,'Methods and limits')
para('Annual NWS tornado + flood + hurricane deaths were divided by each year’s Census July 1 population (millions), then averaged within each period. 2020–25 has six years; 2025 NWS figures are preliminary. NWS reporting geography and Census population coverage do not align perfectly. This is a descriptive national index, not a causal or individual storm-risk measure. Heat is analyzed separately on the webpage because incident reports and modeled excess mortality answer different questions.',M,foot_top-45,CW-190,14,19)
# QR + footer
url='https://felix-ab.github.io/econ238-portfolio/week-four/'
qr=QrCodeWidget(url);bounds=qr.getBounds();size=125;d=Drawing(size,size,transform=[size/(bounds[2]-bounds[0]),0,0,size/(bounds[3]-bounds[1]),0,0]);d.add(qr);renderPDF.draw(d,c,W-M-size,foot_top-166)
refs_y=foot_top-158
para('<b>Sources:</b> NWS, <i>81-Year Hazard Fatalities</i> (1940–2025); U.S. Census Bureau, annual population estimates; Qin &amp; Voorheis, Census WP 26-37; CDC, 1995 Chicago heat wave report; Burke et al., NBER WP 34313. Full methods, source links, and accessible data table: <link href="'+url+'" color="#167a78">felix-ab.github.io/econ238-portfolio/week-four/</link>',M,refs_y,CW-190,12.5,16)
rule(M,64,CW,ink,1)
txt(M,42,'FELIX BRENER   ·   ENVIRONMENTAL ECONOMICS   ·   UNIVERSITY OF ROCHESTER',12,'Arial-Bold',muted)
c.showPage();c.save()
print(OUT)
