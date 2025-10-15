#!/bin/env bash

echo "Building home..."
cd home
yarn install
yarn build

echo "Building server..."
cd ..
yarn install
yarn build:server

echo "Build complete!"
