#!/usr/bin/env bash
# RepairPro private demo for GitHub Codespaces — DEMO DATA ONLY.
#
#   bash .devcontainer/demo.sh setup     install, build, create the demo database and login (first start)
#   bash .devcontainer/demo.sh start     start the demo server (every start of the codespace)
#   bash .devcontainer/demo.sh reset     throw away all demo changes and start again with fresh sample data
#   bash .devcontainer/demo.sh selftest  setup + start + sign-in check, then stop (used by CI)
#   bash .devcontainer/demo.sh status    which code version is checked out, built and running
#   bash .devcontainer/demo.sh logs      show the demo server's request log as it happens
#
# A codespace stops after ~30 minutes without editor or terminal activity; using the CRM in another
# browser tab does not count. The request log is shown in a terminal (postAttachCommand runs "logs"),
# so each CRM request produces terminal output while the codespace window is open.
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
  for _ in $(seq 1 150); do is_up "$1" && { built_commit >"$DEMO_DIR/running-$1"; return 0; }; sleep 0.2; done
  echo "The demo server did not start. Details: $DEMO_DIR/server.log" >&2
  return 1
}

stop_server() { # $1 = port. The server is tagged with its port so only the demo server is stopped.
  pkill -f -- "--repairpro-demo-port=$1" 2>/dev/null || true
  for _ in $(seq 1 50); do is_up "$1" || return 0; sleep 0.2; done
  echo "The demo server on port $1 did not stop." >&2
  return 1
}

BUILD_MARK="$APP/dist/.build-commit"
head_commit() { git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo unknown; }
built_commit() { cat "$BUILD_MARK" 2>/dev/null || echo none; }

build_app() {
  # Development tools are needed to build, so install without NODE_ENV=production.
  (cd "$APP" && env -u NODE_ENV npm ci --no-audit --no-fund && env -u NODE_ENV npm run build)
  head_commit >"$BUILD_MARK"
}

# The checked-out code changed since the last build (for example after syncing a newer version of the
# branch): rebuild, and restart a server that is still running the old build.
rebuild_if_stale() {
  if [ "$(built_commit)" != "$(head_commit)" ] || [ ! -f "$APP/dist/index.cjs" ]; then
    echo "Code version $(head_commit) is checked out but $(built_commit) was built. Rebuilding (2-3 minutes)..."
    stop_server "$PORT"
    build_app
  fi
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
      .then(async r => { if (!r.ok) { console.error(await r.text()); process.exit(1); }
        // Demo staff (sample people only) so salesperson, estimator and follow-up lists have real choices.
        // Service writers use the Service advisor role. They share the demo password.
        const { token } = await r.json(), base = `http://127.0.0.1:${port}`;
        const call = (path, body, auth) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body) })
          .then(async x => { if (!x.ok) throw new Error(path + ": " + await x.text()); return x.json(); });
        for (const [fullName, email, role] of [["Sam Rivera (service writer)", "sam.rivera@example.invalid", "advisor"],
          ["Kelly Brooks (service advisor)", "kelly.brooks@example.invalid", "advisor"], ["Morgan Lee (manager)", "morgan.lee@example.invalid", "manager"]]) {
          const invited = await call("/api/staff", { fullName, email, role }, token);
          await call("/api/auth/activate", { email, activationCode: invited.activationCode, password });
        }
      }).catch(e => { console.error(e.message); process.exit(1); });
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

Other sample staff logins (same password), useful for testing roles and the salesperson lists:

| Name | Work email | Role |
|---|---|---|
| Sam Rivera (service writer) | \`sam.rivera@example.invalid\` | Service advisor |
| Kelly Brooks (service advisor) | \`kelly.brooks@example.invalid\` | Service advisor |
| Morgan Lee (manager) | \`morgan.lee@example.invalid\` | Manager |

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
    rebuild_if_stale
    [ -f "$DB" ] || create_demo
    # A server started from an older build keeps the old code in memory: restart it on the new build.
    if is_up "$PORT" && [ "$(cat "$DEMO_DIR/running-$PORT" 2>/dev/null)" != "$(built_commit)" ]; then
      echo "Restarting the demo server on the new build $(built_commit)..."; stop_server "$PORT"
    fi
    if is_up "$PORT"; then echo "RepairPro demo version $(built_commit) is already running on port $PORT."
    else start_server "$PORT" && echo "RepairPro demo version $(built_commit) is running on port $PORT. Your login is in DEMO-LOGIN.md."; fi
    ;;
  status)
    echo "Checked-out code: $(head_commit)   Built: $(built_commit)   Server on port $PORT: $(is_up "$PORT" && echo "running $(cat "$DEMO_DIR/running-$PORT" 2>/dev/null || echo "unknown version")" || echo NOT running)"
    { [ "$(built_commit)" = "$(head_commit)" ] && { ! is_up "$PORT" || [ "$(cat "$DEMO_DIR/running-$PORT" 2>/dev/null)" = "$(built_commit)" ]; }; } \
      || echo "The demo is not running the checked-out code. Run: bash .devcontainer/demo.sh start"
    ;;
  logs)
    mkdir -p "$DEMO_DIR" && touch "$DEMO_DIR/server.log"
    echo "RepairPro demo request log (keep this terminal open while testing; it keeps the codespace active)."
    exec tail -n 5 -F "$DEMO_DIR/server.log"
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
    # A codespace whose checked-out code is newer than its build must rebuild and restart on start.
    echo stale >"$BUILD_MARK"
    rebuild_if_stale >/dev/null
    start_server "$PORT"
    [ "$(built_commit)" = "$(head_commit)" ] || { echo "Stale build was not rebuilt" >&2; exit 1; }
    echo "Stale-build check passed: rebuilt $(built_commit) and restarted."
    stop_server "$PORT"
    ;;
  *)
    echo "Usage: bash .devcontainer/demo.sh setup|start|reset|selftest|status|logs" >&2
    exit 2
    ;;
esac
