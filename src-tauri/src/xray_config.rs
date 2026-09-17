use crate::vless::{NetworkType, SecurityType, VlessConfig};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Debug)]
struct InsecureCertCapturingVerifier {
    captured_cert_der: Arc<Mutex<Option<Vec<u8>>>>,
}

impl rustls::client::danger::ServerCertVerifier for InsecureCertCapturingVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        let mut guard = self.captured_cert_der.lock().unwrap();
        *guard = Some(end_entity.as_ref().to_vec());
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        vec![
            rustls::SignatureScheme::RSA_PKCS1_SHA256,
            rustls::SignatureScheme::RSA_PKCS1_SHA384,
            rustls::SignatureScheme::RSA_PKCS1_SHA512,
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            rustls::SignatureScheme::ECDSA_NISTP384_SHA384,
            rustls::SignatureScheme::ECDSA_NISTP521_SHA512,
            rustls::SignatureScheme::RSA_PSS_SHA256,
            rustls::SignatureScheme::RSA_PSS_SHA384,
            rustls::SignatureScheme::RSA_PSS_SHA512,
            rustls::SignatureScheme::ED25519,
        ]
    }
}

/// Probes a remote TLS server and computes the SHA256 hex digest of its leaf certificate.
/// Used to satisfy Xray v26's `pinnedPeerCertSha256` requirement when connecting with decoy SNI.
pub fn probe_peer_cert_sha256(host: &str, port: u16, sni: &str) -> Option<String> {
    println!("[XrayConfig] Probing TLS peer certificate fingerprint for {}:{} (SNI: {})...", host, port, sni);
    let captured = Arc::new(Mutex::new(None));
    let verifier = Arc::new(InsecureCertCapturingVerifier {
        captured_cert_der: Arc::clone(&captured),
    });

    let config = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(verifier)
        .with_no_client_auth();

    let server_name_str = if sni.trim().is_empty() { host } else { sni.trim() };
    let server_name = rustls::pki_types::ServerName::try_from(server_name_str.to_string()).ok()?;

    let addr_str = format!("{}:{}", host, port);
    let addrs: Vec<_> = addr_str.to_socket_addrs().ok()?.collect();
    if addrs.is_empty() {
        return None;
    }

    let mut sock = TcpStream::connect_timeout(&addrs[0], Duration::from_secs(4)).ok()?;
    let _ = sock.set_read_timeout(Some(Duration::from_secs(4)));
    let _ = sock.set_write_timeout(Some(Duration::from_secs(4)));

    let mut conn = rustls::ClientConnection::new(Arc::new(config), server_name).ok()?;

    // Perform TLS handshake to trigger server certificate capture
    let start_probe = std::time::Instant::now();
    while conn.is_handshaking() && start_probe.elapsed() < Duration::from_secs(4) {
        if conn.wants_write() {
            if conn.write_tls(&mut sock).is_err() {
                break;
            }
        }
        if conn.wants_read() {
            match conn.read_tls(&mut sock) {
                Ok(0) => break,
                Ok(_) => {
                    if conn.process_new_packets().is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    }

    let der_opt = captured.lock().unwrap().clone();
    if let Some(der_bytes) = der_opt {
        let mut hasher = Sha256::new();
        hasher.update(&der_bytes);
        let hash = hasher.finalize();
        let hex_hash = hex::encode(hash);
        println!("[XrayConfig] Successfully pinned certificate SHA256: {}", hex_hash);
        return Some(hex_hash);
    }

    println!("[XrayConfig] Warning: Could not extract certificate DER during handshake probe.");
    None
}

/// Helper to encode bytes to hex string
mod hex {
    pub fn encode<T: AsRef<[u8]>>(data: T) -> String {
        let bytes = data.as_ref();
        let mut hex = String::with_capacity(bytes.len() * 2);
        for &b in bytes {
            use std::fmt::Write;
            let _ = write!(hex, "{:02x}", b);
        }
        hex
    }
}

/// Generates Xray-core's native `config.json` content from a VlessConfig.
pub fn generate_xray_config(config: &VlessConfig, socks_port: u16, stats_port: u16) -> Value {
    let network_str = match config.network {
        NetworkType::Tcp => "tcp",
        NetworkType::Ws => "ws",
        NetworkType::Grpc => "grpc",
        NetworkType::Http => "http",
    };

    let ws_path = config.path.as_deref().unwrap_or("/").trim();
    let ws_path_str = if ws_path.is_empty() { "/" } else { ws_path };

    // 1. Build streamSettings based on security type (TLS vs Reality)
    let stream_settings = match config.security {
        SecurityType::Tls => {
            let sni_str = if config.sni.is_empty() { &config.host } else { &config.sni };
            let mut tls_settings = json!({
                "serverName": sni_str,
                "fingerprint": if config.fp.is_empty() { "chrome" } else { &config.fp }
            });

            // If SNI differs from the actual host or allow_insecure is requested,
            // probe and pin the server's certificate SHA-256 fingerprint so Xray v26
            // happily connects without hostname validation mismatch errors!
            if config.allow_insecure || (!config.sni.is_empty() && config.sni != config.host) {
                if let Some(pinned_hash) = probe_peer_cert_sha256(&config.host, config.port, sni_str) {
                    tls_settings["pinnedPeerCertSha256"] = json!(pinned_hash);
                }
            }

            let mut settings = json!({
                "network": network_str,
                "security": "tls",
                "tlsSettings": tls_settings
            });

            // WebSocket transport settings
            if config.network == NetworkType::Ws {
                settings["wsSettings"] = json!({
                    "path": ws_path_str,
                    "headers": {
                        "Host": if config.sni.is_empty() { &config.host } else { &config.sni }
                    }
                });
            }

            settings
        }
        SecurityType::Reality => {
            let mut settings = json!({
                "network": network_str,
                "security": "reality",
                "realitySettings": {
                    "show": false,
                    "serverName": if config.sni.is_empty() { &config.host } else { &config.sni },
                    "fingerprint": if config.fp.is_empty() { "chrome" } else { &config.fp },
                    "publicKey": config.pbk.as_deref().unwrap_or(""),
                    "shortId": config.sid.as_deref().unwrap_or(""),
                    "spiderX": ""
                }
            });

            if config.network == NetworkType::Ws {
                settings["wsSettings"] = json!({
                    "path": ws_path_str,
                    "headers": {
                        "Host": if config.sni.is_empty() { &config.host } else { &config.sni }
                    }
                });
            }

            settings
        }
        SecurityType::None => {
            let mut settings = json!({
                "network": network_str,
                "security": "none"
            });

            if config.network == NetworkType::Ws {
                settings["wsSettings"] = json!({
                    "path": ws_path_str,
                    "headers": {
                        "Host": if config.sni.is_empty() { &config.host } else { &config.sni }
                    }
                });
            }

            settings
        }
    };

    // 2. Build user object for VLESS outbound
    let mut user = json!({
        "id": config.uuid,
        "encryption": if config.encryption.is_empty() { "none" } else { &config.encryption },
        "level": 0
    });

    // If flow is present and not "none", include it (e.g. "xtls-rprx-vision")
    if let Some(ref flow) = config.flow {
        let trimmed = flow.trim();
        if !trimmed.is_empty() && trimmed != "none" {
            user["flow"] = json!(trimmed);
        }
    }

    // 3. Assemble full Xray config object with Remote DNS, tuned buffers and domain sniffing
    json!({
        "log": {
            "loglevel": "warning"
        },
        // Enable Xray-core internal stats engine
        "stats": {},
        "api": {
            "tag": "api",
            "services": [
                "StatsService"
            ]
        },
        "dns": {
            "servers": [
                "https://1.1.1.1/dns-query",
                "https://8.8.8.8/dns-query",
                "1.1.1.1",
                "8.8.8.8"
            ],
            "queryStrategy": "UseIPv4"
        },
        "policy": {
            "levels": {
                "0": {
                    "handshake": 4,
                    "connIdle": 300,
                    "uplinkOnly": 2,
                    "downlinkOnly": 5,
                    "bufferSize": 10240,
                    "statsUserUplink": true,
                    "statsUserDownlink": true
                }
            },
            "system": {
                "statsInboundUplink": true,
                "statsInboundDownlink": true,
                "statsOutboundUplink": true,
                "statsOutboundDownlink": true
            }
        },
        "inbounds": [
            {
                // SOCKS5 inbound: tun2socks forwards captured Wintun packets here
                "tag": "socks-in",
                "port": socks_port,
                "listen": "127.0.0.1",
                "protocol": "socks",
                "settings": {
                    "auth": "noauth",
                    "udp": true
                },
                "sniffing": {
                    "enabled": true,
                    "destOverride": ["http", "tls"],
                    "routeOnly": true
                }
            },
            {
                // Dokodemo-door API inbound: used to query live traffic stats
                "tag": "api-in",
                "port": stats_port,
                "listen": "127.0.0.1",
                "protocol": "dokodemo-door",
                "settings": {
                    "address": "127.0.0.1"
                }
            }
        ],
        "outbounds": [
            {
                "tag": "proxy",
                "protocol": "vless",
                "settings": {
                    "vnext": [
                        {
                            "address": config.host,
                            "port": config.port,
                            "users": [user]
                        }
                    ]
                },
                "streamSettings": stream_settings
            },
            {
                "tag": "dns-out",
                "protocol": "dns"
            },
            {
                "tag": "direct",
                "protocol": "freedom"
            },
            {
                "tag": "block",
                "protocol": "blackhole"
            }
        ],
        "routing": {
            "domainStrategy": "IPIfNonMatch",
            "rules": [
                {
                    "type": "field",
                    "inboundTag": ["api-in"],
                    "outboundTag": "api"
                },
                {
                    "type": "field",
                    "port": "53",
                    "network": "udp,tcp",
                    "outboundTag": "dns-out"
                },
                {
                    "type": "field",
                    "ip": [
                        "geoip:private"
                    ],
                    "outboundTag": "direct"
                }
            ]
        }
    })
}
