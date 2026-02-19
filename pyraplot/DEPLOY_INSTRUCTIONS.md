# Deploying PyraPlot to GitHub Pages (Custom Domain)

These instructions guide you through deploying PyraPlot to `https://toolhub.hylix.app/pyraplot`.

## Prerequisites

1.  **Repository**: GitHub repository named `toolhub` containing the `pyraplot` folder.
2.  **Domain**: Access to GoDaddy DNS for `hylix.app`.

## Step 1: Configure Custom Domain in Repository

Ensure a file named `CNAME` exists in the **root** of your repository (outside `pyraplot`). content:
```
toolhub.hylix.app
```

## Step 2: Push Changes to GitHub

Run these commands in your terminal (from the repo root):

```bash
# Navigate to repository root
cd /Users/Helder/Desktop/2026/Hylix/toolhub

# Add all changes (including PyraPlot updates)
git add .
git commit -m "Deploy PyraPlot: gradient fix and Hylix credits"
git push origin main
```

## Step 3: Configure GitHub Pages Settings

1.  Go to your repository on GitHub (e.g., `https://github.com/hylixinsights/toolhub`).
2.  Click **Settings** > **Pages**.
3.  Under **Build and deployment**:
    *   **Source**: `Deploy from a branch`
    *   **Branch**: `main` / `root`
    *   Click **Save**.
4.  Under **Custom domain**:
    *   Enter `toolhub.hylix.app`
    *   Click **Save**.
    *   Check **Enforce HTTPS**.

## Step 4: Configure DNS on GoDaddy

1.  Log in to GoDaddy > DNS Management for `hylix.app`.
2.  Add a **CNAME** record:
    *   **Type**: CNAME
    *   **Name**: `toolhub`
    *   **Value**: `hylixinsights.github.io` (Use your GitHub username/org if different)
    *   **TTL**: Default
3.  Save.

## Step 5: Verification

Your tool should be accessible at:
👉 **https://toolhub.hylix.app/pyraplot**

Ensure the `pyraplot` folder exists in your `main` branch.
