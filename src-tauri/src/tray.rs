use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

/// Sets up the system tray menu and click handlers.
pub fn setup_system_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let status_item = MenuItem::with_id(app, "status", "HyperVPN: Disconnected", false, None::<&str>)?;
    let toggle_item = MenuItem::with_id(app, "toggle_vpn", "Connect", true, None::<&str>)?;
    let show_item = MenuItem::with_id(app, "show_window", "Show HyperVPN", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&status_item, &toggle_item, &show_item, &quit_item])?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("HyperVPN - Fast Native VLESS Client")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show_window" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "toggle_vpn" => {
                // Emit an event to frontend to toggle active connection
                let _ = app.emit("tray-toggle-vpn", ());
            }
            "quit" => {
                // Trigger graceful quit event
                let _ = app.emit("tray-quit-requested", ());
                std::process::exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
