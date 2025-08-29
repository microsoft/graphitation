#!/bin/bash

# Script to set up dual testing environment for apollo-forest-run
# This script builds the local version and downloads the npm version for comparison

set -e

echo "Setting up dual testing environment for apollo-forest-run..."

# Get the script directory and calculate relative paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BENCHMARKS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APOLLO_FOREST_RUN_DIR="$(cd "$BENCHMARKS_DIR/../apollo-forest-run" && pwd)"

# Step 1: Build the local apollo-forest-run package
echo "Building local apollo-forest-run package..."
cd "$APOLLO_FOREST_RUN_DIR"
yarn build

# Step 2: Copy the built lib folder to forest-runs as 'current'
echo "Copying local build to forest-runs/current..."
cd "$BENCHMARKS_DIR"
mkdir -p forest-runs
cd forest-runs
rm -rf current
cp -r "$APOLLO_FOREST_RUN_DIR/lib" current

# Step 3: Download and extract the latest version from npmjs
echo "Downloading latest version from npmjs..."
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Get the latest version and download it
echo "Fetching latest version from npm..."
npm pack @graphitation/apollo-forest-run@latest

# Extract the tarball
echo "Extracting npm package..."
tar -xzf graphitation-apollo-forest-run-*.tgz

# Copy the lib folder from npm package to forest-runs/baseline (replacing existing if any)
echo "Copying npm version to forest-runs/baseline..."
cd "$BENCHMARKS_DIR"
cd forest-runs
rm -rf baseline
cp -r "$TEMP_DIR/package/lib" baseline

# Cleanup
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

echo "✅ Dual testing environment setup complete!"
echo "- Current repository build: forest-runs/current"
echo "- Latest npm version: forest-runs/baseline"