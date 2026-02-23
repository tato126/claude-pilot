#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLIST_NAME="com.tadpolehub.claude-pilot"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

NODE_PATH="$(which node)"
TSX_PATH="${PROJECT_DIR}/node_modules/.bin/tsx"

echo "=== Installing claude-pilot as launchd service ==="
echo "Project: ${PROJECT_DIR}"
echo "Node: ${NODE_PATH}"
echo "tsx: ${TSX_PATH}"

# 기존 서비스 언로드
if launchctl list | grep -q "${PLIST_NAME}" 2>/dev/null; then
  echo "Unloading existing service..."
  launchctl unload "${PLIST_PATH}" 2>/dev/null || true
fi

# plist 생성
mkdir -p "$HOME/Library/LaunchAgents"

cat > "${PLIST_PATH}" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${TSX_PATH}</string>
        <string>${PROJECT_DIR}/src/index.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${PROJECT_DIR}/data/pilot.log</string>
    <key>StandardErrorPath</key>
    <string>${PROJECT_DIR}/data/pilot.error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    </dict>
</dict>
</plist>
EOF

echo "Plist created: ${PLIST_PATH}"

# 서비스 로드
launchctl load "${PLIST_PATH}"
echo "Service loaded."

echo ""
echo "=== Service installed ==="
echo ""
echo "Commands:"
echo "  Start:   launchctl load ${PLIST_PATH}"
echo "  Stop:    launchctl unload ${PLIST_PATH}"
echo "  Logs:    tail -f ${PROJECT_DIR}/data/pilot.log"
echo "  Errors:  tail -f ${PROJECT_DIR}/data/pilot.error.log"
