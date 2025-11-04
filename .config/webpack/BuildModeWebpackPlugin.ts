import webpack, { type Compiler } from 'webpack';

const PLUGIN_NAME = 'BuildModeWebpack';

export class BuildModeWebpackPlugin {
  apply(compiler: webpack.Compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        async () => {
          const assets = compilation.getAssets();
          for (const asset of assets) {
            if (asset.name.endsWith('plugin.json')) {
              const pluginJsonString = asset.source.source().toString();
              const pluginJson = JSON.parse(pluginJsonString);
              const supportsChildCount = process.env.SUPPORTS_CHILD_COUNT === '1';

              // Append build mode info to description
              const buildModeInfo = supportsChildCount
                ? ' [Built with G-Research Tempo API support]'
                : ' [Built with standard Grafana Tempo API]';

              const pluginJsonWithBuildMode = JSON.stringify(
                {
                  ...pluginJson,
                  buildMode: compilation.options.mode,
                  supportsChildCount: supportsChildCount,
                  info: {
                    ...pluginJson.info,
                    description: pluginJson.info.description + buildModeInfo,
                  },
                },
                null,
                4
              );
              compilation.updateAsset(asset.name, new webpack.sources.RawSource(pluginJsonWithBuildMode));
            }
          }
        }
      );
    });
  }
}
