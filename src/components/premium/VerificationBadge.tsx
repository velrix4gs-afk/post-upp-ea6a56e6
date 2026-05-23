import React from 'react';

interface VerificationBadgeProps {
  isVerified?: boolean;
  verificationType?: string | null;
  className?: string;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  isVerified = false,
  className = ''
}) => {
  if (!isVerified) return null;

  return (
    <svg
      className={`w-5 h-5 text-sky-500 fill-current inline-block align-middle ml-1 select-none ${className}`}
      viewBox="0 0 24 24"
    >
      {/* Sharp Starburst Background */}
      <path d="M10.06 2.42a2.25 2.25 0 0 1 3.88 0l.77 1.33c.24.42.69.68 1.17.68h1.54a2.25 2.25 0 0 1 2.25 2.25v1.54c0 .48.26.93.68 1.17l1.33.77a2.25 2.25 0 0 1 0 3.88l-1.33.77c-.42.24-.68.69-.68 1.17v1.54a2.25 2.25 0 0 1-2.25 2.25h-1.54c-.48 0-.93.26-1.17.68l-.77 1.33a2.25 2.25 0 0 1-3.88 0l-.77-1.33a1.409 1.409 0 0 0-1.17-.68H6.69A2.25 2.25 0 0 1 4.44 17.31v-1.54c0-.48-.26-.93-.68-1.17l-1.33-.77a2.25 2.25 0 0 1 0-3.88l1.33-.77c.42-.24.68-.69.68-1.17V6.69A2.25 2.25 0 0 1 6.69 4.44h1.54c.48 0 .93-.26 1.17-.68l.77-1.33Z" />
      {/* Inner White Tick */}
      <path d="M9.75 14.25l-2.5-2.5 1.06-1.06 1.44 1.44 4.94-4.94 1.06 1.06-6 6z" fill="#ffffff" />
    </svg>
  );
};