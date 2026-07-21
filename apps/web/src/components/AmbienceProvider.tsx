"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_AMBIENCE,
  getAmbiencePack,
  loadAmbience,
  saveAmbience,
  type AmbienceState,
} from "../lib/ambience";

type AmbienceContextValue = AmbienceState & {
  setSoundsEnabled: (v: boolean) => void;
  setMusicEnabled: (v: boolean) => void;
  setPackId: (id: string) => void;
};

const AmbienceContext = createContext<AmbienceContextValue | null>(null);

export function useAmbience() {
  const ctx = useContext(AmbienceContext);
  if (!ctx) {
    throw new Error("useAmbience must be used within AmbienceProvider");
  }
  return ctx;
}

export default function AmbienceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AmbienceState>(DEFAULT_AMBIENCE);
  // Browsers block audible autoplay anyway, so don't fetch/decode audio
  // until the first user gesture makes playback actually possible.
  const [hasGestured, setHasGestured] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rainSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rainGainRef = useRef<GainNode | null>(null);
  const rainBufferRef = useRef<AudioBuffer | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);

  const setSoundsEnabled = useCallback((v: boolean) => {
    setState((s) => ({ ...s, soundsEnabled: v }));
  }, []);

  const setMusicEnabled = useCallback((v: boolean) => {
    setState((s) => ({ ...s, musicEnabled: v }));
  }, []);

  const setPackId = useCallback((id: string) => {
    setState((s) => ({ ...s, packId: id }));
  }, []);

  // Server + first client render use the defaults (no hydration flash);
  // stored settings land on mount, then every change is persisted.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setState(loadAmbience());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveAmbience(state);
  }, [hydrated, state]);

  // First pointer/key interaction unlocks the Web Audio pipeline.
  useEffect(() => {
    if (hasGestured) return;
    const mark = () => setHasGestured(true);
    window.addEventListener("pointerdown", mark, { once: true });
    window.addEventListener("keydown", mark, { once: true });
    return () => {
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
    };
  }, [hasGestured]);

  // Stop rain
  const stopRain = useCallback(() => {
    if (rainSourceRef.current) {
      try {
        rainSourceRef.current.stop();
      } catch {
        // ignore
      }
      rainSourceRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.suspend();
    }
  }, []);

  // Start rain
  const startRain = useCallback(async () => {
    const pack = getAmbiencePack(state.packId);
    const rainUrl = pack?.sounds?.rain;
    if (!rainUrl || typeof window === "undefined") return;

    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      audioCtxRef.current = new Ctx();
    }

    const ctx = audioCtxRef.current;

    if (!rainBufferRef.current) {
      try {
        const res = await fetch(rainUrl);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        rainBufferRef.current = await ctx.decodeAudioData(buf);
      } catch {
        return;
      }
    }

    if (rainSourceRef.current) {
      try {
        rainSourceRef.current.stop();
      } catch {
        // ignore
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = rainBufferRef.current;
    source.loop = true;

    if (!rainGainRef.current) {
      rainGainRef.current = ctx.createGain();
      rainGainRef.current.gain.value = 0.75;
      rainGainRef.current.connect(ctx.destination);
    }

    source.connect(rainGainRef.current);
    source.start(0);
    rainSourceRef.current = source;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  }, [state.packId]);

  // Thunder on random intervals (only when sounds enabled)
  useEffect(() => {
    if (!state.soundsEnabled || !hasGestured) {
      stopRain();
      return;
    }

    startRain();

    const pack = getAmbiencePack(state.packId);
    const thunderUrls = pack?.sounds?.thunder ?? [];
    if (!thunderUrls.length) return;

    const playThunder = () => {
      const url = thunderUrls[Math.floor(Math.random() * thunderUrls.length)];
      const audio = new Audio(url);
      audio.volume = 0.85;
      audio.play().catch(() => {
        // ignore autoplay errors
      });
    };

    // First thunder after 3–8s, then random every 8–20s
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = 3000 + Math.random() * 17000;
      timeout = setTimeout(() => {
        playThunder();
        schedule();
      }, delay);
    };
    schedule();

    return () => {
      clearTimeout(timeout);
      stopRain();
    };
  }, [state.soundsEnabled, state.packId, hasGestured, startRain, stopRain]);

  // Music (placeholder — no music yet)
  useEffect(() => {
    const pack = getAmbiencePack(state.packId);
    if (!state.musicEnabled || !pack?.music) {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current = null;
      }
      return;
    }

    const audio = new Audio(pack.music);
    audio.loop = true;
    audio.volume = 0.5;
    audio.play().catch(() => {
      // ignore autoplay errors
    });
    musicRef.current = audio;

    return () => {
      audio.pause();
      if (musicRef.current === audio) musicRef.current = null;
    };
  }, [state.musicEnabled, state.packId]);

  return (
    <AmbienceContext.Provider
      value={{
        ...state,
        setSoundsEnabled,
        setMusicEnabled,
        setPackId,
      }}
    >
      {children}
    </AmbienceContext.Provider>
  );
}
