#!/bin/bash
echo ""
echo " Starting AVFlow..."
echo ""

# Check Node is installed
if ! command -v node &> /dev/null; then
  echo " ERROR: Node.js is not installed."
  echo " Download it from https://nodejs.org and re-run this file."
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

# Make this script executable and run from its own directory
cd "$(dirname "$0")"
node serve.js
