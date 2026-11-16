use rusqlite::{params_from_iter, types::Value as SqlValue, Connection};
use serde_json::{Map, Value};
use std::sync::Mutex;
use tauri::{Manager, State};

struct Db(Mutex<Connection>);

fn to_sql_value(value: Value) -> SqlValue {
    match value {
        Value::Null => SqlValue::Null,
        Value::Bool(value) => SqlValue::Integer(if value { 1 } else { 0 }),
        Value::Number(number) => {
            if let Some(integer) = number.as_i64() {
                SqlValue::Integer(integer)
            } else if let Some(real) = number.as_f64() {
                SqlValue::Real(real)
            } else {
                SqlValue::Null
            }
        }
        Value::String(value) => SqlValue::Text(value),
        _ => SqlValue::Null,
    }
}

#[tauri::command]
fn db_execute(
    state: State<'_, Db>,
    query: String,
    params: Vec<Value>,
) -> Result<usize, String> {
    let connection = state.0.lock().map_err(|error| error.to_string())?;
    let values: Vec<SqlValue> = params.into_iter().map(to_sql_value).collect();

    connection
        .execute(&query, params_from_iter(values))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn db_select(
    state: State<'_, Db>,
    query: String,
    params: Vec<Value>,
) -> Result<Vec<Map<String, Value>>, String> {
    let connection = state.0.lock().map_err(|error| error.to_string())?;
    let values: Vec<SqlValue> = params.into_iter().map(to_sql_value).collect();
    let mut statement = connection
        .prepare(&query)
        .map_err(|error| error.to_string())?;

    let columns: Vec<String> = statement
        .column_names()
        .iter()
        .map(|column| column.to_string())
        .collect();

    let mut rows = statement
        .query(params_from_iter(values))
        .map_err(|error| error.to_string())?;

    let mut result = Vec::new();

    while let Some(row) = rows.next().map_err(|error| error.to_string())? {
        let mut object = Map::new();

        for (index, column) in columns.iter().enumerate() {
            let value = match row.get_ref(index).map_err(|error| error.to_string())? {
                rusqlite::types::ValueRef::Null => Value::Null,
                rusqlite::types::ValueRef::Integer(value) => Value::from(value),
                rusqlite::types::ValueRef::Real(value) => Value::from(value),
                rusqlite::types::ValueRef::Text(value) => {
                    Value::from(String::from_utf8_lossy(value).to_string())
                }
                rusqlite::types::ValueRef::Blob(_) => Value::Null,
            };

            object.insert(column.clone(), value);
        }

        result.push(object);
    }

    Ok(result)
}

pub fn self_test() -> i32 {
    let connection = match Connection::open_in_memory() {
        Ok(connection) => connection,
        Err(error) => {
            eprintln!("SQLite open failed: {error}");
            return 1;
        }
    };

    if let Err(error) = connection.execute_batch(include_str!("../migrations/schema.sql")) {
        eprintln!("Schema initialization failed: {error}");
        return 1;
    }

    if let Err(error) = connection.execute_batch(
        "CREATE TEMP TABLE _faya_self_test (id INTEGER PRIMARY KEY, value TEXT);
         INSERT INTO _faya_self_test (value) VALUES ('ok');",
    ) {
        eprintln!("Write test failed: {error}");
        return 1;
    }

    let value: String = match connection.query_row(
        "SELECT value FROM _faya_self_test LIMIT 1",
        [],
        |row| row.get(0),
    ) {
        Ok(value) => value,
        Err(error) => {
            eprintln!("Read test failed: {error}");
            return 1;
        }
    };

    let tables: i64 = match connection.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        [],
        |row| row.get(0),
    ) {
        Ok(count) => count,
        Err(error) => {
            eprintln!("Schema check failed: {error}");
            return 1;
        }
    };

    if value != "ok" {
        eprintln!("Unexpected read value: {value}");
        return 1;
    }

    println!("TAURI_SQLITE_SELFTEST_OK tables={tables}");
    0
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("application data directory unavailable");

            std::fs::create_dir_all(&app_data_dir)
                .expect("unable to create application data directory");

            let database_path = app_data_dir.join("faya_app.db");
            let connection =
                Connection::open(database_path).expect("unable to open SQLite database");

            connection
                .execute_batch(include_str!("../migrations/schema.sql"))
                .expect("unable to initialize SQLite schema");

            app.manage(Db(Mutex::new(connection)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![db_execute, db_select])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
