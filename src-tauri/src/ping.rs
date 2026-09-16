use serde::{Deserialize, Serialize};
use std::net::ToSocketAddrs;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PingResult {
    pub success: bool,
    pub latency_ms: Option<i64>,
    pub error: Option<String>,
}

/// Measures TCP connect establishment latency to a target host and port.
pub async fn measure_tcp_ping(host: &str, port: u16, timeout_ms: u64) -> PingResult {
    let host = host.to_string();
    let timeout = Duration::from_millis(timeout_ms);

    // Run blocking DNS resolution + TCP connection in Tokio blocking task pool
    let res = tokio::task::spawn_blocking(move || {
        let addr_str = format!("{}:{}", host, port);
        let start = Instant::now();

        // 1. Resolve host
        let addrs = match addr_str.to_socket_addrs() {
            Ok(iter) => iter.collect::<Vec<_>>(),
            Err(e) => {
                return PingResult {
                    success: false,
                    latency_ms: None,
                    error: Some(format!("DNS resolution failed: {}", e)),
                }
            }
        };

        if addrs.is_empty() {
            return PingResult {
                success: false,
                latency_ms: None,
                error: Some("No IP addresses found for host".to_string()),
            };
        }

        // 2. Attempt TCP connect with timeout
        let mut last_err = String::new();
        for addr in addrs {
            match std::net::TcpStream::connect_timeout(&addr, timeout) {
                Ok(_) => {
                    let elapsed = start.elapsed().as_millis() as i64;
                    return PingResult {
                        success: true,
                        latency_ms: Some(elapsed),
                        error: None,
                    };
                }
                Err(e) => {
                    last_err = e.to_string();
                }
            }
        }

        PingResult {
            success: false,
            latency_ms: None,
            error: Some(if last_err.is_empty() {
                "Connection timed out".to_string()
            } else {
                last_err
            }),
        }
    })
    .await;

    match res {
        Ok(result) => result,
        Err(e) => PingResult {
            success: false,
            latency_ms: None,
            error: Some(e.to_string()),
        },
    }
}
