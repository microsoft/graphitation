import * as path from "path";
import * as webpack from "webpack";
import "webpack-dev-server";

const config: webpack.Configuration = {
  mode: "development",
  entry: "./src/index.tsx",
  devtool: false,
  devServer: {
    static: "./public",
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
  },
  stats: "minimal",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          transpileOnly: true,
        },
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    // Allow resolving from src directory
    modules: [path.resolve(__dirname, "src"), "node_modules"],
    // Alias to use source files directly for reload
    alias: {
      "@graphitation/apollo-forest-run": path.resolve(
        __dirname,
        "../../packages/apollo-forest-run/src",
      ),
    },
  },
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "public"),
  },
  plugins: [
    /**
     * Configure source-maps to use absolute file:// paths, so tooling like React Render Tracker
     * does not need (user) specific configuration.
     *
     * NOTE: You would only want to do this in a dev env -- which this example app always is.
     */
    new webpack.SourceMapDevToolPlugin({
      // Set absolute path to source root of this repo
      sourceRoot: path.resolve(__dirname, "../.."),
      // Override template to replace the webpack:// protocol with file:// (and remove namespace)
      moduleFilenameTemplate: "file://[resource-path]?[loaders]",
    }),
  ],
};

export default config;
