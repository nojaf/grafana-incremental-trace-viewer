import { PanelPlugin } from '@grafana/data';
import { TraceViewerPanel } from './components/TraceViewerPanel';

export const plugin = new PanelPlugin<{}>(TraceViewerPanel);
