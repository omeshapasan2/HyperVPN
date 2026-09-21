use std::net::{Ipv4Addr, ToSocketAddrs};
use std::process::Command;

#[derive(Debug, Clone, Default)]
pub struct GatewayInfo {
    pub gateway_ip: String,
    pub interface_index: Option<u32>,
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[derive(Debug, Copy, Clone)]
struct MibIpForwardRow {
    dw_forward_dest: u32,
    dw_forward_mask: u32,
    dw_forward_policy: u32,
    dw_forward_next_hop: u32,
    dw_forward_if_index: u32,
    dw_forward_type: u32,
    dw_forward_proto: u32,
    dw_forward_age: u32,
    dw_forward_next_hop_as: u32,
    dw_forward_metric1: u32,
    dw_forward_metric2: u32,
    dw_forward_metric3: u32,
    dw_forward_metric4: u32,
    dw_forward_metric5: u32,
}

#[cfg(target_os = "windows")]
#[link(name = "iphlpapi")]
extern "system" {
    fn GetBestRoute(
        dwDestAddr: u32,
        dwSourceAddr: u32,
        pBestRoute: *mut MibIpForwardRow,
    ) -> u32;

    fn GetBestInterface(
        dwDestAddr: u32,
        pdwBestIfIndex: *mut u32,
    ) -> u32;
}

/// Helper to execute a Windows cmd/route/netsh command quietly
pub fn run_cmd(cmd: &str, args: &[&str]) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let output = Command::new(cmd)
            .args(args)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("Failed to execute command '{} {:?}': {}", cmd, args, e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() && !stderr.is_empty() {
            return Ok(format!("{} {}", stdout, stderr));
        }
        Ok(stdout)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new(cmd)
            .args(args)
            .output()
            .map_err(|e| format!("Failed to execute command '{}': {}", cmd, e))?;
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}

/// Retrieves the Windows interface index (Idx) for a given network adapter name.
/// e.g. "HyperVPN-Wintun" -> 20, "Ethernet" -> 25
pub fn get_interface_index(adapter_name: &str) -> Option<u32> {
    let output = run_cmd("netsh", &["interface", "ipv4", "show", "interfaces"]).ok()?;
    for line in output.lines() {
        let line_trimmed = line.trim();
        if line_trimmed.is_empty() || line_trimmed.starts_with("---") || line_trimmed.starts_with("Idx") {
            continue;
        }
        let parts: Vec<&str> = line_trimmed.split_whitespace().collect();
        // Format: Idx Met MTU State Name...
        if parts.len() >= 5 {
            let name = parts[4..].join(" ");
            if name.to_lowercase().contains(&adapter_name.to_lowercase()) {
                if let Ok(idx) = parts[0].parse::<u32>() {
                    return Some(idx);
                }
            }
        }
    }
    None
}

/// Retrieves the interface index for an adapter by its IPv4 address.
pub fn get_interface_index_by_ip(target_ip: &str) -> Option<u32> {
    if let Ok(ip) = target_ip.parse::<Ipv4Addr>() {
        #[cfg(target_os = "windows")]
        unsafe {
            let ip_u32 = u32::from_ne_bytes(ip.octets());
            let mut if_idx: u32 = 0;
            if GetBestInterface(ip_u32, &mut if_idx) == 0 && if_idx > 0 {
                return Some(if_idx);
            }
        }
    }

    // Fallback: search netsh output
    if let Ok(output) = run_cmd("netsh", &["interface", "ipv4", "show", "addresses"]) {
        let mut current_idx: Option<u32> = None;
        for line in output.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("Configuration for interface \"") {
                if let Some(end) = trimmed.rfind('\"') {
                    let name = &trimmed[30..end];
                    current_idx = get_interface_index(name);
                }
            } else if trimmed.contains(target_ip) {
                if let Some(idx) = current_idx {
                    return Some(idx);
                }
            }
        }
    }

    None
}

