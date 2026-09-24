use audiflow::settings::Settings;

#[test]
fn test_default_app_settings_integrity() {
    let settings = Settings::default();
    assert_eq!(settings.theme, "system");
    assert_eq!(settings.language, "fa");
    assert!(settings.concurrency >= 1);
}

#[test]
fn test_app_settings_json_serialization_roundtrip() {
    let original = Settings::default();
    let json = serde_json::to_string(&original).expect("settings should serialize");
    let recovered: Settings = serde_json::from_str(&json).expect("settings should deserialize");
    assert_eq!(original.theme, recovered.theme);
    assert_eq!(original.language, recovered.language);
    assert_eq!(original.concurrency, recovered.concurrency);
}
