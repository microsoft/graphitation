import webpack from "webpack";
import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";

const config: webpack.Configuration = {
  mode: "development",
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

export default config;