/// Detects the active physical default gateway IP and interface index on Windows.
/// Uses Windows native IP Helper `GetBestRoute` API (same as Netch) with fallback to `route print 0.0.0.0` metric sorting.
pub fn get_default_gateway() -> Result<GatewayInfo, String> {
    // 1. Primary Method: Native Windows GetBestRoute API (fast, 100% language-independent)
    #[cfg(target_os = "windows")]
    unsafe {
        let probe_ip = u32::from_ne_bytes(Ipv4Addr::new(1, 1, 1, 1).octets());
        let mut row = std::mem::zeroed::<MibIpForwardRow>();
        if GetBestRoute(probe_ip, 0, &mut row) == 0 {
            let next_hop = Ipv4Addr::from(row.dw_forward_next_hop.to_ne_bytes());
            let if_idx = row.dw_forward_if_index;
            let gw_str = next_hop.to_string();

            // If next_hop is non-zero and not Wintun 198.18.x / loopback, return it
            if gw_str != "0.0.0.0" && !gw_str.starts_with("127.") && !gw_str.starts_with("198.18.") {
                println!("[Routing] GetBestRoute detected physical gateway: {} (IF: {})", gw_str, if_idx);
                return Ok(GatewayInfo {
                    gateway_ip: gw_str,
                    interface_index: Some(if_idx),
                });
            }
        }
    }

    // 2. Secondary Method: Parse route print 0.0.0.0 and sort by lowest metric
    if let Ok(output) = run_cmd("route", &["print", "0.0.0.0"]) {
        let mut candidates: Vec<(u32, String, String)> = Vec::new(); // (metric, gw, if_ip)

        for line in output.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            // Standard format: Network Destination Netmask Gateway Interface Metric
            if parts.len() >= 5 && parts[0] == "0.0.0.0" && parts[1] == "0.0.0.0" {
                let gw = parts[2].to_string();
                let if_ip = parts[3].to_string();
                let metric = parts.get(4).and_then(|m| m.parse::<u32>().ok()).unwrap_or(999);

                if gw != "On-link" && gw != "0.0.0.0" && !gw.starts_with("127.") && !gw.starts_with("198.18.") {
                    candidates.push((metric, gw, if_ip));
                }
            }
        }

        // Sort candidates by lowest metric (primary active default route)
        candidates.sort_by_key(|c| c.0);

        if let Some((_, best_gw, best_if_ip)) = candidates.into_iter().next() {
            let if_idx = get_interface_index_by_ip(&best_if_ip);
            println!("[Routing] route print detected best physical gateway: {} (IF IP: {}, IF Idx: {:?})", best_gw, best_if_ip, if_idx);
            return Ok(GatewayInfo {
                gateway_ip: best_gw,
                interface_index: if_idx,
            });
        }
    }

    // 3. Fallback: Parse netsh interface ipv4 show config
    if let Ok(netsh_out) = run_cmd("netsh", &["interface", "ipv4", "show", "config"]) {
        for line in netsh_out.lines() {
            if line.contains("Default Gateway") || line.contains("Standardgateway") {
                if let Some(pos) = line.find(':') {
                    let candidate = line[pos + 1..].trim();
                    if !candidate.is_empty() && candidate != "None" && !candidate.starts_with("198.18.") {
                        return Ok(GatewayInfo {
                            gateway_ip: candidate.to_string(),
                            interface_index: None,
                        });
                    }
                }
            }
        }
    }

    Err("Could not automatically determine physical default gateway".to_string())
}

/// Resolves a host/domain name to an IPv4 string.
pub fn resolve_ipv4(host: &str) -> Option<String> {
    if let Ok(ip) = host.parse::<std::net::Ipv4Addr>() {
        return Some(ip.to_string());
    }

    let socket_str = format!("{}:443", host);
    if let Ok(addrs) = socket_str.to_socket_addrs() {
        for addr in addrs {
            if let std::net::SocketAddr::V4(v4) = addr {
                return Some(v4.ip().to_string());
            }
        }
    }
    None
}

