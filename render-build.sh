#!/usr/bin/env sh
set -eu

if [ -z "${MAPBOX_ACCESS_TOKEN:-}" ]; then
  echo "MAPBOX_ACCESS_TOKEN is missing"
  exit 1
fi

rm -rf public
mkdir -p public

cp index.html styles.css app.js app-config.js public/
cp -R data assets public/

cat > public/config.js <<EOF
window.MAPBOX_CONFIG = {
  accessToken: "${MAPBOX_ACCESS_TOKEN}"
};
EOF

echo "Build complete:"
find public -maxdepth 2 -type f | sort
