# How to use the RepairPro test version (Codespaces)

This is a **private test copy** of the CRM that runs on GitHub's computers. It contains **sample (demo) data only**: no real customers, and it cannot send email. Anything you do here is safe to experiment with.

## Starting it

1. Go to the repository on GitHub: **McDowellsSpecialtyRepair/CRM-RepairPro**.
2. Click the green **Code** button, choose the **Codespaces** tab, then **Create codespace on main**.
   - To try a test version Claude has prepared, first pick that branch from the branch menu (top left of the repository page), then create the codespace.
3. Wait while it sets up (about 3–5 minutes the first time). A window that looks like a code editor appears; you can ignore it.
4. Two documents open inside it: this guide and **DEMO-LOGIN.md**, which contains your demo email and password.
5. The CRM opens in a **new browser tab** by itself. If it doesn't, or you closed it: click **Ports** at the bottom of the editor window, find **RepairPro demo (5000)**, and click the small globe icon.
6. Sign in with the email and password from **DEMO-LOGIN.md**. You are the demo Owner, so you can see and change everything.

## Things to know

- **Private:** only you can open the CRM tab, after signing in to GitHub. Never change the port to "Public".
- **Signing in again:** reloading the CRM page signs you out by design; just sign in again. GitHub also asks you to confirm your GitHub sign-in every few hours.
- **On your phone:** while the codespace is running, open the same CRM address in your phone's browser and sign in to GitHub when asked.
- **Stopping:** just close the tabs. The codespace stops itself after 30 minutes of inactivity, and your demo changes are kept for next time.
- **Coming back:** on the repository page, click **Code**, then **Codespaces**, and click the existing codespace to resume it.
- **Free allowance:** GitHub includes a monthly amount of free Codespaces time for your account. When you are finished testing for a while, delete old codespaces (Code, Codespaces, the "…" menu, Delete) so they don't use storage.

## Starting over with fresh sample data

Either delete the codespace and create a new one, or, inside the editor window, open **Terminal** at the top, then **New Terminal**, and type:

```
bash .devcontainer/demo.sh reset
```

then press Enter. When it finishes, open **DEMO-LOGIN.md** again: the password changes after a reset.

## Reporting a problem

Tell Claude in the chat what you did, what you expected and what happened, for example: "On estimate EST-2026-005 I changed the discount and the total did not update." A screenshot helps. Include the estimate, invoice or customer number you were using.