/// Polls for the Wintun adapter to be created and recognized by Windows NDIS
pub fn wait_for_adapter_ready(adapter_name: &str, timeout_secs: u64) -> bool {
    println!("[Routing] Waiting for adapter '{}' to be ready...", adapter_name);
    let start = std::time::Instant::now();
    while start.elapsed() < std::time::Duration::from_secs(timeout_secs) {
        let cmd = format!("netsh interface show interface \"{}\"", adapter_name);
        if let Ok(out) = run_cmd("cmd", &["/c", &cmd]) {
            if !out.contains("not registered") && !out.contains("does not exist") && !out.contains("is not recognized") && (out.contains("Dedicated") || out.contains("Enabled") || out.contains("Connected") || out.contains(adapter_name)) {
                println!("[Routing] Adapter '{}' is ready!", adapter_name);
                return true;
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(300));
    }
    println!("[Routing] Warning: Adapter readiness timed out after {}s", timeout_secs);
    false
}

/// Configures the Wintun network adapter IP, DNS, and metric via netsh
pub fn configure_wintun_adapter(adapter_name: &str, wintun_ip: &str) -> Result<(), String> {
    println!("[Routing] Configuring Wintun adapter '{}' with IP {}...", adapter_name, wintun_ip);

    // 1. Assign static IPv4 address and netmask (255.255.0.0)
    let addr_cmd = format!("netsh interface ip set address name=\"{}\" static {} 255.255.0.0", adapter_name, wintun_ip);
    let addr_res = run_cmd("cmd", &["/c", &addr_cmd])?;
    println!("[Routing] netsh address config result: {}", addr_res.trim());

    // 2. Set MTU to 1420 to prevent packet fragmentation over outer TLS/TCP tunnels
    let mtu_cmd = format!("netsh interface ipv4 set subinterface \"{}\" mtu=1420 store=active", adapter_name);
    let _ = run_cmd("cmd", &["/c", &mtu_cmd]);

    // 3. Set primary DNS to 1.1.1.1 (Cloudflare secure DNS)
    let dns1_cmd = format!("netsh interface ip set dns name=\"{}\" static 1.1.1.1", adapter_name);
    let _ = run_cmd("cmd", &["/c", &dns1_cmd]);

    // 4. Add secondary DNS to 8.8.8.8 (Google secure DNS)
    let dns2_cmd = format!("netsh interface ip add dns name=\"{}\" 8.8.8.8 index=2", adapter_name);
    let _ = run_cmd("cmd", &["/c", &dns2_cmd]);

    // 5. Set interface metric to 1 to prioritize Wintun routing
    let metric_cmd = format!("netsh interface ip set interface name=\"{}\" metric=1", adapter_name);
    let _ = run_cmd("cmd", &["/c", &metric_cmd]);

    Ok(())
}

/// Sets up TUN default routing and LAN/localhost exclusions.
///
/// Strategy (matching Netch high-performance TUN routing):
/// 1. Direct route for the VPN server IP -> Physical Gateway explicitly bound to physical interface (prevents tunnel loop).
/// 2. Direct routes for DNS (1.1.1.1, 1.0.0.1, 8.8.8.8, 8.8.4.4) -> Wintun adapter (forces DNS over tunnel).
/// 3. LAN exclusion routes -> Physical Gateway explicitly bound to physical interface.
/// 4. Pair of /1 routes (0.0.0.0/1 & 128.0.0.0/1) -> Wintun adapter (metric 1, bound with `if <wintun_idx>`).
pub fn setup_tun_routes(
    server_host: &str,
    wintun_ip: &str,
    gateway_ip: &str,
    physical_if_idx: Option<u32>,
    custom_exclusions: &[String],
) -> Result<(), String> {
    let wintun_if_idx = get_interface_index("HyperVPN-Wintun")
        .ok_or_else(|| "Could not find HyperVPN-Wintun network adapter interface index".to_string())?;

    let wintun_if_str = wintun_if_idx.to_string();
    println!(
        "[Routing] Setting up TUN routes (Server: {}, Wintun: {} IF:{}, GW: {} Physical IF:{:?})",
        server_host, wintun_ip, wintun_if_idx, gateway_ip, physical_if_idx
    );

    // 1. Resolve server IP and add direct route through physical gateway with explicit interface binding
    if let Some(server_ip) = resolve_ipv4(server_host) {
        println!("[Routing] Adding direct route for VPN server IP: {} via {} (Physical IF: {:?})", server_ip, gateway_ip, physical_if_idx);
        if let Some(phy_idx) = physical_if_idx {
            let phy_str = phy_idx.to_string();
            let _ = run_cmd("route", &["add", &server_ip, "mask", "255.255.255.255", gateway_ip, "metric", "1", "if", &phy_str]);
        } else {
            let _ = run_cmd("route", &["add", &server_ip, "mask", "255.255.255.255", gateway_ip, "metric", "1"]);
        }
    }

    // 2. Add direct routes for secure DNS through Wintun tunnel
    let _ = run_cmd("route", &["add", "1.1.1.1", "mask", "255.255.255.255", wintun_ip, "metric", "1", "if", &wintun_if_str]);
    let _ = run_cmd("route", &["add", "1.0.0.1", "mask", "255.255.255.255", wintun_ip, "metric", "1", "if", &wintun_if_str]);
    let _ = run_cmd("route", &["add", "8.8.8.8", "mask", "255.255.255.255", wintun_ip, "metric", "1", "if", &wintun_if_str]);
    let _ = run_cmd("route", &["add", "8.8.4.4", "mask", "255.255.255.255", wintun_ip, "metric", "1", "if", &wintun_if_str]);

    // 3. Add LAN exclusions (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
    let default_exclusions = [
        ("10.0.0.0", "255.0.0.0", gateway_ip, "5"),       // Class A private
        ("172.16.0.0", "255.240.0.0", gateway_ip, "5"),   // Class B private
        ("192.168.0.0", "255.255.0.0", gateway_ip, "5"), // Class C private
        ("169.254.0.0", "255.255.0.0", gateway_ip, "5"), // Link-local
    ];

    for (dest, mask, gw, metric) in default_exclusions {
        if let Some(phy_idx) = physical_if_idx {
            let phy_str = phy_idx.to_string();
            let _ = run_cmd("route", &["add", dest, "mask", mask, gw, "metric", metric, "if", &phy_str]);
        } else {
            let _ = run_cmd("route", &["add", dest, "mask", mask, gw, "metric", metric]);
        }
    }

    // Add any user-customized exclusions
    for custom in custom_exclusions {
        if let Some((dest, mask)) = parse_cidr(custom) {
            if let Some(phy_idx) = physical_if_idx {
                let phy_str = phy_idx.to_string();
                let _ = run_cmd("route", &["add", &dest, "mask", &mask, gateway_ip, "metric", "5", "if", &phy_str]);
            } else {
                let _ = run_cmd("route", &["add", &dest, "mask", &mask, gateway_ip, "metric", "5"]);
            }
        }
    }

    // 4. Add Wintun default routes (0.0.0.0/1 and 128.0.0.0/1) explicitly bound to Wintun interface index
    let res1 = run_cmd("route", &["add", "0.0.0.0", "mask", "128.0.0.0", wintun_ip, "metric", "1", "if", &wintun_if_str])?;
    let res2 = run_cmd("route", &["add", "128.0.0.0", "mask", "128.0.0.0", wintun_ip, "metric", "1", "if", &wintun_if_str])?;
    println!("[Routing] 0.0.0.0/1 route add result (IF: {}): {}", wintun_if_str, res1.trim());
    println!("[Routing] 128.0.0.0/1 route add result (IF: {}): {}", wintun_if_str, res2.trim());

    // 5. Flush DNS cache
    let _ = run_cmd("ipconfig", &["/flushdns"]);

    println!("[Routing] TUN routes successfully applied.");
    Ok(())
}

/// Removes TUN routes and restores normal direct routing.
/// Idempotent: safe to call repeatedly or even if connection partially failed.
pub fn cleanup_tun_routes(server_host: &str, custom_exclusions: &[String]) -> Result<(), String> {
    println!("[Routing] Cleaning up TUN routes...");

    // Remove Wintun /1 default routes
    let _ = run_cmd("route", &["delete", "0.0.0.0", "mask", "128.0.0.0"]);
    let _ = run_cmd("route", &["delete", "128.0.0.0", "mask", "128.0.0.0"]);

    // Remove DNS direct routes
    let _ = run_cmd("route", &["delete", "1.1.1.1"]);
    let _ = run_cmd("route", &["delete", "1.0.0.1"]);
    let _ = run_cmd("route", &["delete", "8.8.8.8"]);
    let _ = run_cmd("route", &["delete", "8.8.4.4"]);

    // Remove server IP route
    if !server_host.is_empty() {
        if let Some(server_ip) = resolve_ipv4(server_host) {
            let _ = run_cmd("route", &["delete", &server_ip]);
        }
    }

    // Remove LAN exclusion routes
    let default_exclusions = [
        ("10.0.0.0", "255.0.0.0"),
        ("172.16.0.0", "255.240.0.0"),
        ("192.168.0.0", "255.255.0.0"),
        ("169.254.0.0", "255.255.0.0"),
    ];

    for (dest, mask) in default_exclusions {
        let _ = run_cmd("route", &["delete", dest, "mask", mask]);
    }

    for custom in custom_exclusions {
        if let Some((dest, mask)) = parse_cidr(custom) {
            let _ = run_cmd("route", &["delete", &dest, "mask", &mask]);
        }
    }

    // Flush DNS cache
    let _ = run_cmd("ipconfig", &["/flushdns"]);

    println!("[Routing] Cleanup complete.");
    Ok(())
}

/// Helper to parse CIDR string (e.g. "192.168.10.0/24") into (IP, Netmask)
fn parse_cidr(cidr: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = cidr.trim().split('/').collect();
    if parts.len() != 2 {
        return None;
    }
    let ip = parts[0].trim();
    let prefix: u32 = parts[1].trim().parse().ok()?;
    if prefix > 32 {
        return None;
    }

    let mask_num: u32 = if prefix == 0 { 0 } else { !0u32 << (32 - prefix) };
    let mask_str = format!(
        "{}.{}.{}.{}",
        (mask_num >> 24) & 0xff,
        (mask_num >> 16) & 0xff,
        (mask_num >> 8) & 0xff,
        mask_num & 0xff
    );

    Some((ip.to_string(), mask_str))
}
