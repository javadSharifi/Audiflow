import { useEffect, useState } from "react";

export function getResponsiveAlbumCols(w: number): number {
  if (w >= 1024) return 6;
  if (w >= 768) return 5;
  if (w >= 640) return 4;
  return 3;
}

export function useAlbumColumns(): number {
  const [cols, setCols] = useState(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 0;
    return getResponsiveAlbumCols(w);
  });

  useEffect(() => {
    const upd = () => {
      const w = typeof window !== "undefined" ? window.innerWidth : 0;
      setCols(getResponsiveAlbumCols(w));
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);
  return cols;
}
