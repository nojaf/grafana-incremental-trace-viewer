import React from 'react';
import clsx from 'clsx';

interface SpanOverlayDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  panelWidth: number;
  selectedSpanElementYOffset?: number | null;
}

/**
 * Easily tunable drawer width constraints
 * Limits are set in both absolute and relative terms
 * The default width is 50% of panel width
 * The minimum width is set to 10% of panel width
 * The maximum width is set to 75% of panel width
 */
const DRAWER_MIN_PERCENT = 10; // minimum comfortable width
const DRAWER_MIN_WIDTH_PX = 384; // minimum width in pixels
const DRAWER_MAX_PERCENT = 75; // maximum as percentage of panel width
const DRAWER_DEFAULT_PERCENT = 25; // default as percentage of panel width

export const SpanOverlayDrawer: React.FC<SpanOverlayDrawerProps> = ({
  isOpen,
  onClose,
  children,
  title = 'Span Details',
  panelWidth,
  selectedSpanElementYOffset,
}) => {
  // Default width: up to 25% of panel width
  const defaultWidthPx = Math.max(panelWidth * (DRAWER_DEFAULT_PERCENT / 100), DRAWER_MIN_WIDTH_PX);
  const [widthPercent, setWidthPercent] = React.useState<number>((defaultWidthPx / panelWidth) * 100);
  const isResizingRef = React.useRef<boolean>(false);
  const drawerRef = React.useRef<HTMLDivElement | null>(null);
  const [resizeHover, setResizeHover] = React.useState<boolean>(false);

  const onMouseDownResize = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isResizingRef.current = true;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    const controller = new AbortController();
    // Resize by dragging the left edge of the drawer
    window.addEventListener(
      'mousemove',
      (e: MouseEvent) => {
        if (!isResizingRef.current) {
          return;
        }
        const drawer = drawerRef.current;
        const container = drawer?.parentElement as HTMLElement | null; // absolute container from TraceDetail
        if (!container) {
          return;
        }
        const bounds = container.getBoundingClientRect();
        // Desired width is distance from mouse to the right edge of the container
        const widthPx = Math.max(0, bounds.right - e.clientX);
        const minPx = panelWidth * (DRAWER_MIN_PERCENT / 100); // minimum comfortable width
        const maxPx = panelWidth * (DRAWER_MAX_PERCENT / 100);
        const clamped = Math.min(Math.max(widthPx, minPx), maxPx);
        const percent = (clamped / bounds.width) * 100;
        setWidthPercent(percent);
      },
      { signal: controller.signal }
    );
    window.addEventListener(
      'mouseup',
      () => {
        if (isResizingRef.current) {
          isResizingRef.current = false;
        }
      },
      { signal: controller.signal }
    );
    return () => controller.abort();
  }, [isOpen, panelWidth]);

  const drawerWidth = React.useMemo(() => `${(widthPercent / 100) * panelWidth}px`, [widthPercent, panelWidth]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/10 dark:bg-black/20 z-[998]" onClick={onClose} />

      {/* Tooltip Arrow pointing to selected span */}
      {selectedSpanElementYOffset && (
        <div
          className="absolute z-[1001]"
          style={{
            right: `${panelWidth * (widthPercent / 100) - 1}px`,
            top: `${selectedSpanElementYOffset}px`,
          }}
        >
          <div
            className={clsx(
              'w-0 h-0 border-r-14 border-t-14 border-t-transparent border-b-14 border-b-transparent',
              resizeHover ? 'border-r-gray-400 dark:border-r-gray-600' : 'border-r-gray-300 dark:border-r-gray-700'
            )}
          ></div>
          <div className="w-0 h-0 border-r-12 border-r-white dark:border-r-black border-t-12 border-t-transparent border-b-12 border-b-transparent mt-[-26px] ml-[2px]"></div>
        </div>
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={clsx(
          'absolute top-0 right-0 h-full bg-white dark:bg-black border-l shadow-lg overflow-hidden z-[1000]',
          resizeHover ? 'border-gray-400 dark:border-gray-600' : 'border-gray-300 dark:border-gray-700'
        )}
        style={{
          width: drawerWidth,
          transform: 'translateX(0)',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        {/* Resize handle on the left edge */}
        <div
          onMouseDown={onMouseDownResize}
          onMouseEnter={() => {
            setResizeHover(true);
          }}
          onMouseLeave={() => {
            setResizeHover(false);
          }}
          title="Drag to resize"
          className="absolute top-0 left-0 h-full w-[6px] cursor-col-resize z-[1001]"
        >
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
            <div className="flex flex-col items-center gap-[2px] bg-gray-400/10 dark:bg-gray-600/10 w-full px-[1px] py-2"></div>
          </div>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto">{children}</div>
      </div>
    </>
  );
};
