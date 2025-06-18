import pluginJson from './plugin.json';

export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;
export const BASE_URL = `/api/plugins/${pluginJson.id}/resources`;

export enum ROUTES {
  Traces = 'traces',
  TraceDetails = 'trace-details',
}
