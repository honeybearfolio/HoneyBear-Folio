use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier};
use std::time::Duration;

#[test]
fn test_with_db_lock_allows_reentrant_calls_same_thread() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("lock.db");

    let mut steps = 0usize;
    crate::db_init::with_db_lock(&db_path, || {
        steps += 1;
        crate::db_init::with_db_lock(&db_path, || {
            steps += 1;
            Ok(())
        })?;
        Ok(())
    })
    .unwrap();

    assert_eq!(steps, 2);
}

#[test]
fn test_with_db_lock_serializes_concurrent_access() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = Arc::new(dir.path().join("lock.db"));
    let thread_count = 8;

    let active = Arc::new(AtomicUsize::new(0));
    let peak = Arc::new(AtomicUsize::new(0));
    let gate = Arc::new(Barrier::new(thread_count));

    let mut handles = Vec::new();
    for _ in 0..thread_count {
        let db_path = Arc::clone(&db_path);
        let active = Arc::clone(&active);
        let peak = Arc::clone(&peak);
        let gate = Arc::clone(&gate);

        handles.push(std::thread::spawn(move || {
            gate.wait();
            crate::db_init::with_db_lock(&db_path, || {
                let now = active.fetch_add(1, Ordering::SeqCst) + 1;
                let _ = peak.fetch_update(Ordering::SeqCst, Ordering::SeqCst, |current| {
                    (now > current).then_some(now)
                });
                std::thread::sleep(Duration::from_millis(20));
                active.fetch_sub(1, Ordering::SeqCst);
                Ok(())
            })
            .unwrap();
        }));
    }

    for handle in handles {
        handle.join().unwrap();
    }

    assert_eq!(peak.load(Ordering::SeqCst), 1);
}
