# HyperVPN — Fast, Native Desktop VLESS VPN for Windows

<div align="center">
  <h3>Minimal, Native-Feeling Desktop VPN Client with System-Wide TUN Routing & VLESS Reality</h3>
  <p>Built with <strong>Tauri v2 (Rust)</strong> + <strong>React 18 & TypeScript</strong> + <strong>Xray-core</strong> + <strong>Wintun</strong></p>
</div>

---

## 🌟 Overview

**HyperVPN** is a fast, lightweight, and modern desktop VPN client designed specifically for Windows. Unlike browser-proxy or system-proxy-only tools that fail to capture UDP games, command-line utilities, or non-proxy-aware applications, HyperVPN establishes a **virtual Wintun network adapter** to transparently route all outbound system traffic through high-speed VLESS (including XTLS Reality) servers without artificial bandwidth limits.

### Key Highlights
- **VLESS Protocol & XTLS Reality**: Full support for `vless://` share links with direct TLS and XTLS Reality (`flow=xtls-rprx-vision`, SNI, public keys, short IDs).
- **Per-Config Decoy Security (`allowInsecure`)**: Dedicated toggle per server allowing self-signed or mismatch decoy SNI certificates (such as `netflix.com` or `zoom.us`) without breaking TLS connections.
- **System-Wide Wintun TUN Mode**: Uses `wintun.dll` and `tun2socks.exe` to capture all system-wide TCP/UDP traffic at the kernel network layer.
- **Zero-Drop Dual `/1` Routing Architecture**: Non-destructive Windows routing using `0.0.0.0/1` and `128.0.0.0/1` overrides the default gateway via longest prefix matching without deleting `0.0.0.0/0`, guaranteeing 100% immediate fallback on disconnect.
- **Automatic LAN & RFC1918 Exclusions**: Excludes loopback (`127.0.0.0/8`), local subnet, and standard private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`) plus user-defined custom CIDRs so local network devices, printers, and NAS remain reachable.
- **Real-Time Bandwidth & Historical Usage**: Direct polling of Xray-core Stats API (`127.0.0.1:10085`) displaying live upload/download speeds, active session total, and 30-day interactive daily/monthly charts saved to `usage-history.json`.
- **Sub-Millisecond TCP Ping Tester**: Measures true TCP connection latency in parallel across all saved configurations.
- **ISP Usage Verification Tool (SLT & Dialog)**: Independent 2-step before/after verification wizard with cooldown timer to verify that heavy traffic is properly tunneling without consuming domestic ISP quota.
- **System Tray & Autostart Integration**: Background tray menu, minimize-to-tray on close, Windows autostart toggle, and distinct "Auto-connect on launch" setting.

---

## 📐 Architecture & Traffic Flow

```
+-------------------------------------------------------------------+
|                        HyperVPN Desktop App                       |
|                                                                   |
|   React (Vite + TypeScript) Frontend                              |
|   +------------------------------------------------------------+  |
|   | Header: Connect / Disconnect Toggle, Status & Live Speeds  |  |
|   | Tabs: [Configs] [Usage] [Verify VPN] [Settings] [Logs]     |  |
|   +------------------------------------------------------------+  |
|                                 | Tauri IPC (#[tauri::command])   |
|   Rust (Tauri v2) Backend       v                                 |
|   +------------------------------------------------------------+  |
|   | - Process Supervisor (spawns/monitors xray & tun2socks)   |  |
|   | - Windows Routing Engine (Wintun dual /1 + LAN exclusions) |  |
|   | - Stats Collector (queries Xray Stats API -> usage.json)   |  |
|   | - Async TCP Ping Tester (measures connection latency)      |  |
|   | - ISP Verification Engine (SLT & Dialog Selfcare APIs)     |  |
|   | - System Tray & Autostart Manager (Windows Run Registry)   |  |
|   +------------------------------------------------------------+  |
+-------------------------------------------------------------------+
             |                                    |
     (Spawns & Supervises)                (Spawns & Supervises)
             v                                    v
  +-----------------------+            +-----------------------+
  |  xray.exe (Sidecar)   |            | tun2socks.exe Sidecar |
  |  - SOCKS5 @ 127.0.0.1 | <--------- | - Reads Wintun device |
  |  - Dokodemo @ 10085   | (Forward)  | - Writes to SOCKS5    |
  |  - Outbound: VLESS    |            +-----------------------+
  |    (TLS / Reality)    |                        ^
  +-----------------------+                        |
             |                              (Packet Capture)
             v                                     |
      [Remote Server]                    +--------------------+
                                         | Wintun.dll Adapter |
                                         | "HyperVPN-Wintun"  |
                                         +--------------------+
                                                   ^
                                                   | (0.0.0.0/1 & 128.0.0.0/1)
                                         [All System Outbound Traffic]
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **OS**: Windows 10 / 11 (64-bit)
- **Administrator Privileges**: Required to create the Wintun adapter and modify the Windows IP routing table.
- **Node.js**: v18+ and `npm`
- **Rust**: `rustup` with `stable-x86_64-pc-windows-msvc` or `stable-x86_64-pc-windows-gnu`

### 2. Download Core Sidecar Binaries
HyperVPN relies on three core binaries placed in `src-tauri/binaries/` or `binaries/`:
1. `xray.exe` (Xray-core x86_64)
2. `tun2socks.exe` (tun2socks x86_64)
3. `wintun.dll` (Wintun Driver x86_64)

You can download them automatically using the provided PowerShell script:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\download-binaries.ps1
```

Or download manually from official upstream sources:
- **Xray-core**: [XTLS/Xray-core Releases](https://github.com/XTLS/Xray-core/releases)
- **tun2socks**: [xjasonlyu/tun2socks Releases](https://github.com/xjasonlyu/tun2socks/releases)
- **Wintun**: [Wintun.net](https://www.wintun.net/) (extract `wintun/bin/amd64/wintun.dll`)

### 3. Build & Run

#### Install Frontend Dependencies:
```bash
npm install
```

#### Development Mode:
```bash
npm run tauri dev
```

#### Production Build:
```bash
npm run tauri build
```
The compiled installer and standalone executable will be generated in `src-tauri/target/release/`.

---

## 🔗 VLESS Link Formats & Parsing

HyperVPN supports standard `vless://` share URIs:

### 1. XTLS Reality Format
```
vless://<UUID>@<SERVER_IP_OR_HOST>:<PORT>?encryption=none&flow=xtls-rprx-vision&security=reality&sni=<SNI>&fp=chrome&pbk=<PUBLIC_KEY>&sid=<SHORT_ID>&type=tcp&headerType=none#<DISPLAY_NAME>
```

### 2. Standard TLS Format
```
vless://<UUID>@<SERVER_IP_OR_HOST>:<PORT>?encryption=none&security=tls&sni=<SNI>&fp=chrome&type=tcp#<DISPLAY_NAME>
```

### Features:
- **Clipboard One-Click Import**: Paste standard `vless://` strings directly into the Configs tab.
- **Round-Trip Serialization**: Edit any field (UUID, SNI, port, Reality keys, flow) and copy the serialized URI back to clipboard.
- **Decoy SNI Insecure Toggle**: Enable `allowInsecure: true` on configs where the SNI domain is used as a decoy header and does not match the server's certificate.

---

## 🌐 Windows TUN Routing Design

HyperVPN avoids destructive route rewriting. Instead, it uses the **dual `/1` technique**:

```
+---------------------------------------------------------------------------------+
| Destination       Netmask            Gateway              Interface             |
| ----------------- ------------------ -------------------- --------------------- |
| 0.0.0.0           128.0.0.0 ( /1 )   10.0.85.1 (Wintun)   HyperVPN-Wintun       |
| 128.0.0.0         128.0.0.0 ( /1 )   10.0.85.1 (Wintun)   HyperVPN-Wintun       |
| <VPN_SERVER_IP>   255.255.255.255    <PHYSICAL_GATEWAY>   <PHYSICAL_INTERFACE>  |
| 192.168.0.0       255.255.0.0        <PHYSICAL_GATEWAY>   <PHYSICAL_INTERFACE>  |
| 10.0.0.0          255.0.0.0          <PHYSICAL_GATEWAY>   <PHYSICAL_INTERFACE>  |
| 172.16.0.0        255.240.0.0        <PHYSICAL_GATEWAY>   <PHYSICAL_INTERFACE>  |
| 127.0.0.0         255.0.0.0          127.0.0.1            Loopback              |
+---------------------------------------------------------------------------------+
```

1. **Host Route for VPN Server**: Direct `/32` route to the VPN server's physical gateway prevents routing loops.
2. **Longest Prefix Match**: `0.0.0.0/1` and `128.0.0.0/1` cover the entire IPv4 address space and take precedence over the physical `0.0.0.0/0` route without touching it.
3. **LAN Exclusions**: RFC1918 private subnets are explicitly assigned lower metric paths to the physical gateway.
4. **Disconnection Safety**: On disconnect or process exit, HyperVPN simply removes the `/1` routes; normal internet connectivity resumes instantly without network resets.

---

## 🔍 ISP Verification Engine (SLT & Dialog)

HyperVPN includes a dedicated testing tool to confirm that outbound traffic does not consume standard domestic ISP quota:

### Supported Providers:
- **SLT Broadband (Sri Lanka Telecom)**: Queries `https://omniscapp.slt.lk/slt/ext/api/BBVAS/UsageSummary` using your Subscriber ID and JWT token.
- **Dialog Axiata**: Queries `https://dialog.lk/selfcare-proxy?r=usage/get` using your MSISDN, UUID, and session cookie.

### 3-Step Testing Wizard:
1. **Baseline Snapshot**: HyperVPN queries the ISP selfcare portal and records current remaining bytes.
2. **Traffic Test (2-Min Cooldown)**: Stream a 4K video or download a file through HyperVPN.
3. **Verdict & Diff**: HyperVPN queries the ISP portal again and compares balances:
   - **Delta < 50MB (Green)**: Verified! Outbound traffic was completely tunneled through your server.
   - **Delta > 50MB (Yellow)**: Warning: ISP quota decreased. Some traffic may have bypassed the tunnel.

> 🔒 **Security Notice**: Credentials and tokens are stored solely in your local `%APPDATA%/HyperVPN/settings.json` file and are never uploaded to any remote server.

---

## 📁 Project Structure

```
HyperVPN/
├── src/                               # React 18 + TypeScript Frontend
│   ├── components/                    # UI Components
│   │   ├── Header.tsx                 # Top status bar, speeds & connect button
│   │   ├── Navigation.tsx             # Tab bar (Configs, Usage, Verify, Settings, Logs)
│   │   ├── ConfigCard.tsx             # Server card with ping, active badge, edit/delete
│   │   ├── ConfigEditModal.tsx        # Manual config editor & VLESS link importer
│   │   ├── ConfigDeleteModal.tsx      # Safe delete confirmation
│   │   ├── ConfigsTab.tsx             # Server list & batch ping
│   │   ├── UsageTab.tsx               # 30-day interactive SVG bar chart & stats
│   │   ├── VerifyTab.tsx              # ISP verification wizard
│   │   ├── SettingsTab.tsx            # Binary status, autostart, LAN subnets
│   │   └── LogsViewer.tsx             # Real-time stdout/stderr log terminal
│   ├── hooks/                         # Custom React Hooks
│   │   ├── useVpn.ts                  # Connection state, tray events, speed stats
│   │   ├── useConfigs.ts              # Config CRUD, ping tests, active switch
│   │   ├── useUsage.ts                # Daily/monthly history fetch & reset
│   │   ├── useSettings.ts             # App settings & binary checks
│   │   └── useLogs.ts                 # Real-time process log subscription
│   ├── types/                         # TypeScript interfaces
│   │   └── config.ts                  # VlessConfig, AppSettings, VpnStatus, etc.
│   ├── utils/                         # Utilities
│   │   ├── vless.ts                   # VLESS parser, serializer, validator
│   │   └── formatters.ts              # Bytes, speed, latency, time formatters
│   ├── App.tsx                        # Root layout component
│   └── main.tsx                       # React DOM entry
│
├── src-tauri/                         # Rust Backend (Tauri v2)
│   ├── src/
│   │   ├── vless.rs                   # VLESS data models, parser, serializer
│   │   ├── xray_config.rs             # Xray-core JSON configuration generator
│   │   ├── process.rs                 # Sidecar process supervisor (xray, tun2socks)
│   │   ├── routing.rs                 # Windows Wintun TUN & routing table engine
│   │   ├── stats.rs                   # Xray Stats API poller & usage history persistence
│   │   ├── ping.rs                    # Async TCP latency ping tester
│   │   ├── isp.rs                     # SLT & Dialog API verification clients
│   │   ├── storage.rs                 # Local JSON file storage (%APPDATA%/HyperVPN/)
│   │   ├── tray.rs                    # Windows System Tray & context menu
│   │   ├── lib.rs                     # Tauri command handler registrations
│   │   └── main.rs                    # Tauri application entry point
│   ├── Cargo.toml                     # Rust dependencies
│   ├── tauri.conf.json                # Tauri v2 configuration & capabilities
│   └── binaries/                      # Sidecar executable folder (xray, tun2socks, wintun)
│
├── scripts/
│   └── download-binaries.ps1          # Automatic sidecar binary download script
├── package.json                       # Node dependencies & build scripts
├── tsconfig.json                      # TypeScript configuration
├── vite.config.ts                     # Vite build configuration
└── README.md                          # Documentation
```

---

## 🛠️ Troubleshooting

### 1. "Wintun adapter creation failed"
- Make sure you run HyperVPN **as Administrator**. Creating a virtual network adapter on Windows requires elevated privileges.
- Ensure `wintun.dll` is located in `src-tauri/binaries/` or in the same directory as the executable.

### 2. "xray.exe or tun2socks.exe Missing"
- Run `powershell -ExecutionPolicy Bypass -File .\scripts\download-binaries.ps1` to automatically install the latest compatible binaries.
- Check the **Settings** tab inside HyperVPN to verify that all three binaries show the green **Ready** badge.

### 3. "Decoy SNI TLS Handshake Failed"
- If your VLESS server uses a decoy domain with a mismatching TLS certificate (e.g. `netflix.com`), open the config editor in HyperVPN and check **"Allow Insecure Decoy SNI Certs"**.

---

## 📜 License

MIT License — free for personal and commercial use.
