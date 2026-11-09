"""Genera el video de orientación autónoma FIN-SIM y su bloque de entrada."""
import asyncio,html,json,math,subprocess,sys,tempfile,textwrap
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
import edge_tts
from scipy.io import wavfile
from musica_original import compose_music,SR
R=Path(__file__).resolve().parents[2];OUT=R/'finanzas/ayuda';OUT.mkdir(exist_ok=True)
SCENES=[
('Bienvenido a FIN-SIM','Aprende a tu ritmo', ['Practica finanzas con autonomía','Elige cuándo comenzar','Puedes pausar y volver'], 'Bienvenido a FIN SIM, tu espacio de práctica autónoma. Aquí puedes explorar información financiera, tomar decisiones y revisar sus efectos. Elige cuándo comenzar y avanza a tu ritmo.'),
('Elige cómo practicar','Dos modalidades, avances separados', ['Práctica libre: explora y ejercita','Desafíos laborales: resuelve un encargo','Cambia de modalidad cuando lo necesites'], 'Al ingresar encontrarás dos modalidades. Práctica libre te permite explorar y ejercitar. Desafíos laborales te propone un encargo dentro de una empresa simulada. Cada modalidad conserva su propio avance en este navegador.'),
('Asume un rol financiero','Elige un desafío', ['Liquidez y cobranza','Costos y margen operacional','Demanda y cierre financiero'], 'En Desafíos laborales, elige un caso y revisa el rol que asumirás. Encontrarás situaciones de liquidez, costos o demanda. Lee el encargo y las metas financieras antes de iniciar tu trabajo.'),
('Revisa y diagnostica','Consulta los antecedentes del caso', ['Lee los documentos y las fórmulas','Calcula en millones de pesos: MM','Verifica el diagnóstico para continuar'], 'Consulta los antecedentes y las fórmulas. Calcula el diagnóstico en millones de pesos, indicados como MM, y selecciona la prioridad del encargo. Al verificarlo, recibirás una nueva comunicación que modifica la situación de la empresa.'),
('Analiza y decide','Tus medidas cambian las cifras', ['Analizar no ejecuta la medida','Revisa efectos, costos y riesgos','Confirma hasta dos medidas distintas'], 'Analiza las medidas disponibles y compara sus efectos, costos y riesgos. Escribe el fundamento de tu decisión y confirma para ejecutarla. Puedes aplicar hasta dos medidas distintas. Observa cómo cambian los indicadores del caso.'),
('Presenta tu cierre','Concilia las cifras y explica tu plan', ['Completa ventas, EBITDA y caja','Redacta conclusión, riesgo y seguimiento','Revisa las metas por separado del avance'], 'Completa las cifras del cierre y redacta tu conclusión, los riesgos y el seguimiento. El avance muestra tareas completadas; revisa por separado las metas financieras. Tus argumentos quedan disponibles para tu autoevaluación.'),
('Pausa y retoma','Conserva tu avance', ['Utiliza Pausar y Retomar','Guardar y volver permite salir','Regresa con el mismo navegador'], 'Puedes pausar y retomar tu intento. Para salir, utiliza Guardar y volver al portal. Regresa desde el mismo dispositivo y navegador, sin borrar sus datos. El avance detallado se conserva localmente.'),
('Guarda tu evidencia','Revisa, aprende y vuelve a intentar', ['Descarga evidencia JSON o bitácora CSV','Imprime y elige Guardar como PDF','Descarga antes de crear otro intento'], 'Descarga tu evidencia en JSON o la bitácora en CSV. Para conservar el informe en PDF, utiliza Imprimir y Guardar como PDF. Descarga tu trabajo antes de crear un nuevo intento. Explora, decide y aprende.')
]
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(n,b=False):return ImageFont.truetype(BOLD if b else FONT,n)
def wrap(draw,text,f,width):
 lines=[];line=''
 for w in text.split():
  candidate=(line+' '+w).strip()
  if draw.textlength(candidate,font=f)>width and line:lines.append(line);line=w
  else:line=candidate
 lines.append(line);return lines

def label(draw,xy,text,size=22,fill='#eaf3ff',width=1000,b=False,gap=10):
 f=font(size,b);lines=wrap(draw,text,f,width);draw.multiline_text(xy,'\n'.join(lines),font=f,fill=fill,spacing=gap);return len(lines)*(size+gap)
def card(draw,box,title,body='',active=False):
 draw.rounded_rectangle(box,radius=14,fill='#16465c' if active else '#112c46',outline='#76e7de' if active else '#517593',width=2)
 x,y,x2,y2=box;h=label(draw,(x+18,y+15),title,21,'#9bf4e9' if active else '#edf6ff',x2-x-36,True)
 if body:label(draw,(x+18,y+23+h),body,18,'#c6d9ed',x2-x-36)
