#!/usr/bin/env bash
# RepairPro private demo for GitHub Codespaces — DEMO DATA ONLY.
#
#   bash .devcontainer/demo.sh setup     install, build, create the demo database and login (first start)
#   bash .devcontainer/demo.sh start     start the demo server (every start of the codespace)
#   bash .devcontainer/demo.sh reset     throw away all demo changes and start again with fresh sample data
#   bash .devcontainer/demo.sh selftest  setup + start + sign-in check, then stop (used by CI)
#
# The database lives in DEMO_DIR, outside the repository, and is always a brand-new sample
# database created by `db:seed-demo`. This script never reads DB_PATH, never touches a real
# database, and clears email credentials so nothing can be sent.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$REPO/app"
DEMO_DIR="${DEMO_DIR:-/workspaces/.repairpro-demo}"
DB="$DEMO_DIR/demo.db"
PORT="${DEMO_PORT:-5000}"
SETUP_PORT=$((PORT + 1))
LOGIN_FILE="$REPO/DEMO-LOGIN.md"
OWNER_EMAIL="demo.owner@example.invalid"

export NODE_ENV=production HOST=127.0.0.1
export SMTP_HOST="" SMTP_USER="" SMTP_PASS="" BACKUP_ENCRYPTION_KEY=""
unset DB_PATH TRUST_PROXY || true

is_up() { curl -fs "http://127.0.0.1:$1/api/auth/status" >/dev/null 2>&1; }

start_server() { # $1 = port
  mkdir -p "$DEMO_DIR"
  (cd "$APP" && DB_PATH="$DB" EMAIL_OUTPUT_DIR="$DEMO_DIR/emails" PORT="$1" \
    setsid -f nohup node dist/index.cjs "--repairpro-demo-port=$1" >>"$DEMO_DIR/server.log" 2>&1 </dev/null)
  for _ in $(seq 1 150); do is_up "$1" && return 0; sleep 0.2; done
  echo "The demo server did not start. Details: $DEMO_DIR/server.log" >&2
  return 1
}

stop_server() { # $1 = port. The server is tagged with its port so only the demo server is stopped.
  pkill -f -- "--repairpro-demo-port=$1" 2>/dev/null || true
  for _ in $(seq 1 50); do is_up "$1" || return 0; sleep 0.2; done
  echo "The demo server on port $1 did not stop." >&2
  return 1
}

build_app() {
  # Development tools are needed to build, so install without NODE_ENV=production.
  (cd "$APP" && env -u NODE_ENV npm ci --no-audit --no-fund && env -u NODE_ENV npm run build)
}

create_demo() {
  mkdir -p "$DEMO_DIR" && chmod 700 "$DEMO_DIR"
  (cd "$APP" && env -u NODE_ENV DB_PATH="$DB" npx tsx script/seed-demo.ts)
  (cd "$APP" && DB_PATH="$DB" npx tsx script/bootstrap-owner.ts "$OWNER_EMAIL" "$DEMO_DIR/invite.json" >/dev/null)
  # Activate the demo owner through the app itself, with a password generated for this codespace.
  start_server "$SETUP_PORT"
  local password
  password="Demo-$(node -e 'process.stdout.write(require("crypto").randomBytes(12).toString("base64url"))')"
  node -e '
    const [port, email, inviteFile, password] = process.argv.slice(1);
    const { activationCode } = JSON.parse(require("fs").readFileSync(inviteFile, "utf8"));
    fetch(`http://127.0.0.1:${port}/api/auth/activate`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, activationCode, password }) })
      .then(async r => { if (!r.ok) { console.error(await r.text()); process.exit(1); } });
  ' "$SETUP_PORT" "$OWNER_EMAIL" "$DEMO_DIR/invite.json" "$password"
  stop_server "$SETUP_PORT"
  rm -f "$DEMO_DIR/invite.json"
  (umask 077 && cat >"$LOGIN_FILE" <<EOF
# Your RepairPro demo login

**Demo data only.** This login works only in this private codespace's sample database.

| | |
|---|---|
| Work email | \`$OWNER_EMAIL\` |
| Password | \`$password\` |

1. Open the CRM: it usually opens in a new browser tab by itself. If not, click the **Ports** tab
   at the bottom of this window, find **RepairPro demo (5000)**, and click the globe icon.
2. Sign in with the email and password above (role: Owner, so you can see everything).
3. Reloading the page signs you out (by design); just sign in again.

To start over with fresh sample data, see "Starting over" in HOW-TO-USE-THE-DEMO.md.
EOF
  )
}

case "${1:-}" in
  setup)
    build_app
    [ -f "$DB" ] || create_demo
    ;;
  start)
    [ -f "$DB" ] || create_demo
    if is_up "$PORT"; then echo "RepairPro demo is already running on port $PORT."
    else start_server "$PORT" && echo "RepairPro demo is running on port $PORT. Your login is in DEMO-LOGIN.md."; fi
    ;;
  reset)
    case "$DEMO_DIR" in *demo*) ;; *) echo "Refusing to reset: DEMO_DIR does not look like a demo folder." >&2; exit 1 ;; esac
    stop_server "$PORT"
    rm -rf "$DEMO_DIR" "$LOGIN_FILE"
    create_demo
    start_server "$PORT"
    echo "Fresh demo data is ready. Your NEW login is in DEMO-LOGIN.md. Reload the CRM tab and sign in again."
    ;;
  selftest)
    build_app
    [ -f "$DB" ] || create_demo
    start_server "$PORT"
    password="$(grep -o 'Demo-[A-Za-z0-9_-]*' "$LOGIN_FILE" | head -1)"
    node -e '
      const [port, email, password] = process.argv.slice(1), base = `http://127.0.0.1:${port}`;
      (async () => {
        const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
        if (!login.ok) throw new Error("demo login failed: " + login.status);
        const { token } = await login.json();
        const customers = await (await fetch(base + "/api/customers", { headers: { Authorization: "Bearer " + token } })).json();
        const page = await fetch(base + "/");
        if (!Array.isArray(customers) || customers.length < 5) throw new Error("demo customers missing");
        if (!page.ok || !(page.headers.get("content-security-policy") || "").includes("script-src")) throw new Error("app page not served");
        console.log(`Demo self-test passed: signed in, ${customers.length} sample customers, app page served.`);
      })().catch(e => { console.error(e.message); process.exit(1); });
    ' "$PORT" "$OWNER_EMAIL" "$password"
    stop_server "$PORT"
    ;;
  *)
    echo "Usage: bash .devcontainer/demo.sh setup|start|reset|selftest" >&2
    exit 2
    ;;
esac
