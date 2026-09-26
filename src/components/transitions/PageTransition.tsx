import { ReactNode } from "react";

export const PageTransition = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen">{children}</div>
);

export default PageTransition;