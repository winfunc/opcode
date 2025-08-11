#!/bin/bash
# This script applies the custom ccr-integration patch.
# Run this after pulling the latest changes from the main repository.

set -e

echo "Applying ccr-integration patch..."

# Check if the patch has already been applied
if git apply --check --reverse ccr-integration.patch &> /dev/null; then
    echo "Patch already applied. Nothing to do."
    exit 0
fi

# Apply the patch
git apply --reject --whitespace=fix ccr-integration.patch

echo "✅ Custom CCR integration patch applied successfully."
echo "You may have '.rej' files if there were conflicts. Please resolve them manually."
