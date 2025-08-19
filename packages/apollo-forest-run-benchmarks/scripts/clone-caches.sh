#!/bin/bash

# Script to set up dual testing environment for apollo-forest-run
# This script builds the local version and downloads the npm version for comparison

set -e

echo "Setting up dual testing environment for apollo-forest-run..."

# Step 1: Build the local apollo-forest-run package
echo "Building local apollo-forest-run package..."
cd /workspaces/graphitation/packages/apollo-forest-run
yarn build

# Step 2: Copy the built lib folder to forest-runs as 'current'
echo "Copying local build to forest-runs/current..."
cd /workspaces/graphitation/packages/apollo-forest-run-benchmarks/src
mkdir -p forest-runs
cd forest-runs
rm -rf current
cp -r /workspaces/graphitation/packages/apollo-forest-run/lib current

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
cd /workspaces/graphitation/packages/apollo-forest-run-benchmarks/src
mkdir -p forest-runs
cd forest-runs
rm -rf baseline
cp -r "$TEMP_DIR/package/lib" baseline

# Cleanup
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

echo "✅ Dual testing environment setup complete!"
echo "- Current repository build: forest-runs/current"
echo "- Latest npm version: forest-runs/baseline"