import { PanelPlugin } from '@grafana/data';
import { TraceViewerPanel } from './components/TraceViewerPanel';
import './styles/tailwind.css';
import { PanelOptions } from './types';

// Allow setting default value via environment variable for local development
// Usage: SUPPORTS_CHILD_COUNT=1 bun run dev
const defaultSupportsChildCount = process.env.SUPPORTS_CHILD_COUNT === '1';

export const plugin = new PanelPlugin<PanelOptions>(TraceViewerPanel).setPanelOptions((builder) => {
  return builder.addBooleanSwitch({
    path: 'supportsChildCount',
    name: 'Enable G-Research Tempo API support',
    description: 'Enable child count support for G-Research custom Tempo API. Disable for standard Grafana Tempo API.',
    defaultValue: defaultSupportsChildCount,
  });
});
