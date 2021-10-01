import * as path from "path";
import * as webpack from "webpack";
import "webpack-dev-server";
import { createWatchNodeQueryTransform } from "@graphitation/apollo-react-relay-duct-tape";

const config: webpack.Configuration = {
  mode: "development",
  entry: "./src/index.tsx",
  devtool: "inline-source-map",
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
        test: /schema\.graphql?$/,
        type: "asset/source",
      },
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          getCustomTransformers: () => ({
            before: [createWatchNodeQueryTransform()],
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
};

export default config;
