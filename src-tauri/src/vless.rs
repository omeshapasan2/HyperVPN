use serde::{Deserialize, Serialize};

/// Represents the security layer used for the connection.
/// - "tls": Standard TLS (needs allowInsecure: true for decoy SNI domains).
/// - "reality": XTLS Reality (uses public key pbk, short ID sid, spiderX).
/// - "none": Plain unencrypted connection.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SecurityType {
    Tls,
    Reality,
    None,
}

/// Represents the transport network protocol (default is "tcp").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum NetworkType {
    Tcp,
    Ws,
    Grpc,
    Http,
}

impl Default for NetworkType {
    fn default() -> Self {
        NetworkType::Tcp
    }
}

/// Complete VLESS configuration data model.
/// Matches the JSON stored in `configs.json` and communicated with the React frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VlessConfig {
    pub id: String,
    pub remark: String,
    pub uuid: String,
    pub host: String,
    pub port: u16,
    #[serde(default = "default_encryption")]
    pub encryption: String,
    pub flow: Option<String>,
    #[serde(default)]
    pub network: NetworkType,
    #[serde(default = "default_header_type")]
    pub header_type: String,
    pub security: SecurityType,
    #[serde(default = "default_fp")]
    pub fp: String,
    pub sni: String,
    pub pbk: Option<String>,
    pub sid: Option<String>,
    /// allowInsecure: Required for plain-TLS configs where the SNI is a decoy domain (e.g. netflix.com)
    /// rather than a domain the server holds a CA certificate for.
    #[serde(default)]
    pub allow_insecure: bool,
    #[serde(default)]
    pub raw_original: String,
    pub latency: Option<i64>,
    pub last_tested: Option<i64>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

fn default_encryption() -> String {
    "none".to_string()
}

fn default_header_type() -> String {
    "none".to_string()
}

fn default_fp() -> String {
    "chrome".to_string()
}
