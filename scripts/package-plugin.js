import { $ } from 'bun';
import { exists } from 'fs/promises';
import pluginJson from '../src/plugin.json';
import packageJson from '../package.json';

// Build the plugin
await $`bun run build`;
await $`mage`;

// Move the built plugin to the plugin directory
if (!(await exists(`./${pluginJson.id}`))) {
  await $`mkdir ./${pluginJson.id}`;
}
await $`mv ./dist/* ./${pluginJson.id}`;
await $`rm -r ./dist`;

// Zip the plugin
await $`zip -r ${pluginJson.id}-${packageJson.version}.zip ./${pluginJson.id}`;

// Clean up
await $`rm -r ./${pluginJson.id}`;
