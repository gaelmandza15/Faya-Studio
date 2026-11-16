// Prevents an additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::args().any(|argument| argument == "--self-test") {
        std::process::exit(tauri_v2_sqlite_lib::self_test());
    }

    tauri_v2_sqlite_lib::run()
}
