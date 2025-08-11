#!/bin/bash
# This script acts as a bridge between Claudia and the ccr tool.
# It takes all arguments passed to it and forwards them to "ccr code".
/home/sedinha/.nvm/versions/node/v20.18.2/bin/ccr code "$@"
