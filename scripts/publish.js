import { $ } from 'bun';
import { tmpdir } from 'os';
import { join } from 'path';

const isDryRun = Bun.argv.includes('--dry-run');
const currentDir = import.meta.dirname;
const rootDir = `${currentDir}/..`;

const lastVersion = await $`bunx changelog --latest-release`
  .cwd(rootDir)
  .text()
  .then((v) => v.trim());

const notes = await $`bunx changelog --latest-release-full`
  .cwd(rootDir)
  .text()
  .then((v) => v.trim());

const tag = `v${lastVersion}`;

// Glob for all zip files
const artifacts = Array.from(await glob('*.zip', { cwd: rootDir })).map((f) => join(rootDir, f));

// write notes to a temp file
const notesFile = join(tmpdir(), `release-notes-${lastVersion}.md`);
await Bun.write(notesFile, notes);

if (isDryRun) {
  console.log(`Dry run: Create GitHub release for ${tag}`);
  console.log(`With artifacts: ${artifacts.join(', ')}`);
  console.log(`Notes file: ${notesFile}`);
  console.log(notes);
} else {
  console.log(`Creating GitHub release for ${tag}`);
  await $`gh release create ${tag} ${artifacts} --title ${lastVersion} --notes-file ${notesFile}`.cwd(libraryDir);
  console.log(`Release ${tag} created with ${artifacts.length} artifacts`);
}
