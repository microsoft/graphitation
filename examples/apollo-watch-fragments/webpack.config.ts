import * as path from "path";
import * as webpack from "webpack";
import "webpack-dev-server";
import { createImportDocumentsTransform } from "@graphitation/apollo-react-relay-duct-tape-compiler";

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
    open: {
      app: "Microsoft Edge",
    },
  },
  stats: "minimal",
  module: {
    rules: [
      {
        test: /schema\.graphql?$/,
        type: "asset/source",
      },
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          transpileOnly: true,
          getCustomTransformers: () => ({
            before: [createImportDocumentsTransform()],
          }),
        },
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
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
