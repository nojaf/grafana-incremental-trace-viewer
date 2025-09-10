import { parser } from 'keep-a-changelog';
import packageJson from '../package.json';
import changelogContent from '../CHANGELOG.md' with { type: 'text' };

const changelog = parser(changelogContent);
const latestRelease = changelog.releases.find((release) => release.date && release.version);

if (!latestRelease) {
  console.log('There is no stable release found in changelog');
  process.exit(0);
}

if (latestRelease.version !== packageJson.version) {
  console.log(
    `The version in package.json ${packageJson.version} is not the same as the version in changelog ${latestRelease.version}`
  );
  process.exit(1);
}
