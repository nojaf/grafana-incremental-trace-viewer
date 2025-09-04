import React from 'react';
import clsx from 'clsx';
import { Icon } from '@grafana/ui';

export const Accordion = ({
  title,
  isExpanded,
  showToggle,
  onToggle,
  children,
}: {
  title: string;
  isExpanded: boolean;
  showToggle: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <div className="border-t border-gray-300 dark:border-gray-600 py-5 px-2">
    {
      <button
        data-testid={`accordion-${title}`}
        onClick={onToggle}
        className="w-full flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-200 mb-2 pl-2 gap-2"
      >
        {showToggle && (isExpanded ? <Icon name="angle-down" /> : <Icon name="angle-right" />)}
        <span className="uppercase font-light">{title}</span>
      </button>
    }

    <div
      className={clsx(
        'overflow-hidden transition-all duration-300 ease-in-out',
        isExpanded ? 'max-h-96 opacity-100 pt-5 pb-2' : 'max-h-0 opacity-0'
      )}
    >
      {children}
    </div>
  </div>
);

export default Accordion;
