import React from 'react';
import { Icon, Modal } from '@grafana/ui';
import ReactMarkdown from 'react-markdown';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'panel-too-small' | 'no-data' | 'general-help';
  currentWidth?: number;
  currentHeight?: number;
}

// Help content configuration
const HELP_CONFIG = {
  'panel-too-small': {
    title: 'Panel Too Small',
    icon: 'expand-arrows-alt',
    color: 'text-white',
    bgColor: 'bg-orange-500',
    file: 'panel-too-small.md',
  },
  'no-data': {
    title: 'No Trace Data Available',
    icon: 'database',
    color: 'text-white',
    bgColor: 'bg-blue-500',
    file: 'no-data.md',
  },
  'general-help': {
    title: 'Trace Viewer Help',
    icon: 'question-circle',
    color: 'text-white',
    bgColor: 'bg-purple-500',
    file: 'general-help.md',
  },
};

// Custom components for react-markdown to match our styling
const markdownComponents = {
  h1: ({ children, ...props }: any) => (
    <h1 className="text-2xl font-bold text-white mb-4 mt-8 pt-8" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-xl font-bold text-white mb-3 mt-6 pt-6" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-lg font-semibold text-white mb-2 mt-4 pt-4" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }: any) => (
    <p className="text-sm text-gray-300 mb-2 mt-2 pt-2" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside mb-3 mt-3" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }: any) => (
    <li className="text-sm text-gray-300" {...props}>
      {children}
    </li>
  ),
  a: ({ children, href, ...props }: any) => (
    <a href={href} className="text-blue-500" target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  code: ({ children, className, ...props }: any) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="text-green-400" {...props}>
          {children}
        </code>
      );
    }
    return (
      <div className="bg-gray-800 rounded p-3 mb-3">
        <code className="text-green-400 text-sm" {...props}>
          {children}
        </code>
      </div>
    );
  },
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="bg-blue-900/20 border-l-4 border-blue-500 pl-4 py-2 mb-3" {...props}>
      <p className="text-sm text-blue-300">{children}</p>
    </blockquote>
  ),
  strong: ({ children, ...props }: any) => (
    <strong className="font-semibold" {...props}>
      {children}
    </strong>
  ),
};

// Process markdown content with variable substitution
const processMarkdownContent = (markdown: string, currentWidth?: number, currentHeight?: number) => {
  return markdown
    .replace('{currentWidth}', currentWidth?.toString() || 'unknown')
    .replace('{currentHeight}', currentHeight?.toString() || 'unknown');
};

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, type, currentWidth, currentHeight }) => {
  const [markdownContent, setMarkdownContent] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);
  const helpConfig = HELP_CONFIG[type];

  // Load markdown content when modal opens
  React.useEffect(() => {
    if (isOpen && helpConfig) {
      setIsLoading(true);
      fetch(`/public/plugins/gresearch-grafanaincrementaltraceviewer-panel/help/${helpConfig.file}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load help content: ${response.statusText}`);
          }
          return response.text();
        })
        .then((content) => {
          setMarkdownContent(content);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error('Error loading help content:', error);
          // Fallback to a simple error message
          setMarkdownContent('# Error Loading Help\n\nUnable to load help content. Please try again later.');
          setIsLoading(false);
        });
    }
  }, [isOpen, type, helpConfig]);

  const processedContent = processMarkdownContent(markdownContent, currentWidth, currentHeight);

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full ${helpConfig.bgColor} flex items-center justify-center`}>
            <Icon name={helpConfig.icon as any} className={`w-4 h-4 ${helpConfig.color}`} />
          </div>
          <span>{helpConfig.title}</span>
        </div>
      }
      className="max-w-4xl"
    >
      <div className="max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-gray-400">Loading help content...</div>
          </div>
        ) : (
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown components={markdownComponents}>{processedContent}</ReactMarkdown>
          </div>
        )}
      </div>
    </Modal>
  );
};
