import React from 'react';
import { Icon } from '@grafana/ui';

interface SpanOverlayDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  panelWidth: number;
}

export const SpanOverlayDrawer: React.FC<SpanOverlayDrawerProps> = ({
  isOpen,
  onClose,
  children,
  title = 'Span Details',
  panelWidth,
}) => {
  if (!isOpen) {
    return null;
  }

  // Calculate drawer width: up to 50% of panel width, but no more than 378px
  const maxWidth = Math.min(panelWidth * 0.5, 378);
  const drawerWidth = `${maxWidth}px`;

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black opacity-20 z-[998]" onClick={onClose} />

      {/* Drawer */}
      <div
        className="absolute top-0 right-0 h-full bg-gray-800 border-l border-gray-700 shadow-lg overflow-hidden z-[1000]"
        style={{
          width: drawerWidth,
          transform: 'translateX(0)',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        {/* Header */}
        <div className="absolute top-0 right-0">
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            aria-label="Close drawer"
          >
            <Icon name="times" className="text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto p-1">{children}</div>
      </div>
    </>
  );
};
