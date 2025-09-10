import { $ } from 'bun';
import { exists } from 'fs/promises';
import pluginJson from '../src/plugin.json';
import packageJson from '../package.json';

const isSigned = Bun.argv.includes('--signed');

// Move the built plugin to the plugin directory
if (!(await exists(`./${pluginJson.id}`))) {
  await $`mkdir ./${pluginJson.id}`;
}

// Copy current dist into a staging folder named after plugin id
await $`cp -r ./dist/* ${stagingDir}/`;

// Zip the plugin
await $`zip -r ${pluginJson.id}-${packageJson.version}${isSigned ? '-signed' : ''}.zip ./${pluginJson.id}`;

// Clean up
await $`rm -r ./${pluginJson.id}`;
