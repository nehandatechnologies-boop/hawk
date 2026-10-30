/**
 * Priority-tiered attention tone + spoken-detail alerts for HawkTrace.
 *
 * Modern browsers block audio playback until a user gesture. We treat audio
 * as "locked" until the operator confirms — after that every realtime alert
 * plays a tone (WebAudio, no asset dependency) and speaks the subject name
 * via the Speech Synthesis API.
 */

type Priority = "Critical" | "High" | "Medium" | "Low";

let ctx: AudioContext | null = null;
let unlocked = false;
const listeners = new Set<(v: boolean) => void>();

function notify() {
  for (const l of listeners) l(unlocked);
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function isAudioUnlocked() {
  return unlocked;
}

export function onAudioUnlockChange(cb: (v: boolean) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Must run from a user gesture (click/tap). */
export async function unlockAlertAudio(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state === "suspended") await c.resume();
    // "Prime" TTS engine on Chromium — the first .speak() after unlock
    // is silently swallowed unless we do this.
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
    unlocked = true;
    notify();
    return true;
  } catch {
    return false;
  }
}

function toneBurst(freq: number, duration: number, when: number, type: OscillatorType = "sine") {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + when);
  gain.gain.setValueAtTime(0.0001, c.currentTime + when);
  gain.gain.exponentialRampToValueAtTime(0.35, c.currentTime + when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + when);
  osc.stop(c.currentTime + when + duration + 0.05);
}

function playPriorityTone(priority: Priority) {
  switch (priority) {
    case "Critical":
      // Rising three-tone alert — unmistakable
      toneBurst(880, 0.18, 0, "square");
      toneBurst(1175, 0.18, 0.2, "square");
      toneBurst(1568, 0.28, 0.4, "square");
      break;
    case "High":
      toneBurst(988, 0.15, 0);
      toneBurst(1319, 0.22, 0.18);
      break;
    case "Medium":
      toneBurst(784, 0.22, 0);
      break;
    case "Low":
    default:
      toneBurst(523, 0.18, 0, "triangle");
  }
}

function speakDetails(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    // Cancel anything in flight so newer alerts win.
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 1;
    u.volume = 1;
    // Prefer an English voice when one is available.
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /en(-|_)?(US|GB|ZA)/i.test(v.lang)) ??
      voices.find((v) => v.lang?.startsWith("en"));
    if (preferred) u.voice = preferred;
    window.speechSynthesis.speak(u);
  } catch {
    // Speech synthesis is best-effort; the tone is the guaranteed signal.
  }
}

export function announceAlert(input: {
  priority: Priority;
  subjectName?: string | null;
  cameraName?: string | null;
  location?: string | null;
  title?: string | null;
}) {
  if (!unlocked) return;
  playPriorityTone(input.priority);

  const who = input.subjectName?.trim() || input.title?.trim() || "Unidentified subject";
  const where =
    input.cameraName?.trim() ||
    input.location?.trim() ||
    "an unspecified location";
  const script = `${input.priority} match. ${who} detected at ${where}.`;
  // Small delay so the tone doesn't collide with the utterance.
  setTimeout(() => speakDetails(script), 500);
}
