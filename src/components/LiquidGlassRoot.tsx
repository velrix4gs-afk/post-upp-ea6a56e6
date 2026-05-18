import { useEffect, useState } from "react";

/**
 * Liquid Glass (iOS 26) — opt-in visual skin layer.
 * Renders once at app root: injects the gooey SVG filter and ambient
 * animated backlight canvas. Activates only when <html data-skin="liquid-glass">.
 * Pure presentation — no business logic, no DOM mutation outside its own subtree.
 */
export const LiquidGlassRoot = () => {
  const [skin, setSkin] = useState<string>(
    () => document.documentElement.getAttribute("data-skin") || ""
  );

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setSkin(root.getAttribute("data-skin") || "");
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["data-skin"] });
    return () => obs.disconnect();
  }, []);

  const active = skin === "liquid-glass";

  return (
    <>
      {/* Gooey metaball filter — always mounted so CSS url(#lg-goo) resolves */}
      <svg
        aria-hidden
        width="0"
        height="0"
        style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
      >
        <defs>
          <filter id="lg-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {active && (
        <div className="lg-ambient" aria-hidden>
          <span className="lg-blob lg-blob-1" />
          <span className="lg-blob lg-blob-2" />
          <span className="lg-blob lg-blob-3" />
        </div>
      )}
    </>
  );
};

export default LiquidGlassRoot;