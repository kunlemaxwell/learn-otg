#!/bin/zsh
# Double-click to start Learn OTG. The first time, it runs the guided setup.
cd "$(dirname "$0")"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Get the LTS version from https://nodejs.org, then double-click this again."
  open "https://nodejs.org"; read; exit 1
fi
if [ ! -d node_modules ] || [ ! -f .env.local ]; then
  node scripts/setup.mjs
else
  echo "Starting Learn OTG on http://localhost:3000 ..."
  (sleep 8 && open "http://localhost:3000") &
  npm run dev
fi
