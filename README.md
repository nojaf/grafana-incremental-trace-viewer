# Grafana Incremental Trace Viewer

A Grafana panel plugin for visualizing distributed traces with incremental loading capabilities. This plugin provides an enhanced trace viewing experience with interactive help and user-friendly error handling.

## Features

- **Incremental Trace Loading**: Loads traces progressively for better performance
- **Interactive Help System**: Contextual help modals for common issues
- **User-Friendly Error Handling**: Clear guidance for panel size and data issues
- **Advanced TraceQL Support**: Complex query filtering and search capabilities
- **Real-time Updates**: Live trace data updates
- **Responsive Design**: Adapts to different panel sizes

## Help Documentation

For detailed usage instructions and troubleshooting, see [HELP.md](HELP.md).

## What are Grafana app plugins?

App plugins can let you create a custom out-of-the-box monitoring experience by custom pages, nested data sources and panel plugins.

## Build-time Configuration

The plugin supports build-time configuration through environment variables. Create a `.env` file in the root directory and set the following variables:

- `SUPPORTS_CHILD_COUNT`: Set to `'1'` to enable child count support, `'0'` to disable it. This affects whether the plugin will use `childCount` attributes from the backend. Default is `'false'`.

Example `.env` file:

```bash
SUPPORTS_CHILD_COUNT=0
```

## Get started

### Backend

1. Update [Grafana plugin SDK for Go](https://grafana.com/developers/plugin-tools/key-concepts/backend-plugins/grafana-plugin-sdk-for-go) dependency to the latest minor version:

   ```bash
   go get -u github.com/grafana/grafana-plugin-sdk-go
   go mod tidy
   ```

2. Build backend plugin binaries for Linux, Windows and Darwin:

   ```bash
   mage -v
   ```

3. List all available Mage targets for additional commands:

   ```bash
   mage -l
   ```

### Frontend

1. Install dependencies

   ```bash
   bun install
   ```

2. Build plugin in development mode and run in watch mode

   ```bash
   bun run dev
   ```

3. Build plugin in production mode

   ```bash
   bun run build
   ```

   To build with child count support enabled:

   ```bash
   bun run build:with-child-count
   ```

4. Run the tests (using Jest)

   ```bash
   # Runs the tests and watches for changes, requires git init first
   bun run test

   # Exits after running all the tests
   bun run test:ci
   ```

5. Spin up a Grafana instance and run the plugin inside it (using Docker)

   ```bash
   bun run server
   ```

6. Run the E2E tests (using Playwright)

   ```bash
   # Spins up a Grafana instance first that we tests against
   bun run server

   # If you wish to start a certain Grafana version. If not specified will use latest by default
   GRAFANA_VERSION=11.3.0 bun run server

   # Starts the tests
   bun run e2e
   ```

7. Run the linter

   ```bash
   bun run lint

   # or

   bun run lint:fix
   ```

# Distributing your plugin

When distributing a Grafana plugin either within the community or privately the plugin must be signed so the Grafana application can verify its authenticity. This can be done with the `@grafana/sign-plugin` package.

_Note: It's not necessary to sign a plugin during development. The docker development environment that is scaffolded with `@grafana/create-plugin` caters for running the plugin without a signature._

## Initial steps

Before signing a plugin please read the Grafana [plugin publishing and signing criteria](https://grafana.com/legal/plugins/#plugin-publishing-and-signing-criteria) documentation carefully.

`@grafana/create-plugin` has added the necessary commands and workflows to make signing and distributing a plugin via the grafana plugins catalog as straightforward as possible.

Before signing a plugin for the first time please consult the Grafana [plugin signature levels](https://grafana.com/legal/plugins/#what-are-the-different-classifications-of-plugins) documentation to understand the differences between the types of signature level.

1. Create a [Grafana Cloud account](https://grafana.com/signup).
2. Make sure that the first part of the plugin ID matches the slug of your Grafana Cloud account.
   - _You can find the plugin ID in the `plugin.json` file inside your plugin directory. For example, if your account slug is `acmecorp`, you need to prefix the plugin ID with `acmecorp-`._
3. Create a Grafana Cloud API key with the `PluginPublisher` role.
4. Keep a record of this API key as it will be required for signing a plugin

## Signing a plugin

### Using Github actions release workflow

If the plugin is using the github actions supplied with `@grafana/create-plugin` signing a plugin is included out of the box. The [release workflow](./.github/workflows/release.yml) can prepare everything to make submitting your plugin to Grafana as easy as possible. Before being able to sign the plugin however a secret needs adding to the Github repository.

1. Please navigate to "settings > secrets > actions" within your repo to create secrets.
2. Click "New repository secret"
3. Name the secret "GRAFANA_API_KEY"
4. Paste your Grafana Cloud API key in the Secret field
5. Click "Add secret"

#### Push a version tag

To trigger the workflow we need to push a version tag to github. This can be achieved with the following steps:

1. Run `npm version <major|minor|patch>`
2. Run `git push origin main --follow-tags`

## Learn more

Below you can find source code for existing app plugins and other related documentation.

- [Basic app plugin example](https://github.com/grafana/grafana-plugin-examples/tree/master/examples/app-basic#readme)
- [`plugin.json` documentation](https://grafana.com/developers/plugin-tools/reference/plugin-jsonplugin-json)
- [Sign a plugin](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin)

## Seed data

When running `bun run server` Docker compose will also spin up a OpenSearch instance.

Initially run the index setup script:

```shell
bun run scripts/setup-opensearch.js
```

then run

```shell
bun run scripts/create-depth-trace.js
bun run scripts/create-large-trace.js
```

To create some sample trace data.
Feel free to tweak these scripts to your local needs.

## Install OpenSearch plugin

This should already have been done when launch the `grafana` docker service.
If not:

- Login in as `admin`, pw `admin`
- Install OpenSearch plugin, http://localhost:3000/plugins
- Add new data source:
  - URL: http://opensearch:9200
  - View index name at http://localhost:9200/\_cat/indices?v , is most likely going to be `ss4o_traces-default-namespace`

## Open API

We are using a contract first approach for the Go resource endpoints.
[api.yml](./api.yml) is the source of truth, and you can generate client & server code via:

```shell
bun run generate-api
```

## Styling with Tailwind CSS

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling. Note that Tailwind cannot detect dynamically constructed class names, so we use inline `style` tags for truly dynamic values. For more details, see the [Tailwind CSS documentation on dynamic class names](https://tailwindcss.com/docs/detecting-classes-in-source-files#dynamic-class-names).

## Packaging and installing the plugin

Run `bun run package` to create a plugin zip archive.

```shell
# Install via the grafana cli
./bin/grafana cli -pluginUrl ../gresearch-grafanaincrementaltraceviewer-app-0.1.0.zip plugins install "gresearch-grafanaincrementaltraceviewer-app"
```

Afterward you need to start Grafana, if you are using Docker, just restart the container.
Once that is done, you need to enable the plugin via the UI.
