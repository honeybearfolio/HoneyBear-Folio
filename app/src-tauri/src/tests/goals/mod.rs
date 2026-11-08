use crate::accounts::{create_account_db, delete_account_db};
use crate::core::goals::{
    create_goal_db, delete_goal_db, get_goals_db, update_goal_db, GoalLinkInput, GoalWrite,
    UpdateGoalArgs,
};
use crate::core::llm_tools::tool_get_goals;
use crate::tests::common::setup_db;
use rusqlite::Connection;
use serde_json::json;

fn sample_goal(name: &str, links: Vec<GoalLinkInput>) -> GoalWrite {
    GoalWrite {
        name: name.to_string(),
        target_amount: 10_000.0,
        currency: Some("USD".to_string()),
        target_date: Some("2030-01-01".to_string()),
        monthly_contribution: Some(200.0),
        notes: Some("Down payment".to_string()),
        color: Some("emerald".to_string()),
        links,
    }
}

fn account_link(account_id: i32, allocation: f64) -> GoalLinkInput {
    GoalLinkInput {
        source_type: "account".to_string(),
        account_id: Some(account_id),
        ticker: None,
        allocation_percent: allocation,
    }
}

fn link_count(db_path: &std::path::Path) -> i64 {
    let conn = Connection::open(db_path).unwrap();
    conn.query_row("SELECT COUNT(*) FROM goal_links", [], |row| row.get(0))
        .unwrap()
}

#[test]
fn test_create_and_get_goal() {
    let (_dir, db_path) = setup_db();
    let account = create_account_db(
        &db_path,
        "Savings".to_string(),
        0.0,
        Some("USD".to_string()),
        None,
    )
    .unwrap();

    let id = create_goal_db(
        &db_path,
        &sample_goal("House", vec![account_link(account.id, 60.0)]),
    )
    .unwrap();

    let goals = get_goals_db(&db_path, Some("USD")).unwrap();
    assert_eq!(goals.len(), 1);
    assert_eq!(goals[0].id, id);
    assert_eq!(goals[0].name, "House");
    assert_eq!(goals[0].color, "emerald");
    assert_eq!(goals[0].target_date.as_deref(), Some("2030-01-01"));
    assert!((goals[0].exchange_rate - 1.0).abs() < 1e-9);
    assert!(!goals[0].archived);
    assert_eq!(goals[0].links.len(), 1);
    assert_eq!(goals[0].links[0].source_type, "account");
    assert_eq!(goals[0].links[0].account_id, Some(account.id));
    assert!((goals[0].links[0].allocation_percent - 60.0).abs() < 1e-9);
}

#[test]
fn test_update_goal_replaces_links() {
    let (_dir, db_path) = setup_db();
    let account = create_account_db(&db_path, "Brokerage".to_string(), 0.0, None, None).unwrap();
    let id = create_goal_db(
        &db_path,
        &sample_goal("Retirement", vec![account_link(account.id, 100.0)]),
    )
    .unwrap();

    update_goal_db(
        &db_path,
        &UpdateGoalArgs {
            id,
            archived: true,
            goal: GoalWrite {
                name: "Retirement fund".to_string(),
                target_amount: 50_000.0,
                currency: None,
                target_date: None,
                monthly_contribution: None,
                notes: None,
                color: Some("not-a-color".to_string()),
                links: vec![GoalLinkInput {
                    source_type: "holding".to_string(),
                    account_id: Some(account.id),
                    ticker: Some("VTI".to_string()),
                    allocation_percent: 25.0,
                }],
            },
        },
    )
    .unwrap();

    let goals = get_goals_db(&db_path, None).unwrap();
    assert_eq!(goals.len(), 1);
    assert_eq!(goals[0].name, "Retirement fund");
    assert!(goals[0].archived);
    assert_eq!(goals[0].color, "brand");
    assert!(goals[0].target_date.is_none());
    assert_eq!(goals[0].links.len(), 1);
    assert_eq!(goals[0].links[0].source_type, "holding");
    assert_eq!(goals[0].links[0].ticker.as_deref(), Some("VTI"));
    assert_eq!(link_count(&db_path), 1);
}

