# How to use the RepairPro test version (Codespaces)

This is a **private test copy** of the CRM that runs on GitHub's computers. It contains **sample (demo) data only**: no real customers, and it cannot send email. Anything you do here is safe to experiment with.

## Starting it

1. Go to the repository on GitHub: **McDowellsSpecialtyRepair/CRM-RepairPro**.
2. Click the green **Code** button, choose the **Codespaces** tab, then **Create codespace on main**.
   - To try a test version Claude has prepared, first pick that branch from the branch menu (top left of the repository page), then create the codespace.
3. Wait while it sets up (about 3–5 minutes the first time). A window that looks like a code editor appears; you can ignore it.
4. Two documents open inside it: this guide and **DEMO-LOGIN.md**, which contains your demo email and password.
5. The CRM opens in a **new browser tab** by itself. If it doesn't, or you closed it: click **Ports** at the bottom of the editor window, find **RepairPro demo (5000)**, and click the small globe icon.
6. Sign in with the email and password from **DEMO-LOGIN.md**. You are the demo Owner, so you can see and change everything. DEMO-LOGIN.md also lists sample staff logins (a service writer, a service advisor and a manager) that share the same password, so the salesperson lists have real choices and you can see what other roles see.

## Before a long testing session (important)

A codespace **stops by itself after 30 minutes without activity in the codespace window**. Clicking around the CRM tab does **not** count as activity. When the codespace stops, the CRM tab may still show its screens, but nothing loads or saves. That causes messages like "Failed to fetch", empty price tables, or "could not reach its server".

To avoid this:
1. **Raise the idle timeout (recommended, do it once):** on GitHub, click your profile picture → **Settings** → **Codespaces** → **Default idle timeout**, enter **240** minutes, and click **Save**. This applies to codespaces created afterward.
2. **Keep the codespace window open.** It now shows a terminal named for the RepairPro demo request log. Each CRM click writes a line there, which counts as activity.

If it happens anyway: go to the codespace tab (restart it if asked), wait about a minute, then reload the CRM tab and sign in again.

## Check that you are testing the right version

At the bottom of the CRM's left-hand menu (open the menu on a phone) you'll see **Version** followed by a short code, for example `Version 1e1bc80`. It should match the latest commit shown on the pull request page.

To check from the codespace: open **Terminal → New Terminal** and type `bash .devcontainer/demo.sh status`. If you synced newer code into an existing codespace, `bash .devcontainer/demo.sh start` rebuilds and restarts the CRM. The codespace also does this by itself each time it starts.

## Things to know

- **Private:** only you can open the CRM tab, after signing in to GitHub. Never change the port to "Public".
- **Signing in again:** reloading the CRM page signs you out by design; just sign in again. GitHub also asks you to confirm your GitHub sign-in every few hours.
- **On your phone:** while the codespace is running, open the same CRM address in your phone's browser and sign in to GitHub when asked.
- **Stopping:** just close the tabs. The codespace stops itself after 30 minutes of inactivity, and your demo changes are kept for next time.
- **Coming back:** on the repository page, click **Code**, then **Codespaces**, and click the existing codespace to resume it.
- **Free allowance:** GitHub includes a monthly amount of free Codespaces time for your account. When you are finished testing for a while, delete old codespaces (Code, Codespaces, the "…" menu, Delete) so they don't use storage.

## Getting the newest changes (keeps your estimates)

When Claude says new changes are ready, go back to your existing codespace (don't create a new one: a new codespace starts with only the sample data). Open **Terminal** at the top, then **New Terminal**, type:

```
bash .devcontainer/demo.sh update
```

and press Enter. Your estimates, customers and other demo entries are kept and your password stays the same. Reload the CRM tab and sign in.

## Starting over with fresh sample data (erases your demo entries)

Only if you want to throw away everything you entered: in the Terminal type

```
bash .devcontainer/demo.sh reset
```

press Enter, then type ERASE when asked. When it finishes, open **DEMO-LOGIN.md** again: the password changes after a reset.

## Reporting a problem

Tell Claude in the chat what you did, what you expected and what happened, for example: "On estimate EST-2026-005 I changed the discount and the total did not update." A screenshot helps. Include the estimate, invoice or customer number you were using.
