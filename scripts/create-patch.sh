#!/bin/bash
# This script updates the ccr-integration.patch file from the ccr-integration branch.
# Run this if you make new commits on the ccr-integration branch and want to update the patch.

set -e

# Ensure we are on the correct branch
git checkout ccr-integration

echo "Creating patch from 'ccr-integration' branch..."

git format-patch main --stdout > ../ccr-integration.patch

echo "✅ Patch file 'ccr-integration.patch' updated successfully in the root directory."
