import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Lightweight, GPU-only page transition.
 * Re-keys on pathname change → triggers .fb-page-enter spring-fade.
 * Pure presentation, no Suspense interaction, no logic.
 */
export const PageTransition = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const [key, setKey] = useState(pathname);
  useEffect(() => {
    setKey(pathname);
  }, [pathname]);
  return (
    <div key={key} className="fb-page-enter min-h-screen">
      {children}
    </div>
  );
};

export default PageTransition;