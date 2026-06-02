import { PanelPlugin } from '@grafana/data';
import { TraceViewerPanel } from './components/TraceViewerPanel';
import './styles/tailwind.css';
import { PanelOptions } from './types';

// The plugin works against both standard Grafana Tempo (>= 2.10, vParquet5) and the
// G-Research custom Tempo API without any user-facing configuration: child counts are
// requested inline via the `span:childCount` intrinsic and the backend's attribute shape
// is detected at runtime. Hence there are no panel options to register.
export const plugin = new PanelPlugin<PanelOptions>(TraceViewerPanel);
