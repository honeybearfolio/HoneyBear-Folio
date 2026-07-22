// Tests organized into folders
#![allow(clippy::float_cmp)]

pub mod common;
pub use crate::core::test_helpers;

pub mod accounts;
pub mod app;
pub mod brokerage;
pub mod errors;
pub mod multicurrency;
pub mod payees;
pub mod pdf;
pub mod property;
pub mod rules;
pub mod scheduled;
pub mod stock;
pub mod transactions;

pub mod calculations;

pub mod session;

pub mod db_init;

pub mod assets;

pub mod liabilities;

pub mod llm_tools;

pub mod io;

pub mod llm;

pub mod utils;

pub mod coverage_boost;
pub mod models;
