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
      <div className="absolute inset-0 bg-black opacity-70 z-40" onClick={onClose} style={{ zIndex: 1000 }} />

      {/* Drawer */}
      <div
        className="absolute top-0 right-0 h-full bg-gray-800 border-l border-gray-700 shadow-lg z-50 overflow-hidden"
        style={{
          width: drawerWidth,
          zIndex: 1001,
          transform: 'translateX(0)',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b border-gray-700 bg-gray-900">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
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
