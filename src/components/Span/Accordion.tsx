import React from 'react';
import clsx from 'clsx';

export const Accordion = ({
  title,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <div className="border-t border-gray-600 pt-4 mt-2">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between text-sm font-semibold text-gray-300 hover:text-gray-100 transition-colors duration-200 mb-2"
    >
      <span>{title}</span>
      <svg
        className={clsx('w-4 h-4 transition-transform duration-200', isExpanded ? 'rotate-180' : 'rotate-0')}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      className={clsx(
        'overflow-hidden transition-all duration-300 ease-in-out',
        isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      )}
    >
      {children}
    </div>
  </div>
);

export default Accordion;
