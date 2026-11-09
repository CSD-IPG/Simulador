"""Actualiza narración, texto y subtítulos preservando los demás capítulos."""
import asyncio,json,subprocess,tempfile,textwrap
from pathlib import Path
import edge_tts
from PIL import Image,ImageDraw,ImageFont
from musica_original import compose_music,SR
from scipy.io import wavfile
R=Path(__file__).resolve().parents[2]
changes=json.loads((R/'tools/tutoriales/cambios_autonomia.json').read_text())
def run(a): subprocess.run(a,check=True)
def stamp(t):
 return f'{int(t//3600):02}:{int(t//60%60):02}:{t%60:06.3f}'
async def main():
 with tempfile.TemporaryDirectory(dir=R) as tmp:
  tmp=Path(tmp)
  for name in dict.fromkeys(x[4] for x in changes):
   edits=[x for x in changes if x[4]==name]; src=R/f'ayuda/{name}.mp4'
   dur=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(src)]))
   args=['ffmpeg','-y','-v','error','-i',str(src)]; filters=[]; audio='[0:a]'; vf='[0:v]'
   mute=''; voices=[]; cues=[]
   for j,(_,_,a,b,_,txt) in enumerate(edits):
    mp=tmp/f'{j}.mp3';await edge_tts.Communicate(txt,'es-CL-CatalinaNeural').save(str(mp))
    length=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(mp)]))
    assert length < b-a-0.8,(length,b-a,txt)
    args+=['-i',str(mp)]
    filters.append(f'[{j+1}:a]adelay={int((a+.5)*1000)}:all=1[voice{j}]');voices.append(f'[voice{j}]')
    mute+=f",volume=0:enable='between(t,{a},{b})'"
    # Overwrite only the explanatory paragraph; preserve screenshot and title.
    im=Image.new('RGBA',(620,635),(9,23,41,255));dr=ImageDraw.Draw(im)
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',32)
    words=txt.split();lines=[];line=''
    for word in words:
     test=(line+' '+word).strip()
     if dr.textlength(test,font=font)>570:lines.append(line);line=word
     else:line=test
    lines.append(line)
    dr.multiline_text((18,12),'\n'.join(lines),font=font,fill='#f5f9ff',spacing=14)
    png=tmp/f'{j}.png';im.save(png)
    # Image inputs are added after all voice inputs below.
    chunks=textwrap.wrap(txt,78)
    for c,line in enumerate(chunks):
     start=a+.5+c*(length/len(chunks));end=a+.5+(c+1)*(length/len(chunks))
     cues.append(f'{stamp(start)} --> {stamp(end)}\n{line}')
   for j in range(len(edits)):args+=['-i',str(tmp/f'{j}.png')]
   for j,(_,_,a,b,_,_) in enumerate(edits):
    filters.append(f'{vf}[{len(edits)+1+j}:v]overlay=1292:{300 if a == 14 else 358}:enable=\'gte(t,{a})*lt(t,{b})\'[v{j}]');vf=f'[v{j}]'
   filters.append('[0:a]anull'+mute+'[base]')
   filters.append('[base]'+''.join(voices)+f'amix=inputs={len(voices)+1}:duration=first:normalize=0[a]')
   out=tmp/'out.mp4';run(args+['-filter_complex',';'.join(filters),'-map',vf,'-map','[a]','-c:v','libx264','-preset','veryfast','-crf','22','-c:a','aac','-b:a','128k','-t',str(dur),'-movflags','+faststart',str(out)])
   out.replace(src)
   vtt=R/f'ayuda/{name}.vtt';blocks=vtt.read_text().strip().split('\n\n')[1:];keep=[]
   for block in blocks:
    rows=block.splitlines();time=next(x for x in rows if ' --> ' in x);s=time.split(' --> ')[0];h,m,sec=map(float,s.split(':'));t=h*3600+m*60+sec
    if not any(a<=t<b for _,_,a,b,_,_ in edits):keep.append('\n'.join(rows[1:] if rows[0].isdigit() else rows))
   keep+=cues;keep.sort(key=lambda x:x.splitlines()[0]);vtt.write_text('WEBVTT\n\n'+'\n\n'.join(keep)+'\n')
asyncio.run(main())
