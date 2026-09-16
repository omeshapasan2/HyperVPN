# HyperVPN

<div align="center">

![HyperVPN Logo](public/icons/hyper.png)

**Fast, Native VLESS VPN Client for Windows**

A lightweight, high-performance VPN client built with Tauri + React + Rust, featuring WinTun kernel-level tunneling and real-time network monitoring.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D6.svg)](https://www.microsoft.com/windows)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-FFC131.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB.svg)](https://reactjs.org/)
[![Rust](https://img.shields.io/badge/Rust-1.98+-orange.svg)](https://www.rust-lang.org/)

[Download Latest Release](../../releases/latest) | [Features](#features) | [Installation](#installation) | [Documentation](#usage)

</div>

---

## Features

### Core VPN Capabilities
- **VLESS Protocol Support** — Modern, high-performance proxy protocol with WebSocket & TLS transport
- **WinTun Kernel Driver** — Direct kernel-level packet injection for maximum throughput (~500+ Mbps)
- **Zero DNS Leaks** — Route-table manipulation ensures all traffic flows through the VPN tunnel
- **Multi-Server Management** — Import, store, and switch between unlimited VLESS configurations
- **One-Click Connect** — Instant VPN activation with real-time connection status monitoring

### Advanced Features
- **Real-Time Network Monitor** — Live download/upload speeds, session data usage, and connection uptime
- **Multi-Stream Speed Test** — Accurate bandwidth measurement using Cloudflare edge network (5 concurrent streams, 10s+ benchmark)
- **ISP Usage Verification** — Fetch and display real-time data quota from Sri Lanka Telecom API
- **Latency & Jitter Testing** — Automated ping checks with outlier filtering for accurate RTT measurement
- **GeoIP Routing** — Automatic rule-based routing using Xray-core with geolocation databases

### UI & UX
- **Compact Portrait Mode** — Minimalist 390×660px window with vertical navigation rail
- **Monochrome Zinc Theme** — Clean, professional dark UI with subtle gradients
- **System Tray Integration** — Background operation with tray icon for quick access
- **Process Log Viewer** — Real-time Xray and Tun2Socks stdout/stderr capture with filtering
- **Auto-Start Support** — Launch HyperVPN automatically on Windows startup

---

## Installation

### Option 1: MSI Installer (Recommended)
1. Download `HyperVPN_1.0.0_x64_en-US.msi` from [Releases](../../releases/latest)
2. Double-click to install
3. Launch from Start Menu or Desktop shortcut
4. Grant Administrator permissions when prompted (required for WinTun driver)

### Option 2: NSIS Portable Installer
1. Download `HyperVPN_1.0.0_x64-setup.exe`
2. Run the installer and follow the wizard
3. Launch `HyperVPN.exe` from the installation directory

### System Requirements
- **OS:** Windows 10/11 (64-bit)
- **RAM:** 60-100 MB (production build)
- **Disk:** ~50 MB
- **Privileges:** Administrator access required for WinTun driver installation
- **Dependencies:** WebView2 Runtime (auto-installed if missing)

---

## Usage

### Quick Start
1. **Import a VLESS Configuration:**
   - Copy your `vless://` URI
   - Open HyperVPN → **Servers** tab
   - Click **Add Config** → Paste URI → Save
2. **Connect:**
   - Select your server from the list
   - Click the **Connect** button in the header
   - Wait for status to show "Connected" with live speeds
3. **Verify Connection:**
   - Navigate to **Speed** tab to test throughput
   - Or **Verify** tab to check IP geolocation & ISP

### Configuration Format
HyperVPN supports standard VLESS URIs:
```
vless://[uuid]@[host]:[port]?type=ws&security=tls&path=[path]&host=[sni]#[name]
```

Example:
```
vless://a1b2c3d4-e5f6-7890-abcd-ef1234567890@example.com:443?type=ws&security=tls&path=/ws&host=cdn.example.com#MyServer
```

### Tabs Overview
- **Servers** — Manage VLESS configs, ping servers, import/export URIs
- **Usage** — Real-time network statistics (download, upload, session totals)
- **Speed** — Multi-stream bandwidth benchmark (ping, jitter, down/up speeds)
- **Verify** — Check VPN status via IP geolocation and SLT usage API
- **Settings** — Configure binary paths, auto-start, logging preferences
- **Logs** — View Xray-core and Tun2Socks process output with live filtering

---

## Technology Stack

### Frontend
- **Tauri 2.x** — Rust-powered native application framework
- **React 18** — Modern UI component architecture
- **TypeScript** — Type-safe development
- **Tailwind CSS** — Utility-first styling with custom zinc monochrome theme
- **Vite 6** — Lightning-fast development build tooling
- **Lucide React** — Consistent icon library

### Backend (Rust)
- **Xray-core** — High-performance proxy engine (VLESS, VMess, Trojan support)
- **Tun2Socks** — User-space TCP/IP stack for TUN interface
- **WinTun** — Microsoft-endorsed kernel driver for Windows packet injection
- **Tokio** — Async runtime for concurrent network operations
- **Serde** — Serialization framework for config management

### Network Stack
- **Route Table Manipulation** — Direct Windows routing API integration
- **DNS Override** — Automatic DNS resolver configuration (1.1.1.1 / 1.0.0.1)
- **GeoIP Databases** — MaxMind GeoLite2 for rule-based routing
- **WebSocket Transport** — TLS-encrypted WS tunnel to VLESS servers

---

## Building from Source

### Prerequisites
- **Node.js** 18+ and npm
- **Rust** 1.98+ (MSVC or GNU toolchain)
- **MinGW-w64** (if using GNU toolchain)
- **Git**

### Build Steps
```bash
# Clone repository
git clone https://github.com/omeshapasan2/HyperVPN.git
cd HyperVPN

# Install frontend dependencies
npm install

# Build production release
npm run tauri build
```

Output installers will be in:
- MSI: `src-tauri/target/release/bundle/msi/`
- NSIS: `src-tauri/target/release/bundle/nsis/`
- Executable: `src-tauri/target/release/hypervpn.exe`

### Development Mode
```bash
# Run development server with hot-reload
npm run tauri dev
```

---

## Performance Benchmarks

| Metric | Development Build | Production Build |
|--------|-------------------|------------------|
| **WebView2 Memory** | ~144 MB | ~50-70 MB |
| **Native Binary Memory** | ~6.1 MB | ~6-8 MB |
| **Total RAM Usage** | ~150 MB | ~56-78 MB |
| **Throughput (WinTun)** | 460+ Mbps | 460+ Mbps |
| **Binary Size** | N/A | 35.8 MB (standalone) |
| **Installer Size** | N/A | 23.7 MB (NSIS) / 34.9 MB (MSI) |

*Benchmarked on Windows 11 Pro 26200 with 500 Mbps fiber connection*

---

## Security & Privacy

- **No Telemetry** — Zero data collection or analytics
- **Local Storage Only** — All configurations stored locally in `AppData\Roaming\com.hypervpn.app`
- **Open Source** — Full transparency, audit the code yourself
- **No Built-in Servers** — Bring your own VLESS server (BYOS model)
- **Memory Safety** — Rust's ownership system prevents buffer overflows and memory leaks

---

## Known Issues & Limitations

- **Windows Only** — macOS and Linux support planned for future releases
- **VLESS Protocol** — Currently only supports VLESS; VMess/Trojan support coming soon
- **Single Instance** — Cannot run multiple VPN connections simultaneously
- **Admin Required** — WinTun driver requires elevated permissions (one-time installation)

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style (Prettier for TS/React, `rustfmt` for Rust)
- Write meaningful commit messages (conventional commits preferred)
- Test thoroughly before submitting PR
- Update documentation for new features

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- **[Xray-core](https://github.com/XTLS/Xray-core)** — Proxy engine powering HyperVPN
- **[Tun2Socks](https://github.com/xjasonlyu/tun2socks)** — User-space TCP/IP stack
- **[WinTun](https://www.wintun.net/)** — High-performance Windows TUN driver by WireGuard
- **[Tauri](https://tauri.app/)** — Rust-powered native app framework
- **[Cloudflare Speed Test](https://speed.cloudflare.com/)** — Global edge network for bandwidth benchmarks

---

## Support & Contact

- **Issues:** [GitHub Issues](../../issues)
- **Discussions:** [GitHub Discussions](../../discussions)
- **Developer:** [@omeshapasan2](https://github.com/omeshapasan2)

---

<div align="center">

**Built with Tauri, React, and Rust**

**Star this repository if HyperVPN helps you stay connected!**

</div>