#[test]
fn test_delete_goal_removes_links() {
    let (_dir, db_path) = setup_db();
    let account = create_account_db(&db_path, "Cash".to_string(), 0.0, None, None).unwrap();
    let id = create_goal_db(
        &db_path,
        &sample_goal("Trip", vec![account_link(account.id, 100.0)]),
    )
    .unwrap();

    delete_goal_db(&db_path, id).unwrap();
    assert!(get_goals_db(&db_path, None).unwrap().is_empty());
    assert_eq!(link_count(&db_path), 0);
    assert!(delete_goal_db(&db_path, id).is_err());
}

#[test]
fn test_delete_account_removes_goal_links() {
    let (_dir, db_path) = setup_db();
    let account = create_account_db(&db_path, "Cash".to_string(), 0.0, None, None).unwrap();
    create_goal_db(
        &db_path,
        &sample_goal("Trip", vec![account_link(account.id, 100.0)]),
    )
    .unwrap();

    delete_account_db(&db_path, account.id).unwrap();
    let goals = get_goals_db(&db_path, None).unwrap();
    assert_eq!(goals.len(), 1);
    assert!(goals[0].links.is_empty());
}

#[test]
fn test_goal_validation() {
    let (_dir, db_path) = setup_db();

    let empty = sample_goal("   ", vec![]);
    assert!(create_goal_db(&db_path, &empty)
        .unwrap_err()
        .contains("empty"));

    let mut bad_target = sample_goal("House", vec![]);
    bad_target.target_amount = 0.0;
    assert!(create_goal_db(&db_path, &bad_target)
        .unwrap_err()
        .contains("greater than zero"));

    let bad_allocation = sample_goal("House", vec![account_link(1, 0.0)]);
    assert!(create_goal_db(&db_path, &bad_allocation)
        .unwrap_err()
        .contains("Allocation"));

    let missing_account = sample_goal(
        "House",
        vec![GoalLinkInput {
            source_type: "account".to_string(),
            account_id: None,
            ticker: None,
            allocation_percent: 100.0,
        }],
    );
    assert!(create_goal_db(&db_path, &missing_account)
        .unwrap_err()
        .contains("account"));

    let missing_ticker = sample_goal(
        "House",
        vec![GoalLinkInput {
            source_type: "holding".to_string(),
            account_id: None,
            ticker: Some("  ".to_string()),
            allocation_percent: 100.0,
        }],
    );
    assert!(create_goal_db(&db_path, &missing_ticker)
        .unwrap_err()
        .contains("ticker"));

    let duplicate = sample_goal("House", vec![account_link(1, 40.0), account_link(1, 60.0)]);
    assert!(create_goal_db(&db_path, &duplicate)
        .unwrap_err()
        .contains("Duplicate"));
}

#[test]
fn test_goal_exchange_rate_uses_custom_rate() {
    let (_dir, db_path) = setup_db();
    let mut goal = sample_goal("Europe", vec![]);
    goal.currency = Some("EUR".to_string());
    create_goal_db(&db_path, &goal).unwrap();

    let conn = Connection::open(&db_path).unwrap();
    conn.execute(
        "INSERT INTO custom_exchange_rates (currency, rate) VALUES ('EUR', 1.1)",
        [],
    )
    .unwrap();

    let goals = get_goals_db(&db_path, Some("USD")).unwrap();
    assert!((goals[0].exchange_rate - 1.1).abs() < 1e-9);
}

#[test]
fn test_tool_get_goals() {
    let (_dir, db_path) = setup_db();
    create_goal_db(&db_path, &sample_goal("House", vec![])).unwrap();
    let result = tool_get_goals(&db_path, &json!({})).unwrap();
    let goals = result.as_array().unwrap();
    assert_eq!(goals.len(), 1);
    assert_eq!(goals[0]["name"], "House");
}
