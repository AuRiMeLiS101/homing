"""Loudness and peak report for the captured Homing audio. python3 test/audio_report.py"""
import glob
import os
import sys

import numpy as np
import pyloudnorm as pyln
from scipy.io import wavfile

d = os.path.join(os.path.dirname(__file__), 'out', 'audio')
rows = []
for f in sorted(glob.glob(os.path.join(d, '*.wav'))):
    sr, x = wavfile.read(f)
    x = x.astype(np.float64)
    if x.ndim == 1:
        x = x[:, None]
    name = os.path.basename(f)[:-4]
    peak = np.max(np.abs(x)) if len(x) else 0
    peak_db = 20 * np.log10(peak) if peak > 0 else -120
    mono = x.mean(axis=1)
    # active region: samples above -50 dBFS envelope
    env = np.abs(mono)
    win = max(1, int(sr * 0.01))
    if len(env) > win:
        env = np.convolve(env, np.ones(win) / win, mode='same')
    active = env > 10 ** (-50 / 20)
    dur = active.sum() / sr
    rms = np.sqrt(np.mean(mono[active] ** 2)) if active.any() else 0
    rms_db = 20 * np.log10(rms) if rms > 0 else -120
    meter = pyln.Meter(sr, block_size=0.4 if len(x) / sr >= 0.5 else len(x) / sr * 0.9)
    try:
        lufs = meter.integrated_loudness(x)
    except Exception:
        lufs = float('nan')
    # short term max (3 s window) for longer clips, momentary (0.4 s) max for sfx
    def max_window(seconds):
        n = int(sr * seconds)
        if len(x) < n:
            return float('nan')
        best = -120
        step = int(sr * 0.1)
        for i in range(0, len(x) - n, step):
            seg = x[i:i + n]
            try:
                v = pyln.Meter(sr, block_size=seconds).integrated_loudness(seg)
                best = max(best, v)
            except Exception:
                pass
        return best
    mom = max_window(0.4)
    clip = int((np.abs(x) >= 0.999).sum())
    # spectral centroid
    spec = np.abs(np.fft.rfft(mono * np.hanning(len(mono)))) if len(mono) > 1024 else np.zeros(2)
    freqs = np.fft.rfftfreq(len(mono), 1 / sr) if len(mono) > 1024 else np.zeros(2)
    cent = float((spec * freqs).sum() / spec.sum()) if spec.sum() > 0 else 0
    rows.append((name, peak_db, rms_db, lufs, mom, dur, clip, cent))

print(f"{'clip':22s} {'peak':>7s} {'rms':>7s} {'LUFS':>7s} {'Mmax':>7s} {'active':>7s} {'clips':>6s} {'centroid':>9s}")
for r in rows:
    print(f"{r[0]:22s} {r[1]:7.1f} {r[2]:7.1f} {r[3]:7.1f} {r[4]:7.1f} {r[5]:6.2f}s {r[6]:6d} {r[7]:8.0f}Hz")
