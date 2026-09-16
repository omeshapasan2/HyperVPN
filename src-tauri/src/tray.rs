use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

pub struct TrayMenuState<R: Runtime> {
    pub status_item: MenuItem<R>,
    pub toggle_item: MenuItem<R>,
}

/// Updates the tray icon status label, toggle label, and tooltip.
pub fn update_tray_status<R: Runtime>(
    app: &AppHandle<R>,
    connected: bool,
    config_remark: Option<&str>,
) {
    if let Some(tray_state) = app.try_state::<TrayMenuState<R>>() {
        let status_text = if connected {
            if let Some(remark) = config_remark {
                format!("HyperVPN: Connected ({})", remark)
            } else {
                "HyperVPN: Connected".to_string()
            }
        } else {
            "HyperVPN: Disconnected".to_string()
        };
        let toggle_text = if connected { "Disconnect" } else { "Connect" };
        let _ = tray_state.status_item.set_text(status_text);
        let _ = tray_state.toggle_item.set_text(toggle_text);
    }

    if let Some(tray) = app.tray_by_id("main-tray") {
        let tooltip = if connected {
            if let Some(remark) = config_remark {
                format!("HyperVPN - Connected ({})", remark)
            } else {
                "HyperVPN - Connected".to_string()
            }
        } else {
            "HyperVPN - Disconnected".to_string()
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

/// Sets up the system tray menu and click handlers.
pub fn setup_system_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let status_item = MenuItem::with_id(app, "status", "HyperVPN: Disconnected", false, None::<&str>)?;
    let toggle_item = MenuItem::with_id(app, "toggle_vpn", "Connect", true, None::<&str>)?;
    let show_item = MenuItem::with_id(app, "show_window", "Show HyperVPN", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&status_item, &toggle_item, &show_item, &quit_item])?;

    // Store menu items in app state so they can be updated dynamically
    app.manage(TrayMenuState {
        status_item: status_item.clone(),
        toggle_item: toggle_item.clone(),
    });

    // Resolve icon: prefer default window icon from bundle, fallback to compiled 32x32 icon
    let icon = if let Some(w_icon) = app.default_window_icon() {
        w_icon.clone()
    } else {
        tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
            .map_err(|e| format!("Failed to load embedded tray icon: {}", e))?
    };

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
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