def picture(i):
 im=Image.new('RGB',(1280,720),'#081a2e');d=ImageDraw.Draw(im)
 for y in range(720):
  a=y/720;d.line((0,y,1279,y),fill=(int(8+6*a),int(26+7*a),int(46+10*a)))
 d.rounded_rectangle((36,27,111,84),radius=15,fill='#65e3dd');d.text((46,36),'CSD',font=font(28,True),fill='#08243b')
 label(d,(130,30),'FIN-SIM · ORIENTACIÓN PARA ESTUDIANTES',23,'#f0f7ff',1000,True)
 label(d,(130,64),'Escuela de Gestión, Negocios y Marítima · IPG',16,'#bfd1e5')
 label(d,(1130,37),f'{i+1:02} / 08',22,'#83eee1',125,True)
 title,sub,bullets,_=SCENES[i]
 h=label(d,(42,126),title,39,'#f3f8ff',1190,True)
 label(d,(44,140+h),sub,23,'#8cecdf',1150)
 for j,t in enumerate(bullets):
  y=295+j*91;d.ellipse((45,y+5,57,y+17),fill='#73e5db');label(d,(76,y),t,24,'#e0edfa',525)
 x=665
 if i==0:
  card(d,(x,282,1235,393),'EXPLORA','Comprende la información y el encargo.',True);card(d,(x,410,1235,521),'DECIDE','Aplica medidas y revisa sus efectos.');card(d,(x,538,1235,626),'APRENDE','Revisa resultados y vuelve a practicar.')
 elif i==1:
  card(d,(x,295,1235,430),'Práctica libre','Familiarízate con procesos, cálculos e indicadores.',True);card(d,(x,457,1235,602),'Desafíos laborales','Asume un rol, toma decisiones y presenta un cierre.',True)
 elif i==2:
  for j,(a,b) in enumerate([('F01 · Inicial','Analista de tesorería'),('F02 · Intermedio','Analista de control de gestión'),('F03 · Avanzado','Responsable de planificación financiera')]):card(d,(x,285+j*108,1235,380+j*108),a,b,j==0)
 elif i==3:
  card(d,(x,285,1235,385),'Mesa de trabajo','Antecedentes y fórmulas disponibles',True)
  for j,t in enumerate(['EBITDA inicial (MM)','Caja final inicial (MM)','Prioridad del encargo']):
   yy=405+j*59;label(d,(x+10,yy),t,19,'#d6e7fa',260);d.rounded_rectangle((x+305,yy-2,1220,yy+35),radius=6,fill='#0a2038',outline='#7b9cb5')
  card(d,(x,590,1235,642),'Verificar diagnóstico','',True)
 elif i==4:
  card(d,(x,285,1235,390),'1 · Analizar medida','Consulta la proyección antes de decidir.',True);card(d,(x,414,1235,514),'2 · Fundamentar','Explica el efecto buscado y el riesgo.');card(d,(x,538,1235,633),'3 · Confirmar y ejecutar','La medida modifica las cifras del caso.',True)
 elif i==5:
  card(d,(x,285,1235,395),'Cierre de gestión','Ventas · EBITDA · Caja',True);card(d,(x,418,1235,526),'Informe personal','Conclusión · Riesgo · Seguimiento');card(d,(x,549,1235,633),'Conciliar y cerrar intento','',True)
 elif i==6:
  card(d,(x,300,1235,393),'Pausar  /  Retomar','Continúa cuando estés listo.',True);card(d,(x,420,1235,518),'Guardar y volver al portal','Conserva el avance antes de salir.');card(d,(x,544,1235,634),'Mismo dispositivo y navegador','No borres sus datos.')
 else:
  for j,(a,b) in enumerate([('JSON','Evidencia detallada del intento'),('CSV','Bitácora de acciones y decisiones'),('PDF','Imprimir → Guardar como PDF')]):card(d,(x,285+j*111,1235,381+j*111),a,b,True)
 d.line((40,668,1240,668),fill='#4b6b85',width=1);label(d,(42,685),'TRABAJO AUTÓNOMO · EXPLORA, DECIDE Y APRENDE',17,'#bcd3ea',1150)
 return im

