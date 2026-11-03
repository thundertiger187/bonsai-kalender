import pdfplumber,glob
for f in sorted(glob.glob('/workspace/bonsai-kalender/source-pdfs/*.pdf'))[:6]:
  p=pdfplumber.open(f).pages[0]
  for i,im in enumerate(p.images):
    w=im['x1']-im['x0']; h=im['bottom']-im['top']
    if w>80 or h>20: continue
    img=p.crop((im['x0'],im['top'],im['x1'],im['bottom'])).to_image(resolution=200).original.convert('L')
    px=list(img.getdata()); dark=sum(1 for v in px if v<80)/len(px); mid=sum(px)/len(px)
    print(f.split('/')[-1][:12],round(im['x0']),round(im['top']),round(w),round(h),'dark',round(dark,3),'mean',round(mid))
