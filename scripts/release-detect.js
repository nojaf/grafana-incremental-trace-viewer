import { $ } from 'bun';
import { env } from 'process';
import semver from 'semver';
import { parseArgs } from 'util';
import packageJson from '../package.json';

// This script is meant to run on the main branch to detect if there is a new release needed.
// If there is, it will create a new tag and push it to the origin.
// If there is no new release needed, it will do nothing.

// sanity check, should already be covered by the PR checks.
import './check-version.js';

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    force: { type: 'boolean', multiple: false, short: 'f', default: false },
  },
  strict: true,
  allowPositionals: true,
});

const isCI = env.CI === 'true';
const force = values['force'];
const dryRun = !isCI && !force;
if (dryRun) {
  console.log('Dry run is enabled');
}

const githubReleases = await $`gh release list --json name,tagName,createdAt`.json();
if (githubReleases.length === 0) {
  console.log(`No GitHub releases were found.`);
  // Proceed to create tag
  if (dryRun) {
    console.log(`DRY RUN: creation of tag ${packageJson.version}`);
  } else {
    await $`git tag -a v${packageJson.version} -m "Release v${packageJson.version}"`;
    await $`git push origin v${packageJson.version}`;
    console.log(`Created and pushed first tag v${packageJson.version}`);
  }
  process.exit(0);
} else {
  // check if the latest release is lower than the package.json version
  const latestReleaseVersion = githubReleases
    .map((r) => r.tagName?.replace(/^v/, ''))
    .filter(Boolean)
    .sort(semver.rcompare)[0];
  if (semver.gt(packageJson.version, latestReleaseVersion)) {
    console.log(
      `The version in package.json ${packageJson.version} is greater than the latest release ${latestReleaseVersion}`
    );
    if (dryRun) {
      console.log(`DRY RUN: creation of tag ${packageJson.version}`);
    } else {
      await $`git tag -a v${packageJson.version} -m "Release v${packageJson.version}"`;
      await $`git push origin v${packageJson.version}`;
      console.log(`Created and pushed tag v${packageJson.version}`);
    }
    process.exit(0);
  } else {
    console.log(`No new release needed. Latest GitHub release is ${latestReleaseVersion}`);
    process.exit(0);
  }
}
