use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

pub struct TrayMenuState<R: Runtime> {
    pub status_item: MenuItem<R>,
    pub toggle_item: MenuItem<R>,
    pub show_hide_item: MenuItem<R>,
}

/// Updates the tray icon status label, toggle label, show/hide label, and tooltip.
pub fn update_tray_menu<R: Runtime>(app: &AppHandle<R>) {
    let window_exists = app.get_webview_window("main").is_some();

    let (connected, remark) = if let Some(state) = app.try_state::<crate::AppState>() {
        let connected = state.process_manager.is_connected();
        let remark = state.process_manager.get_active_config_remark();
        (connected, remark)
    } else {
        (false, None)
    };

    if let Some(tray_state) = app.try_state::<TrayMenuState<R>>() {
        let status_text = if connected {
            if let Some(ref remark_str) = remark {
                format!("HyperVPN: Connected ({})", remark_str)
            } else {
                "HyperVPN: Connected".to_string()
            }
        } else {
            "HyperVPN: Disconnected".to_string()
        };
        let toggle_text = if connected { "Disconnect" } else { "Connect" };
        let show_hide_text = if window_exists {
            "Hide HyperVPN"
        } else {
            "Show HyperVPN"
        };

        let _ = tray_state.status_item.set_text(status_text);
        let _ = tray_state.toggle_item.set_text(toggle_text);
        let _ = tray_state.show_hide_item.set_text(show_hide_text);
    }

    if let Some(tray) = app.tray_by_id("main-tray") {
        let tooltip = if connected {
            if let Some(ref remark_str) = remark {
                format!("HyperVPN - Connected ({})", remark_str)
            } else {
                "HyperVPN - Connected".to_string()
            }
        } else {
            "HyperVPN - Disconnected".to_string()
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

/// Backward compatibility alias for update_tray_menu
pub fn update_tray_status<R: Runtime>(
    app: &AppHandle<R>,
    _connected: bool,
    _config_remark: Option<&str>,
) {
    update_tray_menu(app);
}

/// Shows existing window or recreates the main webview window.
pub fn show_or_create_main_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    } else {
        let builder = tauri::WebviewWindowBuilder::new(
            app,
            "main",
            tauri::WebviewUrl::default(),
        )
        .title("HyperVPN")
        .inner_size(390.0, 660.0)
        .min_inner_size(380.0, 640.0)
        .max_inner_size(430.0, 720.0)
        .resizable(false)
        .fullscreen(false)
        .center()
        .decorations(true);

        let window = match builder.build() {
            Ok(w) => w,
            Err(e) => {
                if let Some(w) = app.get_webview_window("main") {
                    w
                } else {
                    return Err(Box::new(e));
                }
            }
        };
        let _ = window.show();
        let _ = window.set_focus();
    }

    update_tray_menu(app);
    Ok(())
}

/// Destroys the main webview window and updates the tray menu.
pub fn destroy_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.destroy();
    }
    update_tray_menu(app);
}

/// Sets up the system tray menu and click handlers.
pub fn setup_system_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let status_item = MenuItem::with_id(app, "status", "HyperVPN: Disconnected", false, None::<&str>)?;
    let toggle_item = MenuItem::with_id(app, "toggle_vpn", "Connect", true, None::<&str>)?;
    let show_hide_item = MenuItem::with_id(app, "show_hide_window", "Hide HyperVPN", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&status_item, &toggle_item, &show_hide_item, &quit_item])?;

    // Store menu items in app state so they can be updated dynamically
    app.manage(TrayMenuState {
        status_item: status_item.clone(),
        toggle_item: toggle_item.clone(),
        show_hide_item: show_hide_item.clone(),
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
            "show_hide_window" => {
                if app.get_webview_window("main").is_some() {
                    destroy_main_window(app);
                } else {
                    let _ = show_or_create_main_window(app);
                }
            }
            "toggle_vpn" => {
                if app.get_webview_window("main").is_some() {
                    // Window exists, emit event so UI can display any notifications/state
                    let _ = app.emit("tray-toggle-vpn", ());
                } else if let Some(state) = app.try_state::<crate::AppState>() {
                    // Headless toggle from tray when webview is destroyed
                    let pm = Arc::clone(&state.process_manager);
                    let sm = Arc::clone(&state.storage_manager);
                    let data_dir = state.data_dir.clone();
                    let app_handle = app.clone();

                    tauri::async_runtime::spawn(async move {
                        if pm.is_connected() {
                            let _ = pm.disconnect().await;
                        } else {
                            let configs = sm.get_configs();
                            let settings = sm.get_settings();
                            let active_id = pm.get_active_config_id();
                            let target_config = if let Some(id) = active_id {
                                configs.iter().find(|c| c.id == id).cloned().or_else(|| configs.first().cloned())
                            } else {
                                configs.first().cloned()
                            };

                            if let Some(cfg) = target_config {
                                let _ = pm.connect(
                                    cfg,
                                    settings.socks_port,
                                    settings.stats_port,
                                    settings.custom_lan_exclusions,
                                    data_dir,
                                ).await;
                            }
                        }
                        update_tray_menu(&app_handle);
                    });
                }
            }
            "quit" => {
                // Trigger graceful quit event for webview if alive
                let _ = app.emit("tray-quit-requested", ());
                if let Some(state) = app.try_state::<crate::AppState>() {
                    let pm = Arc::clone(&state.process_manager);
                    tauri::async_runtime::spawn(async move {
                        let _ = pm.disconnect().await;
                        std::process::exit(0);
                    });
                } else {
                    std::process::exit(0);
                }
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
                } else {
                    let _ = show_or_create_main_window(app);
                }
            }
        })
        .build(app)?;

    Ok(())
}
