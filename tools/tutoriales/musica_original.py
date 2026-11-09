"""Música instrumental original para los tutoriales CSD.
Piano sintetizado, pads y percusión electrónica. No utiliza grabaciones ni melodías de terceros.
Requiere numpy y scipy. Ejecutar: python musica_original.py salida.wav --seconds 180
"""
import math
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR=44100

def compose_music(seconds,seed=2026):
 """Original instrumental: 124 BPM, D major, piano, pads and electronic drums.
 No existing recording, melody or song audio is used.
 """
 rng=np.random.default_rng(seed);n=int(seconds*SR);mix=np.zeros((n,2),dtype=np.float32)
 beat=60/124;bar=4*beat
 chords=[[62,66,69,73],[59,62,66,69],[55,59,62,66],[57,61,64,69]]
 def add(sig,start,gain=1,pan=0):
  pos=round(start*SR)
  if pos>=n:return
  sig=sig[:n-pos]*gain
  mix[pos:pos+len(sig),0]+=sig*np.sqrt((1-pan)/2)
  mix[pos:pos+len(sig),1]+=sig*np.sqrt((1+pan)/2)
 def piano(note,seconds=1.8):
  t=np.arange(round(seconds*SR))/SR;f=440*2**((note-69)/12)
  s=np.zeros(len(t))
  for h,amp in [(1,1),(2,.36),(3,.15),(4,.07),(6,.025)]:
   s+=amp*np.sin(2*np.pi*f*h*t+0.00006*h*t**2)*np.exp(-t*(1.6+h*.8))
  return (s*(1-np.exp(-t*220))).astype(np.float32)
 def kick():
  t=np.arange(round(.44*SR))/SR
  phase=2*np.pi*(48*t+95*.025*(1-np.exp(-t/.025)))
  return (np.sin(phase)*np.exp(-t*11)+.025*rng.standard_normal(len(t))*np.exp(-t*170)).astype(np.float32)
 def noisehit(seconds,high,low,decay):
  t=np.arange(round(seconds*SR))/SR;s=rng.standard_normal(len(t))
  s=sosfilt(butter(2,[high,low],btype='bandpass',fs=SR,output='sos'),s)
  return (s*np.exp(-t*decay)*(1-np.exp(-t*800))).astype(np.float32)
 kk=kick();hh=noisehit(.11,6500,15000,45);sn=noisehit(.22,1000,8500,18)
 for j in range(math.ceil(seconds/bar)):
  start=j*bar;notes=chords[j%4]
  # Sparse opening; progressively introduce arpeggios, bass and rhythm.
  energy=.60 if j<2 else .85 if j<4 else 1
  for k,note in enumerate(notes):add(piano(note),start+k*.036,.16*energy,(-.25 if k%2 else .25))
  for k in range(8):
   note=notes[[0,2,1,3,2,1,3,2][k]]+12
   add(piano(note,.8),start+k*beat/2,.07*energy,(-.45 if k%2 else .45))
  # Sustained stereo pad with a gentle pumping envelope.
  t=np.arange(round(bar*SR))/SR;pad=np.zeros(len(t))
  for note in notes:
   f=440*2**((note-69)/12)
   pad+=np.sin(2*np.pi*f*.998*t)+np.sin(2*np.pi*f*1.002*t)
  pump=.5+.5*(1-np.exp(-(t%beat)*10))
  env=np.minimum(t/.16,1)*np.minimum((bar-t)/.4,1)
  add((pad*pump*env).astype(np.float32),start,.018*energy)
  for k in range(4):
   pos=start+k*beat
   if j>=2:add(kk,pos,.42*energy)
   bassnote=notes[0]-24;tt=np.arange(round(beat*.85*SR))/SR
   f=440*2**((bassnote-69)/12)
   bass=(np.sin(2*np.pi*f*tt)+.16*np.sin(2*np.pi*2*f*tt))*np.exp(-tt*3)*(1-np.exp(-tt*80))
   if j>=2:add(bass.astype(np.float32),pos,.19)
   if j>=4 and k%2:add(sn,pos,.19)
   if j>=2:
    add(hh,pos+beat/2,.075,(-.35 if k%2 else .35))
    if j>=6:add(hh,pos,.035,.2)
  # Original short high piano figure every fourth bar.
  if j>=4 and j%4==3:
   for k,note in enumerate([78,76,73,74,76,81]):add(piano(note,.9),start+(.5+k*.5)*beat,.075,(-.2+k*.08))
 # Gentle stereo echoes create space without external samples.
 dry=mix.copy()
 for delay,gain in [(.19,.10),(.37,.07),(.61,.045)]:
  q=round(delay*SR);mix[q:]+=dry[:-q,::-1]*gain
 fade=np.minimum(np.arange(n)/SR/2,1)*np.minimum((n-np.arange(n))/SR/3,1)
 mix*=np.maximum(fade,0)[:,None]
 mix=np.tanh(mix*1.25)
 return mix

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser()
 parser.add_argument('output');parser.add_argument('--seconds',type=float,default=180)
 args=parser.parse_args()
 a=compose_music(args.seconds)
 a*=.8/max(np.max(np.abs(a)),1e-9)
 wavfile.write(args.output,SR,(a*32767).astype(np.int16))
