import { PanelPlugin } from '@grafana/data';
import { TraceViewerPanel } from './components/TraceViewerPanel';
import './styles/tailwind.css';

export const plugin = new PanelPlugin<{}>(TraceViewerPanel);
