# HyperVPN Release & Deployment Guide

This guide details the complete, end-to-end release process for **HyperVPN**. Following these steps ensures consistent, cryptographically-signed production builds (`.exe` NSIS installer and `.msi` Windows installer) that seamlessly integrate with the Tauri v2 native in-app updater.

---

## Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Prerequisites & Environment](#prerequisites--environment)
3. [Standard Step-by-Step Release Process](#standard-step-by-step-release-process)
   - [Step 1: Check Working Tree & Audit Changes](#step-1-check-working-tree--audit-changes)
   - [Step 2: Synchronize Version Across Project Files](#step-2-synchronize-version-across-project-files)
   - [Step 3: Terminate Running Binaries (Avoid File Locks)](#step-3-terminate-running-binaries-avoid-file-locks)
   - [Step 4: Validate Frontend Build](#step-4-validate-frontend-build)
   - [Step 5: Compile Signed Production Binaries with Tauri](#step-5-compile-signed-production-binaries-with-tauri)
   - [Step 6: Generate the `latest.json` Updater Manifest](#step-6-generate-the-latestjson-updater-manifest)
   - [Step 7: Commit Changes and Push to Master](#step-7-commit-changes-and-push-to-master)
   - [Step 8: Create and Push Git Tag](#step-8-create-and-push-git-tag)
   - [Step 9: Create GitHub Release](#step-9-create-github-release)
   - [Step 10: Stream Release Assets to GitHub](#step-10-stream-release-assets-to-github)
   - [Step 11: Verify Release & Manifest](#step-11-verify-release--manifest)
4. [One-Click Automated Release Script](#one-click-automated-release-script)
5. [Troubleshooting & Common Pitfalls](#troubleshooting--common-pitfalls)

---

## Overview & Architecture

HyperVPN uses **Tauri v2** with **Minisign public-key cryptography** for tamper-proof application updates.

```
                    ┌────────────────────────────┐
                    │     Source Code Changes     │
                    └──────────────┬─────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   Frontend (Vite/React/TS)                   Backend (Rust / Tauri v2)
   tsc && vite build                          cargo build --release
              │                                         │
              └────────────────────┬────────────────────┘
                                   ▼
                   Tauri Bundler (NSIS + WiX)
                 + Minisign Cryptographic Signing
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
HyperVPN_x.x.x_x64-setup.exe   HyperVPN_x.x.x_x64_en-US.msi   latest.json
     + .sig signature            + .sig signature          (Tauri Manifest)
       └───────────────────────────┬───────────────────────────┘
                                   ▼
                   GitHub Releases (tag: vx.x.x)
                                   │
                                   ▼
                   Client Native In-App Auto-Updater
```

---

## Prerequisites & Environment

Before building a release, ensure the following tools and environment variables are present:

1. **Rust Toolchain**: `rustc` and `cargo` installed and accessible.
2. **Node.js**: `node` (>= 18) and `npm`.
3. **Packaging Tools**:
   - **NSIS** (`makensis`) installed (e.g., via Chocolatey: `choco install mingw nsis -y`).
   - **WiX Toolset v3** (`candle.exe`, `light.exe`) installed for MSI generation.
4. **GitHub CLI (`gh`)**: Authenticated with release write access (`gh auth login` or `gh auth token`).
5. **Tauri Minisign Private Key**:
   - Path: `src-tauri/hypervpn.key` (or custom absolute path).
   - Password: Empty (`""`) or the key password.

---

## Standard Step-by-Step Release Process

### Step 1: Check Working Tree & Audit Changes

Review all modified, staged, or untracked files:

```bash
git status
git diff
```

Ensure all new features, bug fixes, or performance tuning are complete and ready to be packaged.

---

### Step 2: Synchronize Version Across Project Files

Update the version number (e.g. `2.0.8`) across all configuration files:

1. **`package.json`**:
   ```json
   "version": "2.0.8"
   ```
2. **`package-lock.json`**:
   Update both root `version` fields.
3. **`src-tauri/Cargo.toml`**:
   ```toml
   [package]
   name = "hypervpn"
   version = "2.0.8"
   ```
4. **`src-tauri/tauri.conf.json`**:
   ```json
   "version": "2.0.8"
   ```
5. **`src/components/SettingsTab.tsx`**:
   Update the fallback string:
   ```typescript
   const currentAppVersion = appUpdateInfo?.currentVersion || updateInfo?.currentVersion || "2.0.8";
   ```

Verify all matches with ripgrep:
```bash
grep -n "2.0.8" package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json src/components/SettingsTab.tsx
```

---

### Step 3: Terminate Running Binaries (Avoid File Locks)

On Windows, open handles on `target/release/hypervpn.exe`, `xray.exe`, or `tun2socks.exe` cause `Access is denied (os error 5 / 32)` during compilation.

Kill running instances:

```powershell
powershell -Command "Stop-Process -Name hypervpn, xray, tun2socks -Force -ErrorAction SilentlyContinue; exit 0"
```

---

### Step 4: Validate Frontend Build

Run TypeScript compilation and Vite bundler to catch frontend syntax or type errors:

```bash
npm run build
```

---

### Step 5: Compile Signed Production Binaries with Tauri

Export the Minisign signing key variables and run `tauri build`:

```bash
export TAURI_SIGNING_PRIVATE_KEY="D:\vps\HyperVPN\src-tauri\hypervpn.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npx tauri build
```

This generates:
- `src-tauri/target/release/bundle/nsis/HyperVPN_2.0.8_x64-setup.exe`
- `src-tauri/target/release/bundle/nsis/HyperVPN_2.0.8_x64-setup.exe.sig`
- `src-tauri/target/release/bundle/msi/HyperVPN_2.0.8_x64_en-US.msi`
- `src-tauri/target/release/bundle/msi/HyperVPN_2.0.8_x64_en-US.msi.sig`

---

### Step 6: Generate the `latest.json` Updater Manifest

1. Read the base64 signature from `src-tauri/target/release/bundle/nsis/HyperVPN_2.0.8_x64-setup.exe.sig`.
2. Create/update `src-tauri/target/release/bundle/latest.json`:

```json
{
  "version": "2.0.8",
  "notes": "HyperVPN v2.0.8:\n- Release notes bullet points here",
  "pub_date": "2026-09-17T16:50:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<PASTE_SIGNATURE_FROM_EXE_SIG_FILE>",
      "url": "https://github.com/omeshapasan2/HyperVPN/releases/download/v2.0.8/HyperVPN_2.0.8_x64-setup.exe"
    }
  }
}
```

---

### Step 7: Commit Changes and Push to Master

Stage all modifications and commit with descriptive release notes and attribution:

```bash
git add -A
git commit -m "feat(release): v2.0.8 - summary of changes

- Detailed bullet point 1
- Detailed bullet point 2

Co-Authored-By: Claude Code <noreply@anthropic.com>"
git push origin master
```

---

### Step 8: Create and Push Git Tag

Tag the release commit and push to remote:

```bash
# Delete local and remote tag first if re-releasing
git tag -d v2.0.8 2>/dev/null || true
git push --delete origin v2.0.8 2>/dev/null || true

# Create and push fresh annotated tag
git tag -a v2.0.8 -m "Release v2.0.8"
git push origin v2.0.8
```

---

### Step 9: Create GitHub Release

Create the GitHub release container with notes:

```bash
gh release create v2.0.8 \
  --title "HyperVPN v2.0.8" \
  --notes "### HyperVPN v2.0.8

#### What's New:
- Key feature 1
- Key feature 2

#### Installation:
- Download and run \`HyperVPN_2.0.8_x64-setup.exe\` (Recommended) or \`HyperVPN_2.0.8_x64_en-US.msi\`."
```

---

### Step 10: Stream Release Assets to GitHub

> **Important (Windows TLS/SChannel Fix)**:
> Default `gh release upload` can hit Windows SChannel TLS handshake renegotiation timeouts or abrupt TCP resets against `uploads.github.com`.
> **Always use `curl.exe` with `--http1.1 --tlsv1.2`** for reliable binary streaming.

```bash
TOKEN=$(gh auth token)
RELEASE_ID=$(gh release view v2.0.8 --json databaseId -q .databaseId)

# 1. NSIS Setup Installer
curl.exe -sS --http1.1 --tlsv1.2 -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"D:/vps/HyperVPN/src-tauri/target/release/bundle/nsis/HyperVPN_2.0.8_x64-setup.exe" \
  "https://uploads.github.com/repos/omeshapasan2/HyperVPN/releases/$RELEASE_ID/assets?name=HyperVPN_2.0.8_x64-setup.exe"

# 2. NSIS Setup Signature
curl.exe -sS --http1.1 --tlsv1.2 -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: text/plain" \
  --data-binary @"D:/vps/HyperVPN/src-tauri/target/release/bundle/nsis/HyperVPN_2.0.8_x64-setup.exe.sig" \
  "https://uploads.github.com/repos/omeshapasan2/HyperVPN/releases/$RELEASE_ID/assets?name=HyperVPN_2.0.8_x64-setup.exe.sig"

# 3. MSI Installer
curl.exe -sS --http1.1 --tlsv1.2 -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"D:/vps/HyperVPN/src-tauri/target/release/bundle/msi/HyperVPN_2.0.8_x64_en-US.msi" \
  "https://uploads.github.com/repos/omeshapasan2/HyperVPN/releases/$RELEASE_ID/assets?name=HyperVPN_2.0.8_x64_en-US.msi"

# 4. MSI Signature
curl.exe -sS --http1.1 --tlsv1.2 -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: text/plain" \
  --data-binary @"D:/vps/HyperVPN/src-tauri/target/release/bundle/msi/HyperVPN_2.0.8_x64_en-US.msi.sig" \
  "https://uploads.github.com/repos/omeshapasan2/HyperVPN/releases/$RELEASE_ID/assets?name=HyperVPN_2.0.8_x64_en-US.msi.sig"

# 5. In-App Updater Manifest
curl.exe -sS --http1.1 --tlsv1.2 -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @"D:/vps/HyperVPN/src-tauri/target/release/bundle/latest.json" \
  "https://uploads.github.com/repos/omeshapasan2/HyperVPN/releases/$RELEASE_ID/assets?name=latest.json"
```

---

### Step 11: Verify Release & Manifest

Confirm all 5 assets are published and active:

```bash
gh release view v2.0.8
```

Verify that all assets report `"state": "uploaded"` and are accessible for in-app downloads.

---

## One-Click Automated Release Script

Save this script as `scripts/release.sh` or run directly in Git Bash when releasing a new version:

```bash
#!/usr/bin/env bash
set -e

VERSION="$1"
if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version> (e.g. 2.0.8)"
  exit 1
fi

TAG="v$VERSION"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== 1. Terminating running VPN processes ==="
powershell -Command "Stop-Process -Name hypervpn, xray, tun2socks -Force -ErrorAction SilentlyContinue; exit 0"

echo "=== 2. Building frontend bundle ==="
npm run build

echo "=== 3. Building Tauri release binaries with Minisign signing ==="
export TAURI_SIGNING_PRIVATE_KEY="$REPO_ROOT/src-tauri/hypervpn.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npx tauri build

SIG_FILE="$REPO_ROOT/src-tauri/target/release/bundle/nsis/HyperVPN_${VERSION}_x64-setup.exe.sig"
SIG_CONTENT=$(cat "$SIG_FILE" | tr -d '\r\n')

echo "=== 4. Writing latest.json updater manifest ==="
cat <<EOF > "$REPO_ROOT/src-tauri/target/release/bundle/latest.json"
{
  "version": "$VERSION",
  "notes": "HyperVPN $TAG updates and improvements",
  "pub_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "platforms": {
    "windows-x86_64": {
      "signature": "$SIG_CONTENT",
      "url": "https://github.com/omeshapasan2/HyperVPN/releases/download/$TAG/HyperVPN_${VERSION}_x64-setup.exe"
    }
  }
}
EOF

echo "=== 5. Committing and pushing git changes ==="
git add -A
git commit -m "feat(release): $TAG - production release build

Co-Authored-By: Claude Code <noreply@anthropic.com>" || true
git push origin master

echo "=== 6. Tagging and pushing git tag ==="
git tag -d "$TAG" 2>/dev/null || true
git push --delete origin "$TAG" 2>/dev/null || true
git tag -a "$TAG" -m "Release $TAG"
git push origin "$TAG"

echo "=== 7. Creating GitHub Release ==="
gh release delete "$TAG" --yes 2>/dev/null || true
gh release create "$TAG" --title "HyperVPN $TAG" --notes "HyperVPN $TAG release."

TOKEN=$(gh auth token)
RELEASE_ID=$(gh release view "$TAG" --json databaseId -q .databaseId)

echo "=== 8. Uploading release assets via HTTP/1.1 TLS 1.2 ==="
curl.exe -sS --http1.1 --tlsv1.2 -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @"$REPO_ROOT/src-tauri/target/release/bundle/nsis/HyperVPN_${VERSION}_x64-setup.exe" \
  "https://uploads.github.com/repos/omeshapasan2/HyperVPN/releases/$RELEASE_ID/assets?name=HyperVPN_${VERSION}_x64-setup.exe"

curl.exe -sS --http1.1 --tlsv1.2 -X POST -H "Authorization: token $TOKEN" -H "Content-Type: text/plain" \
  --data-binary @"$SIG_FILE" \
  "https://uploads.github.com/repos/omeshapasan2/HyperVPN/releases/$RELEASE_ID/assets?name=HyperVPN_${VERSION}_x64-setup.exe.sig"

curl.exe -sS --http1.1 --tlsv1.2 -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @"$REPO_ROOT/src-tauri/target/release/bundle/msi/HyperVPN_${VERSION}_x64_en-US.msi" \
  "https://uploads.github.com/repos/omeshapasan2/HyperVPN/releases/$RELEASE_ID/assets?name=HyperVPN_${VERSION}_x64_en-US.msi"

curl.exe -sS --http1.1 --tlsv1.2 -X POST -H "Authorization: token $TOKEN" -H "Content-Type: text/plain" \
  --data-binary @"$REPO_ROOT/src-tauri/target/release/bundle/msi/HyperVPN_${VERSION}_x64_en-US.msi.sig" \
  "https://uploads.github.com/repos/omeshapasan2/HyperVPN/releases/$RELEASE_ID/assets?name=HyperVPN_${VERSION}_x64_en-US.msi.sig"

curl.exe -sS --http1.1 --tlsv1.2 -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" \
  --data-binary @"$REPO_ROOT/src-tauri/target/release/bundle/latest.json" \
  "https://uploads.github.com/repos/omeshapasan2/HyperVPN/releases/$RELEASE_ID/assets?name=latest.json"

echo "=== Release $TAG successfully deployed! ==="
gh release view "$TAG"
```

---

## Troubleshooting & Common Pitfalls

### 1. `Access is denied (os error 5 / 32)`
- **Cause**: An active instance of `hypervpn.exe`, `xray.exe`, or `tun2socks.exe` holds an open file handle on the build target directory.
- **Solution**: Terminate the processes before building:
  ```powershell
  powershell -Command "Stop-Process -Name hypervpn, xray, tun2socks -Force -ErrorAction SilentlyContinue; exit 0"
  ```

### 2. GitHub Upload TLS / SChannel Reset (`curl: (35)` or `(56)`)
- **Cause**: Windows SChannel TLS renegotiation timeout on large binary uploads to `uploads.github.com`.
- **Solution**: Always use `curl.exe` with `--http1.1 --tlsv1.2`.

### 3. Asset in `"starter"` State
- **Cause**: An upload was interrupted before completion. GitHub marks the asset as `starter`, preventing new uploads of the same filename.
- **Solution**: Fetch the asset ID and delete it before re-uploading:
  ```bash
  curl.exe -sS -X DELETE -H "Authorization: token $TOKEN" "https://api.github.com/repos/omeshapasan2/HyperVPN/releases/assets/<ASSET_ID>"
  ```

### 4. `WebView2Loader.dll was not found`
- **Cause**: Missing dynamic link library in installer bundle.
- **Solution**: Ensure `src-tauri/tauri.conf.json` includes the DLL in resources or bundles the MSVC runtime.
