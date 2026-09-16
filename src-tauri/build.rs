fn main() {
    let mut attrs = tauri_build::Attributes::new();
    #[cfg(target_os = "windows")]
    {
        attrs = attrs.windows_attributes(
            tauri_build::WindowsAttributes::new().app_manifest(include_str!("app.manifest")),
        );
    }
    tauri_build::try_build(attrs).expect("failed to run tauri-build");

    // Copy WebView2Loader.dll alongside binary if available
    #[cfg(target_os = "windows")]
    {
        let out_dir = std::env::var("OUT_DIR").unwrap_or_default();
        if !out_dir.is_empty() {
            let src = std::path::Path::new("binaries/WebView2Loader.dll");
            if src.exists() {
                // Try copying to target dirs
                let out_path = std::path::Path::new(&out_dir);
                if let Some(target_dir) = out_path.ancestors().nth(3) {
                    let dest = target_dir.join("WebView2Loader.dll");
                    let _ = std::fs::copy(src, dest);
                }
            }
        }
    }
}
