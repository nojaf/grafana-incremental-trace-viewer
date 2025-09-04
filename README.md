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

## Known limitations

### Plugin

- If the search endpoint returns duplicate spanIDs, we do not handle them.
- If a single root node has a very large number of children, the plugin will attempt to load all children when it mounts.

### Production API

In production at G-Research, we target a Tempo-compatible API endpoint. The API is Tempo-compatible but uses a custom implementation and a different datastore.

Minor differences:

- The `search` endpoint returns all span attributes, even when they were not requested in traceQL. When opening span details the client performs two requests to obtain all span attributes:

  1. Retrieve all tags via `/search/tags`.
  2. Query the span and use the tags in a `select(...)`.
     The Grafana Tempo API only returns attributes which are part of the `| select(...)` query.
     In production, the server already has these attributes and we do not fetch them again.

- `childCount` is part of the traceQL spec but is not implemented by Grafana Tempo. ([comment](https://github.com/grafana/tempo/issues/5311#issuecomment-3119494111)) This field is supported by the production API.

- In traceQL, `nestedSetParent = -1` is an undocumented feature (but part of the spec) used to find root nodes.
  Ideally, each trace has a single root node; however, when a trace is still in progress, that root node might not yet exist (see partial application spans).
  Our production server detects parentIds that do not yet exist in a trace and treats nodes referencing these _ghost_ parents as root nodes. This impacts performance, but the processing occurs server-side.

- Resource attributes that come from the server are prefixed with `resource.`. Since we have all attributes available, we need a way to tell which ones belong to the resource and which belong to the span. Tempo is a bit odd: if you request `select(resource.serviceAttributeName)`, it will appear on the span as `serviceAttributeName`, but because you requested it in the select you can trace it back to a resource attribute. In production, however, we receive all values without requesting them, so the `resource.` prefix is necessary to identify which attributes are resource attributes.

## API discrepancies

To differentiate between the Grafana Tempo API and the G-Research–flavoured Tempo API, the plugin checks the `SUPPORTS_CHILD_COUNT` environment variable.
Building with `SUPPORTS_CHILD_COUNT=1` results in the runtime behavior described above.

## Testing

We run end-to-end using Playwright and `@grafana/plugin-e2e`.
There are two ways to run the tests, there is setup for when `SUPPORTS_CHILD_COUNT=0` or `SUPPORTS_CHILD_COUNT=1`.
In both cases, we rely on a provisioned Docker compose setup.

**Playwright requires Chromium as a dependency**

```shell
bunx playwright install
```

_Why is this not part of our package.json?_

Chromium cannot be installed in our production environment, so we do not include it as a required dependency in package.json.

### SUPPORTS_CHILD_COUNT = 0

Run `bun run server` to start the regular developer setup.  
Here we shall target the Grafana Tempo API as mentioned in [./docker-compose.yaml].

Run

```shell
bun run build
```

to build a bundle without `SUPPORTS_CHILD_COUNT`.

Next, we need to provision sample data to our Tempo store.
Run

```shell
bun run scripts/e2e-tempo-trace.js
```

The sample data is based on the moon landing and should not be altered unless you are working on e2e tests.

Afterwards all pieces are in place to run the e2e tests:

```shell
bun run e2e
```

### SUPPORTS_CHILD_COUNT = 1

To simulate the production API, we have constructed a different Docker setup in [local-tempo-docker-compose.yml](./local-tempo-docker-compose.yml).
There we also have a `Tempo` service, so from Grafana's point of view nothing will have changed.

Run

```shell
bun run server:local
```

to start our alternative compose.

The Tempo service in Docker is a proxy script that will forward requests from `3200` to a localhost server.
In production, this would be the .NET side of things, for our local setup, we can run:

```shell
bun run tests/test-api.ts
```

Next, build our plugin using `SUPPORTS_CHILD_COUNT=1` via

```shell
bun run build:with-child-count
```

Afterwards, you should be able to run the tests using:

```shell
bun run e2e
```

### Updating the test Trace

In `scripts/e2e-tempo-trace.js`, we have a test scenario.
To ensure we use the same data during `SUPPORTS_CHILD_COUNT=1`.
You can extract the last trace to [tests/test-trace.json](./tests/test-trace.json) via

```shell
bun run scripts/extract-trace.ts
```

**This of course assumes you are running against regular Docker compose and real Tempo!**
