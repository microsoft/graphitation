#!/bin/bash

# ForestRun Benchmark Wrapper Script with Configurable Confidence Levels

# Default configuration
CONFIDENCE=95
SHOW_HELP=false
RUN_BENCHMARK=true

help() {
    echo "🚀 ForestRun Performance Benchmarks"
    echo ""
    echo "Usage: yarn benchmark [options]"
    echo "   or: ./benchmarks/performance/benchmark-wrapper.sh [options]"
    echo ""
    echo "Options:"
    echo "  --confidence, -c <level>  Set confidence level (e.g., 90, 95, 99)"
    echo "                           Default: 95%"
    echo "  --help, -h               Show this help message"
    echo ""
    echo "Examples:"
    echo "  yarn benchmark                    # Use default 95% confidence"
    echo "  yarn benchmark --confidence 99   # Use 99% confidence level"
    echo "  yarn benchmark -c 90             # Use 90% confidence level"
    echo ""
    echo "Configuration can also be set in config.json"
    echo ""
    echo "The benchmark system uses configurable confidence levels to calculate"
    echo "statistical measurements with appropriate z-scores:"
    echo "  90% confidence → z = 1.645"
    echo "  95% confidence → z = 1.96 (default)"
    echo "  99% confidence → z = 2.576"
    echo "  99.9% confidence → z = 3.291"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            SHOW_HELP=true
            RUN_BENCHMARK=false
            shift
            ;;
        --confidence|-c)
            CONFIDENCE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            help
            exit 1
            ;;
    esac
done

if [ "$SHOW_HELP" = true ]; then
    help
    exit 0
fi

# Validate confidence level
if ! [[ "$CONFIDENCE" =~ ^[0-9]+$ ]] || [ "$CONFIDENCE" -le 0 ] || [ "$CONFIDENCE" -ge 100 ]; then
    echo "❌ Error: Invalid confidence level '$CONFIDENCE'. Must be between 0 and 100."
    exit 1
fi

echo "🚀 ForestRun Performance Benchmarks"
echo "📊 Configuration:"
echo "   Confidence Level: ${CONFIDENCE}%"

# Update config.json with the specified confidence level
CONFIG_FILE="$(dirname "$0")/config.json"
TEMP_CONFIG=$(mktemp)

# Update the config file to include the confidence level
if [ -f "$CONFIG_FILE" ]; then
    # Use jq if available, otherwise use sed for simple replacement
    if command -v jq &> /dev/null; then
        jq ".confidenceLevel = $CONFIDENCE" "$CONFIG_FILE" > "$TEMP_CONFIG"
        mv "$TEMP_CONFIG" "$CONFIG_FILE"
        echo "   ✅ Updated config.json with confidence level: ${CONFIDENCE}%"
    else
        # Fallback: simple sed replacement
        sed "s/\"confidenceLevel\": [0-9]\+/\"confidenceLevel\": $CONFIDENCE/" "$CONFIG_FILE" > "$TEMP_CONFIG"
        mv "$TEMP_CONFIG" "$CONFIG_FILE"
        echo "   ✅ Updated config.json with confidence level: ${CONFIDENCE}%"
    fi
else
    echo "   ❌ Warning: config.json not found"
fi

if [ "$RUN_BENCHMARK" = true ]; then
    echo ""
    echo "🏃 Running benchmarks with ${CONFIDENCE}% confidence level..."
    echo "   (This will provide statistical measurements with margin of error)"
    echo "   (calculated using the appropriate z-score for ${CONFIDENCE}% confidence)"
    echo ""
    
    # Run the actual benchmark
    cd "$(dirname "$0")/../.."
    node ./benchmarks/performance/index.js "$@"
else
    echo ""
    echo "Use --help to see this message again."
fi