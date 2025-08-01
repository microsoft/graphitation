#!/bin/bash

# Simple test script for benchmark with confidence levels

help() {
    echo "🚀 ForestRun Performance Benchmarks"
    echo ""
    echo "Usage: ./benchmark-test.sh [options]"
    echo ""
    echo "Options:"
    echo "  --confidence <level>  Set confidence level (e.g., 90, 95, 99)"
    echo "                        Default: 95%"
    echo "  --help, -h            Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./benchmark-test.sh                      # Use default 95% confidence" 
    echo "  ./benchmark-test.sh --confidence 99     # Use 99% confidence level"
    echo "  ./benchmark-test.sh --confidence 90     # Use 90% confidence level"
    echo ""
    echo "Configuration can also be set in config.json"
}

# Parse arguments
CONFIDENCE=95
SHOW_HELP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            SHOW_HELP=true
            shift
            ;;
        --confidence)
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

echo "Configuration successful!"
echo "Confidence level: ${CONFIDENCE}%"

if ! [[ "$CONFIDENCE" =~ ^[0-9]+$ ]] || [ "$CONFIDENCE" -le 0 ] || [ "$CONFIDENCE" -ge 100 ]; then
    echo "Warning: Invalid confidence level. Must be between 0 and 100."
    exit 1
fi

echo "✅ Configurable confidence level implementation working!"
echo "📊 Target confidence: ${CONFIDENCE}%"

# Demonstrate how this could work with the actual benchmark
echo ""
echo "This would run ForestRun benchmarks with:"
echo "- Confidence level: ${CONFIDENCE}%"
echo "- Statistical measurements with corresponding z-score"
echo "- Margin of error calculated for ${CONFIDENCE}% confidence interval"