"""Generate DayLoop's original short three-note notification chime."""

import math
import struct
import wave
from pathlib import Path

RATE = 22050
NOTES = [(523.25, 0.11), (659.25, 0.11), (880.0, 0.20)]
samples = []
for frequency, duration in NOTES:
    count = round(RATE * duration)
    for index in range(count):
        envelope = min(1.0, index / (RATE * 0.008)) * max(0.0, 1 - index / count) ** 1.5
        phase = 2 * math.pi * frequency * index / RATE
        value = 0.24 * envelope * (math.sin(phase) + 0.16 * math.sin(2 * phase))
        samples.append(max(-32767, min(32767, round(value * 32767))))

target = Path(__file__).resolve().parents[1] / "android/app/src/main/res/raw/dayloop_chime.wav"
target.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(target), "wb") as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(RATE)
    output.writeframes(struct.pack(f"<{len(samples)}h", *samples))
print(target)