def cmd(args):subprocess.run(args,check=True)
def timestamp(t):return f'{int(t//3600):02}:{int(t//60%60):02}:{t%60:06.3f}'
async def main():
 with tempfile.TemporaryDirectory(dir=R) as td:
  tmp=Path(td);subtitles=[];SLOT=15;total=len(SCENES)*SLOT
  for i,scene in enumerate(SCENES):
   png=tmp/f'{i}.png';picture(i).save(png)
   audio=tmp/f'{i}.mp3';boundaries=[]
   speech=edge_tts.Communicate(scene[3],'es-CL-CatalinaNeural',rate='+6%',boundary='WordBoundary')
   with audio.open('wb') as f:
    async for chunk in speech.stream():
     if chunk['type']=='audio':f.write(chunk['data'])
     elif chunk['type']=='WordBoundary':boundaries.append(chunk)
   duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(audio)]))
   tempo=max(1,duration/(SLOT-1));assert tempo<1.35,(i,duration)
   for start in range(0,len(boundaries),7):
    group=boundaries[start:start+7];a=i*SLOT+.4+group[0]['offset']/1e7/tempo;b=i*SLOT+.4+(group[-1]['offset']+group[-1]['duration'])/1e7/tempo
    subtitles.append(f'{timestamp(a)} --> {timestamp(b)}\n'+html.unescape(' '.join(x['text'] for x in group)))
   cmd(['ffmpeg','-y','-v','error','-loop','1','-framerate','24','-i',str(png),'-i',str(audio),'-filter_complex',f'[1:a]atempo={tempo},loudnorm=I=-18:TP=-2:LRA=8,adelay=400:all=1,apad[a]','-map','0:v','-map','[a]','-t',str(SLOT),'-c:v','libx264','-preset','veryfast','-tune','stillimage','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-ar','44100','-ac','2',str(tmp/f'{i}.mp4')])
   print(f'Capítulo {i+1}/8: narración {duration:.1f}s',flush=True)
  listing=tmp/'list.txt';listing.write_text('\n'.join("file '"+str(tmp/f'{i}.mp4')+"'" for i in range(8)))
  cmd(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(listing),'-c','copy',str(tmp/'joined.mp4')])
  music=compose_music(total+1);music*=.8/max(np.max(np.abs(music)),1e-9);wavfile.write(tmp/'music.wav',SR,(music*32767).astype(np.int16))
  cmd(['ffmpeg','-y','-v','error','-i',str(tmp/'joined.mp4'),'-i',str(tmp/'music.wav'),'-filter_complex',f'[1:a]volume=0.085,afade=t=in:d=2,afade=t=out:st={total-3}:d=3[m];[0:a][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','128k','-t',str(total),'-movflags','+faststart',str(OUT/'finsim-primeros-pasos.mp4')])
  picture(0).save(OUT/'finsim-primeros-pasos.jpg',quality=92)
  (OUT/'finsim-primeros-pasos.vtt').write_text('WEBVTT\n\n'+'\n\n'.join(subtitles)+'\n')
  chapters=['WEBVTT']
  for i,sc in enumerate(SCENES):chapters.append(f'{timestamp(i*SLOT)} --> {timestamp((i+1)*SLOT)}\n{sc[0]}')
  (OUT/'finsim-capitulos.vtt').write_text('\n\n'.join(chapters)+'\n')
  (OUT/'guion-finsim.json').write_text(json.dumps({'voice':'es-CL-CatalinaNeural','duration':total,'chapters':[{'start':i*SLOT,'title':sc[0],'narration':sc[3]} for i,sc in enumerate(SCENES)]},ensure_ascii=False,indent=2))
  embed()

def embed():
 p=R/'finanzas/index.html';s=p.read_text();start='<!-- FIN-SIM VIDEO AUTONOMO -->';end='<!-- FIN FIN-SIM VIDEO -->'
 block=start+'''<section id="fin-help" class="no-print" aria-labelledby="fin-help-title"><div><p class="fin-help-kicker">ORIENTACIÓN PARA ESTUDIANTES</p><h2 id="fin-help-title">¿Primera vez en FIN-SIM? Comienza aquí</h2><p>Descubre cómo elegir tu modalidad, resolver desafíos y guardar tu evidencia. Trabajo autónomo, a tu ritmo.</p><p>Narración en español de Chile · Subtítulos · Música instrumental original · 2 minutos.</p><a href="ayuda/finsim-primeros-pasos.mp4?v=20261109-autonomo" download>Descargar video</a></div><video controls playsinline preload="none" poster="ayuda/finsim-primeros-pasos.jpg?v=20261109-autonomo" aria-label="Cómo utilizar FIN-SIM de forma autónoma"><source src="ayuda/finsim-primeros-pasos.mp4?v=20261109-autonomo" type="video/mp4"><track kind="subtitles" src="ayuda/finsim-primeros-pasos.vtt?v=20261109-autonomo" srclang="es" label="Español" default><track kind="chapters" src="ayuda/finsim-capitulos.vtt?v=20261109-autonomo" srclang="es" label="Capítulos"><p><a href="ayuda/finsim-primeros-pasos.mp4">Descargar el video de orientación</a></p></video><details><summary>Leer orientación en texto</summary>'''+''.join('<h3>'+html.escape(sc[0])+'</h3><p>'+html.escape(sc[3])+'</p>' for sc in SCENES)+'''</details></section>'''+end
 if start in s:s=s[:s.index(start)]+block+s[s.index(end)+len(end):]
 else:s=s.replace('<div class="shell">',block+'\n<div class="shell">',1)
 if 'ayuda/video.css' not in s:s=s.replace('</head>','<link rel="stylesheet" href="ayuda/video.css?v=20261109-autonomo"></head>')
 p.write_text(s)

if __name__=='__main__':asyncio.run(main())
