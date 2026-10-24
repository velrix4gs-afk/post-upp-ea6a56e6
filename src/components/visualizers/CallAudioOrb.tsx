import { useEffect, useRef, useState } from 'react';
import CrystalizedBall from './CrystalizedBall';

interface CallAudioOrbProps {
  /** 0-1 — how loud the call currently is (local mic + remote voice, whichever is louder). */
  level: number;
  color?: string;
  preset?: 'plasma' | 'aurora' | 'nebula' | 'ember' | 'frost' | 'solar' | 'eclipse' | 'abyss';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wraps the CrystalizedBall WebGL particle ball so its crackle/flares/glow/sparks
 * react to live call audio instead of the pointer. `level` is expected to arrive
 * in small, infrequent jumps (Stream's participant.audioLevel updates a few times
 * a second), so this smooths it with a fast attack / slow release and re-renders
 * at ~14fps — CrystalizedBall only writes those props into a ref each render
 * (its WebGL context inits once on mount), so this is cheap.
 */
export const CallAudioOrb = ({ level, color = '#c13aed', preset = 'abyss', className, style }: CallAudioOrbProps) => {
  const targetRef = useRef(0);
  const smoothedRef = useRef(0);
  const paramsRef = useRef({ crackle: 0.4, flares: 0.35, glow: 0.65, sparks: 0.2, speed: 0.8 });
  const [, setTick] = useState(0);

  useEffect(() => {
    targetRef.current = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
  }, [level]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastCommit = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const target = targetRef.current;
      // Snap up quickly when someone starts talking, ease back down slowly so
      // the ball doesn't flicker between words.
      const rate = target > smoothedRef.current ? 9 : 2.5;
      smoothedRef.current += (target - smoothedRef.current) * Math.min(1, rate * dt);
      const s = smoothedRef.current;
      paramsRef.current = {
        crackle: 0.35 + s * 0.9,
        flares: 0.3 + s * 1.1,
        glow: 0.6 + s * 0.95,
        sparks: 0.12 + s * 0.85,
        speed: 0.75 + s * 1.15,
      };
      if (now - lastCommit > 70) {
        lastCommit = now;
        setTick((t) => (t + 1) % 1_000_000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const p = paramsRef.current;
  return (
    <CrystalizedBall
      preset={preset}
      color={color}
      crackle={p.crackle}
      flares={p.flares}
      glow={p.glow}
      sparks={p.sparks}
      speed={p.speed}
      interactive={false}
      intro
      className={className}
      style={style}
    />
  );
};

export default CallAudioOrb;
