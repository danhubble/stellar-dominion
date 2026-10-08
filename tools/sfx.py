#!/usr/bin/env python3
"""Turn a recording into a game sound clip: src/audio/sfx/<cue>.ogg, which build.py
inlines and sfx("<cue>") plays (see SAMPLE_VOL in src/js/00-core.js for its volume).

    python tools/sfx.py <cue> <file> [<file> ...] [--len 1.0] [--fade 0.2]

Each input is made mono 22050 Hz, its leading silence trimmed and peak-normalised;
several inputs are layered into one clip. The result is cut to --len seconds with a
--fade tail, normalised again, and saved as a small Ogg Vorbis file. Needs ffmpeg,
numpy and scipy.

The clips in src/audio/sfx came from (all ElevenLabs, made by the owner):
  fireLaser     pulselaser.wav                                   --len 1.0  --fade .2
  fireRocket    spaceships_rocket_fi_#2-1791469042412.wav        --len 1.0  --fade .2
  fireHeavy     A_heavy_laser_gun_fi_#2-1791475342451.wav        --len 1.0  --fade .2
  boltHit       A_thump_from_a_space_#1-1791475660709.wav
                + Resonant_thump_of_a__#4-3.mp3                  --len 0.9  --fade .2
  rocketHit     hullbreach.wav                                   --len 1.48 --fade .3
  rocketShield  spaceshipenergyshield.wav                        --len 1.48 --fade .3
  foeDead       A_spaceship_explodin_#3-1791469281903.wav        --len 2.5  --fade .4
"""
import os, sys, subprocess, tempfile
import numpy as np
from scipy.io import wavfile

SR = 22050
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load(path):
    with tempfile.TemporaryDirectory() as d:
        tmp = os.path.join(d, "x.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR),
                        "-af", "silenceremove=start_periods=1:start_threshold=-45dB", tmp], check=True)
        _, x = wavfile.read(tmp)
    x = x.astype(np.float64) / 32768
    return x / (np.max(np.abs(x)) + 1e-9)

def main(argv):
    args, opts = [], {"--len": 1.0, "--fade": 0.2}
    i = 0
    while i < len(argv):
        if argv[i] in opts: opts[argv[i]] = float(argv[i + 1]); i += 2
        else: args.append(argv[i]); i += 1
    if len(args) < 2: sys.exit(__doc__)
    cue, files = args[0], args[1:]
    parts = [load(f) for f in files]
    x = np.zeros(max(len(p) for p in parts))
    for p in parts: x[:len(p)] += p
    x = x[:int(SR * opts["--len"])]
    n, f = len(x), int(SR * opts["--fade"])
    if f < n: x[n - f:] *= np.linspace(1, 0, f) ** 1.5
    x -= np.mean(x); x = x / (np.max(np.abs(x)) + 1e-9) * 0.92
    out = os.path.join(ROOT, "src", "audio", "sfx", cue + ".ogg")
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        wavfile.write(wav, SR, (x * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "2", out], check=True)
    print(f"{out}  {n / SR:.2f}s  {os.path.getsize(out)} bytes")

if __name__ == "__main__":
    main(sys.argv[1:])
