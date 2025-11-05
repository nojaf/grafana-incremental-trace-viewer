import { PanelPlugin } from '@grafana/data';
import { TraceViewerPanel } from './components/TraceViewerPanel';
import './styles/tailwind.css';
import { PanelOptions } from './types';

// Allow setting default value via environment variable for local development
// Default is true (child count enabled). Set SUPPORTS_CHILD_COUNT=0 to disable.
// Usage: SUPPORTS_CHILD_COUNT=0 bun run dev
// Note: webpack DefinePlugin replaces process.env.SUPPORTS_CHILD_COUNT with a boolean literal (true or false)
const defaultSupportsChildCount = process.env.SUPPORTS_CHILD_COUNT as unknown as boolean;

export const plugin = new PanelPlugin<PanelOptions>(TraceViewerPanel).setPanelOptions((builder) => {
  return builder.addBooleanSwitch({
    path: 'supportsChildCount',
    name: 'Enable G-Research Tempo API support',
    description: 'Enable child count support for G-Research custom Tempo API. Disable for standard Grafana Tempo API.',
    defaultValue: defaultSupportsChildCount, // Default is true (child count enabled)
  });
});
