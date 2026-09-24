use audiflow::queue::JobRecord;
use audiflow::types::JobStatus;

#[test]
fn test_job_record_initialization_state() {
    let rec = JobRecord {
        id: "job-1".to_string(),
        source_path: "/test/path.mp3".to_string(),
        status: JobStatus::Waiting,
        percent: None,
        speed: None,
        error: None,
        technical: None,
        warning: None,
        outputs: Vec::new(),
    };

    assert_eq!(rec.id, "job-1");
    assert_eq!(rec.status, JobStatus::Waiting);
    assert!(rec.outputs.is_empty());
}

#[test]
fn test_job_record_serialization() {
    let rec = JobRecord {
        id: "job-42".to_string(),
        source_path: "/audio/test.wav".to_string(),
        status: JobStatus::Completed,
        percent: Some(100.0),
        speed: Some("1.5x".to_string()),
        error: None,
        technical: None,
        warning: None,
        outputs: vec!["/audio/test.mp3".to_string()],
    };

    let json = serde_json::to_string(&rec).expect("JobRecord should serialize");
    assert!(json.contains("job-42"));
    assert!(json.contains("completed"));
}
