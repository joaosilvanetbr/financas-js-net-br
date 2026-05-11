import { useCallback, useEffect, useRef, useState } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => void | Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

/**
 * Hook de pull-to-refresh para mobile.
 * Dispara onRefresh quando o usuario puxa a tela para baixo no topo do scroll.
 */
export function usePullToRefresh({ onRefresh, threshold = 80, disabled = false }: UsePullToRefreshOptions) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const startX = useRef(0);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const canPull = useCallback(() => {
    if (disabled || refreshing) return false;
    // So permite pull quando scroll esta no topo
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    return scrollTop <= 5;
  }, [disabled, refreshing]);

  useEffect(() => {
    if (disabled) return;

    const container = containerRef.current || document.body;

    const onTouchStart = (e: TouchEvent) => {
      if (!canPull()) return;
      const touch = e.touches[0];
      startY.current = touch.clientY;
      startX.current = touch.clientX;
      isDragging.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || !canPull()) return;

      const touch = e.touches[0];
      const deltaY = touch.clientY - startY.current;
      const deltaX = Math.abs(touch.clientX - startX.current);

      // Ignora gestos horizontais (swipe de tabs)
      if (deltaX > deltaY * 1.5) return;
      // Ignora scroll para cima
      if (deltaY <= 0) return;

      // Previne scroll padrao durante o pull
      if (deltaY > 10) {
        e.preventDefault();
      }

      const damped = Math.min(deltaY * 0.5, threshold * 1.5);
      setPullDistance(damped);
      setPulling(damped > threshold * 0.3);
    };

    const onTouchEnd = async () => {
      if (!isDragging.current) return;
      isDragging.current = false;

      if (pullDistance >= threshold) {
        setRefreshing(true);
        setPulling(false);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPulling(false);
        setPullDistance(0);
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [canPull, onRefresh, pullDistance, threshold, disabled]);

  return { containerRef, pulling, pullDistance, refreshing };
}
