import { $ } from 'bun';
import semver from 'semver';
import packageJson from '../package.json';

// This script is meant to run on the main branch to detect if there is a new release needed.
// If there is need for a new release, it will exit with code 0.
// If there is no need for a new release, it will exit with code 2.
// Unexpected exit codes will be treated as errors.

// sanity check, should already be covered by the PR checks.
import './check-version.js';

const githubReleases = await $`gh release list --json name,tagName,createdAt`.json();
if (githubReleases.length === 0) {
  console.log(`No GitHub releases were found.`);
  // New release needed - exit with code 0 (success) to indicate release should be created
  console.log(`New release needed for version ${packageJson.version}`);
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
    console.log(`New release needed for version ${packageJson.version}`);
    process.exit(0);
  } else {
    console.log(`No new release needed. Latest GitHub release is ${latestReleaseVersion}`);
    process.exit(2);
  }
}
