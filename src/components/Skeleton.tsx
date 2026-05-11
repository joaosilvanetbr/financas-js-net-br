import React from "react";

interface SkeletonProps {
  className?: string;
  rows?: number;
}

export function Skeleton({ className = "", rows = 1 }: SkeletonProps) {
  return (
    <div className={`skeleton ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}
