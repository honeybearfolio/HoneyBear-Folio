use crate::core::assets::create_asset_db;
use crate::core::llm::{
    create_conversation_db, delete_all_conversations_db, delete_conversation_db,
    get_conversation_messages_db, get_conversations_db, rename_conversation_db,
    save_message_db_for_test,
};
use crate::create_account_db;
use crate::tests::common::setup_db;

#[test]
fn test_conversation_crud() {
    let (_dir, db_path) = setup_db();

    let conv = create_conversation_db(&db_path, "Budget review".to_string()).unwrap();
    assert_eq!(conv.title, "Budget review");
    assert!(conv.id > 0);

    let all = get_conversations_db(&db_path).unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].id, conv.id);

    rename_conversation_db(&db_path, conv.id, "Monthly budget".to_string()).unwrap();
    let updated = get_conversations_db(&db_path).unwrap();
    assert_eq!(updated[0].title, "Monthly budget");

    delete_conversation_db(&db_path, conv.id).unwrap();
    assert!(get_conversations_db(&db_path).unwrap().is_empty());
}

#[test]
fn test_conversation_messages() {
    let (_dir, db_path) = setup_db();
    let conv = create_conversation_db(&db_path, "Chat".to_string()).unwrap();

    save_message_db_for_test(&db_path, conv.id, "user", Some("Hello"), None, None, None).unwrap();
    save_message_db_for_test(
        &db_path,
        conv.id,
        "assistant",
        Some("Hi there"),
        None,
        None,
        Some("thinking..."),
    )
    .unwrap();

    let messages = get_conversation_messages_db(&db_path, conv.id).unwrap();
    assert_eq!(messages.len(), 2);
    assert_eq!(messages[0].role, "user");
    assert_eq!(messages[0].content.as_deref(), Some("Hello"));
    assert_eq!(messages[1].role, "assistant");
    assert_eq!(messages[1].thinking.as_deref(), Some("thinking..."));
}

#[test]
fn test_delete_all_conversations() {
    let (_dir, db_path) = setup_db();
    create_conversation_db(&db_path, "One".to_string()).unwrap();
    create_conversation_db(&db_path, "Two".to_string()).unwrap();

    delete_all_conversations_db(&db_path).unwrap();
    assert!(get_conversations_db(&db_path).unwrap().is_empty());
}

#[test]
fn test_build_system_prompt_includes_accounts_and_assets() {
    let (_dir, db_path) = setup_db();

    create_account_db(
        &db_path,
        "Checking".to_string(),
        1000.0,
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    create_asset_db(
        &db_path,
        "House".to_string(),
        "real_estate".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();

    let prompt = crate::core::llm::build_system_prompt_for_test(&db_path);
    assert!(prompt.contains("Checking"));
    assert!(prompt.contains("House"));
    assert!(prompt.contains("real_estate"));
}

#[test]
fn test_build_tool_definitions_has_core_tools() {
    let tools = crate::core::llm::build_tool_definitions_for_test();
    assert!(!tools.is_empty());
    let names: Vec<String> = tools
        .iter()
        .filter_map(|t| {
            t.get("function")
                .and_then(|f| f.get("name"))
                .and_then(|n| n.as_str())
                .map(str::to_string)
        })
        .collect();
    assert!(names.contains(&"get_accounts".to_string()));
    assert!(names.contains(&"get_net_worth".to_string()));
    assert!(names.contains(&"get_assets".to_string()));
}

#[test]
fn test_cancel_llm_chat_flag() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let conv_id = 42_i64;
        crate::core::llm::cancel_llm_chat_for_test(conv_id)
            .await
            .unwrap();
        assert!(crate::core::llm::is_cancelled_for_test(conv_id));
        crate::core::llm::clear_cancelled_for_test(conv_id);
        assert!(!crate::core::llm::is_cancelled_for_test(conv_id));
    });
}
