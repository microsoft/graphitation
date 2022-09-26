const webpack = require("webpack");
const fs = require("fs");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { getTransformer } = require("@graphitation/ts-transform-graphql-js-tag");
const {
  annotateDocumentGraphQLTransform,
} = require("@graphitation/supermassive/lib/transforms/annotateDocumentGraphQLTransform.js");
const { buildASTSchema, parse } = require("graphql");

const config: () => Promise<typeof webpack.Configuration> = async () => {
  return {
    devtool: "inline-source-map",
    entry: "./src/index.tsx",
    output: {
      filename: "[name].bundle.js",
      path: path.resolve(__dirname, "dist"),
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: "ts-loader",
          options: {
            transpileOnly: true,
            getCustomTransformers: () => ({
              before: [
                getTransformer({
                  graphqlTagModuleExport: "graphql",
                  transformer: annotateDocumentGraphQLTransform(
                    buildASTSchema(
                      parse(
                        fs.readFileSync("./src/schema/typeDefs.graphql", {
                          encoding: "utf-8",
                        })
                      )
                    )
                  ),
                }),
              ],
            }),
          },
        },
        // This generates AST for the typeDefs.graphql file
        {
          test: /\.graphql$/,
          loader: "webpack-graphql-loader",
          options: {
            output: "document",
          },
        },
      ],
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js"],
    },
    plugins: [new HtmlWebpackPlugin()],
    optimization: {
      // minimize: false,
      splitChunks: {
        chunks: "initial",
      },
    },
  };
};

module.exports = config;
