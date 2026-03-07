use crate::models::{ReportData, ReportLabels};
use printpdf::path::{PaintMode, WindingOrder};
use printpdf::*;
use std::fs::File;
use std::io::BufWriter;

// Embed fonts at compile-time
const FONT_REGULAR: &[u8] = include_bytes!("../assets/LiberationSans-Regular.ttf");
const FONT_BOLD: &[u8] = include_bytes!("../assets/LiberationSans-Bold.ttf");
const LOGO_PNG: &[u8] = include_bytes!("../../icons/icon.png");

// Page dimensions (A4 in mm)
const PAGE_W: f32 = 210.0;
const PAGE_H: f32 = 297.0;
const MARGIN_LEFT: f32 = 20.0;
const MARGIN_RIGHT: f32 = 20.0;
const MARGIN_TOP: f32 = 25.0;
const MARGIN_BOTTOM: f32 = 20.0;
const CONTENT_W: f32 = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;
const HEADER_HEIGHT: f32 = 12.0;
const FOOTER_HEIGHT: f32 = 10.0;

/// Brand colour used for accents (honey/amber — matches app theme)
const BRAND_R: f32 = 0.976; // ~#F98C07
const BRAND_G: f32 = 0.549;
const BRAND_B: f32 = 0.027;

// Chart colours for bars/lines
const CHART_INCOME_R: f32 = 0.180;
const CHART_INCOME_G: f32 = 0.694;
const CHART_INCOME_B: f32 = 0.424;
const CHART_EXPENSE_R: f32 = 0.878;
const CHART_EXPENSE_G: f32 = 0.282;
const CHART_EXPENSE_B: f32 = 0.298;

struct PdfFonts {
    regular: IndirectFontRef,
    bold: IndirectFontRef,
}

struct PageCtx<'a> {
    layer: &'a PdfLayerReference,
    fonts: &'a PdfFonts,
}

// ── Helpers ─────────────────────────────────────────────────────────

fn mm(v: f32) -> Mm {
    Mm(v)
}

fn pt(v: f32) -> Pt {
    Pt(v)
}

/// Convert a y position (from top of page in mm) to the bottom-left origin used by printpdf.
fn y(from_top: f32) -> Mm {
    Mm(PAGE_H - from_top)
}

fn format_currency(value: f64, symbol: &str) -> String {
    if value < 0.0 {
        format!("-{}{:.2}", symbol, value.abs())
    } else {
        format!("{}{:.2}", symbol, value)
    }
}

fn format_percent(value: f64) -> String {
    format!("{:.1}%", value)
}

fn truncate(s: &str, max_chars: usize) -> String {
    if s.chars().count() <= max_chars {
        s.to_string()
    } else {
        let truncated: String = s.chars().take(max_chars - 1).collect();
        format!("{}…", truncated)
    }
}

// ── Text drawing ────────────────────────────────────────────────────

fn write_text(ctx: &PageCtx, text: &str, x: f32, from_top: f32, size: f32, bold: bool) {
    let font = if bold { &ctx.fonts.bold } else { &ctx.fonts.regular };
    // Always set explicit black to prevent color inheritance from previous draw calls
    ctx.layer.set_fill_color(Color::Rgb(Rgb::new(0.15, 0.15, 0.15, None)));
    ctx.layer.use_text(text, size, mm(x), y(from_top), font);
}

fn write_text_color(
    ctx: &PageCtx,
    text: &str,
    x: f32,
    from_top: f32,
    size: f32,
    bold: bool,
    r: f32,
    g: f32,
    b: f32,
) {
    let font = if bold { &ctx.fonts.bold } else { &ctx.fonts.regular };
    ctx.layer.set_fill_color(Color::Rgb(Rgb::new(r, g, b, None)));
    ctx.layer.use_text(text, size, mm(x), y(from_top), font);
    // Reset to dark text color to prevent color bleeding into subsequent draws
    ctx.layer.set_fill_color(Color::Rgb(Rgb::new(0.15, 0.15, 0.15, None)));
}

/// Approximate text width in mm for Liberation Sans at a given pt size.
fn text_width(text: &str, size_pt: f32) -> f32 {
    // Liberation Sans average character width ≈ 0.52 × font size in pt → mm
    let avg_char_mm = size_pt * 0.52 * 0.3528; // pt → mm ≈ 0.3528
    text.chars().count() as f32 * avg_char_mm
}

fn write_text_right(ctx: &PageCtx, text: &str, right_x: f32, from_top: f32, size: f32, bold: bool) {
    let w = text_width(text, size);
    write_text(ctx, text, right_x - w, from_top, size, bold);
}

// ── Shapes ──────────────────────────────────────────────────────────

fn draw_rect(layer: &PdfLayerReference, x: f32, from_top: f32, w: f32, h: f32, r: f32, g: f32, b: f32) {
    layer.set_fill_color(Color::Rgb(Rgb::new(r, g, b, None)));
    let points = vec![
        (Point::new(mm(x), y(from_top)), false),
        (Point::new(mm(x + w), y(from_top)), false),
        (Point::new(mm(x + w), y(from_top + h)), false),
        (Point::new(mm(x), y(from_top + h)), false),
    ];
    layer.add_polygon(Polygon {
        rings: vec![points],
        mode: PaintMode::Fill,
        winding_order: WindingOrder::NonZero,
    });
}

fn draw_line(layer: &PdfLayerReference, x1: f32, y1_top: f32, x2: f32, y2_top: f32, width: f32, r: f32, g: f32, b: f32) {
    layer.set_outline_color(Color::Rgb(Rgb::new(r, g, b, None)));
    layer.set_outline_thickness(width);
    let points = vec![
        (Point::new(mm(x1), y(y1_top)), false),
        (Point::new(mm(x2), y(y2_top)), false),
    ];
    layer.add_polygon(Polygon {
        rings: vec![points],
        mode: PaintMode::Stroke,
        winding_order: WindingOrder::NonZero,
    });
}

// ── Header / Footer ────────────────────────────────────────────────

fn draw_header_footer(ctx: &PageCtx, page_num: usize, labels: &ReportLabels) {
    // Header: brand bar
    draw_rect(ctx.layer, 0.0, 0.0, PAGE_W, HEADER_HEIGHT, BRAND_R, BRAND_G, BRAND_B);
    write_text_color(ctx, "HoneyBear Folio", MARGIN_LEFT, 8.5, 9.0, true, 1.0, 1.0, 1.0);

    // Footer: thin accent line + page number
    draw_line(ctx.layer, MARGIN_LEFT, PAGE_H - 12.0, MARGIN_LEFT + CONTENT_W, PAGE_H - 12.0, 0.3, 0.85, 0.85, 0.85);
    let page_text = format!("{} {}", labels.page, page_num);
    let tw = text_width(&page_text, 8.0);
    let center_x = (PAGE_W - tw) / 2.0;
    write_text_color(ctx, &page_text, center_x, PAGE_H - 6.0, 8.0, false, 0.5, 0.5, 0.5);
}

fn draw_section_title(ctx: &PageCtx, title: &str, from_top: f32) -> f32 {
    write_text_color(ctx, title, MARGIN_LEFT, from_top, 14.0, true, BRAND_R, BRAND_G, BRAND_B);
    // Underline
    draw_line(ctx.layer, MARGIN_LEFT, from_top + 2.0, MARGIN_LEFT + CONTENT_W, from_top + 2.0, 0.5, BRAND_R, BRAND_G, BRAND_B);
    from_top + 8.0
}

// ── Table drawing ───────────────────────────────────────────────────

struct TableColumn {
    header: String,
    width: f32,
    align_right: bool,
}

fn draw_table_header(ctx: &PageCtx, cols: &[TableColumn], from_top: f32) -> f32 {
    // Header background — warm light amber tint
    draw_rect(ctx.layer, MARGIN_LEFT, from_top, CONTENT_W, 6.0, 0.99, 0.96, 0.90);

    let mut x = MARGIN_LEFT + 1.0;
    for col in cols {
        if col.align_right {
            write_text_right(ctx, &col.header, x + col.width - 1.0, from_top + 4.0, 7.0, true);
        } else {
            write_text(ctx, &col.header, x, from_top + 4.0, 7.0, true);
        }
        x += col.width;
    }
    from_top + 7.0
}

fn draw_table_row(ctx: &PageCtx, cols: &[TableColumn], values: &[String], from_top: f32, zebra: bool) -> f32 {
    if zebra {
        draw_rect(ctx.layer, MARGIN_LEFT, from_top, CONTENT_W, 5.5, 0.98, 0.98, 0.97);
    }
    let mut x = MARGIN_LEFT + 1.0;
    for (i, col) in cols.iter().enumerate() {
        let val = values.get(i).map(|s| s.as_str()).unwrap_or("");
        let display = truncate(val, (col.width / 1.5) as usize);
        if col.align_right {
            write_text_right(ctx, &display, x + col.width - 1.0, from_top + 4.0, 7.0, false);
        } else {
            write_text(ctx, &display, x, from_top + 4.0, 7.0, false);
        }
        x += col.width;
    }
    from_top + 5.5
}

// ── Page factory ────────────────────────────────────────────────────

fn add_page(doc: &PdfDocumentReference, fonts: &PdfFonts, page_num: usize, labels: &ReportLabels) -> PdfLayerReference {
    let (page, layer) = doc.add_page(mm(PAGE_W), mm(PAGE_H), &format!("Page {}", page_num));
    let layer_ref = doc.get_page(page).get_layer(layer);
    let ctx = PageCtx {
        layer: &layer_ref,
        fonts,
    };
    draw_header_footer(&ctx, page_num, labels);
    layer_ref
}

// ── Cover page ──────────────────────────────────────────────────────

fn draw_cover_page(doc: &PdfDocumentReference, fonts: &PdfFonts, data: &ReportData) {
    let (page, layer) = doc.add_page(mm(PAGE_W), mm(PAGE_H), "Cover");
    let layer_ref = doc.get_page(page).get_layer(layer);
    let ctx = PageCtx {
        layer: &layer_ref,
        fonts,
    };

    // Logo — load the embedded PNG via printpdf's Image::try_from
    if let Ok(image) = Image::try_from(image_crate::codecs::png::PngDecoder::new(std::io::Cursor::new(LOGO_PNG)).unwrap()) {
        let transform = ImageTransform {
            translate_x: Some(mm((PAGE_W - 40.0) / 2.0)),
            translate_y: Some(y(110.0)),
            scale_x: Some(40.0 / 512.0), // scale to ~40mm
            scale_y: Some(40.0 / 512.0),
            ..Default::default()
        };
        image.add_to_layer(layer_ref.clone(), transform);
    }

    // Title
    let title = "HoneyBear Folio";
    let tw = text_width(title, 26.0);
    write_text_color(&ctx, title, (PAGE_W - tw) / 2.0, 125.0, 26.0, true, BRAND_R, BRAND_G, BRAND_B);

    let subtitle = &data.labels.title;
    let sw = text_width(subtitle, 16.0);
    write_text(&ctx, subtitle, (PAGE_W - sw) / 2.0, 138.0, 16.0, false);

    // Date range
    let range = format!("{} — {}", data.date_range_start, data.date_range_end);
    let rw = text_width(&range, 11.0);
    write_text_color(&ctx, &range, (PAGE_W - rw) / 2.0, 150.0, 11.0, false, 0.4, 0.4, 0.4);

    // Generation date
    let gen = &data.generation_date;
    let gw = text_width(gen, 9.0);
    write_text_color(&ctx, gen, (PAGE_W - gw) / 2.0, 160.0, 9.0, false, 0.6, 0.6, 0.6);

    // Currency
    let cur = format!("Currency: {}", data.currency_symbol);
    let cw = text_width(&cur, 9.0);
    write_text_color(&ctx, &cur, (PAGE_W - cw) / 2.0, 168.0, 9.0, false, 0.6, 0.6, 0.6);
}

// ── Financial Summary page ──────────────────────────────────────────

fn draw_summary_page(doc: &PdfDocumentReference, fonts: &PdfFonts, data: &ReportData) {
    let layer = add_page(doc, fonts, 2, &data.labels);
    let ctx = PageCtx { layer: &layer, fonts };
    let sym = &data.currency_symbol;
    let labels = &data.labels;
    let s = &data.summary;

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&ctx, &labels.financial_summary, top);

    // Key metrics as a card grid
    let metrics = [
        (&labels.net_worth, format_currency(s.net_worth, sym)),
        (&labels.total_income, format_currency(s.total_income, sym)),
        (&labels.total_expenses, format_currency(s.total_expenses, sym)),
        (&labels.net_savings, format_currency(s.net_savings, sym)),
        (&labels.savings_rate, format_percent(s.savings_rate)),
        (&labels.accounts, s.account_count.to_string()),
    ];

    let card_w = (CONTENT_W - 4.0) / 3.0;
    for (i, (label, value)) in metrics.iter().enumerate() {
        let col = i % 3;
        let row = i / 3;
        let cx = MARGIN_LEFT + col as f32 * (card_w + 2.0);
        let cy = top + row as f32 * 20.0;

        // Warm card background with subtle amber tint
        draw_rect(&layer, cx, cy, card_w, 17.0, 1.0, 0.98, 0.93);
        // Left accent bar
        draw_rect(&layer, cx, cy, 1.2, 17.0, BRAND_R, BRAND_G, BRAND_B);
        write_text_color(&ctx, label, cx + 4.0, cy + 6.0, 7.0, false, 0.4, 0.4, 0.4);
        write_text(&ctx, value, cx + 4.0, cy + 12.0, 11.0, true);
    }

    top += 45.0;

    // Account balances table
    top = draw_section_title(&ctx, &labels.accounts, top);

    let cols = vec![
        TableColumn { header: labels.account.clone(), width: 45.0, align_right: false },
        TableColumn { header: labels.currency.clone(), width: 20.0, align_right: false },
        TableColumn { header: labels.cash_balance.clone(), width: 35.0, align_right: true },
        TableColumn { header: labels.market_value.clone(), width: 35.0, align_right: true },
        TableColumn { header: labels.total.clone(), width: 35.0, align_right: true },
    ];

    top = draw_table_header(&ctx, &cols, top);

    for (i, ab) in data.account_balances.iter().enumerate() {
        top = draw_table_row(
            &ctx,
            &cols,
            &[
                ab.name.clone(),
                ab.currency.clone(),
                format_currency(ab.cash_balance, sym),
                format_currency(ab.market_value, sym),
                format_currency(ab.total, sym),
            ],
            top,
            i % 2 == 1,
        );
    }
}

// ── Net Worth Evolution chart ───────────────────────────────────────

fn draw_net_worth_page(doc: &PdfDocumentReference, fonts: &PdfFonts, data: &ReportData) {
    let layer = add_page(doc, fonts, 3, &data.labels);
    let ctx = PageCtx { layer: &layer, fonts };

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&ctx, &data.labels.net_worth_evolution, top);

    let points = &data.net_worth_points;
    if points.is_empty() {
        write_text_color(&ctx, &data.labels.no_transactions, MARGIN_LEFT, top + 10.0, 10.0, false, 0.5, 0.5, 0.5);
        return;
    }

    // Chart area
    let chart_x = MARGIN_LEFT + 15.0;
    let chart_top = top + 5.0;
    let chart_w = CONTENT_W - 20.0;
    let chart_h = 100.0;

    let min_val = points.iter().map(|p| p.value).fold(f64::MAX, f64::min);
    let max_val = points.iter().map(|p| p.value).fold(f64::MIN, f64::max);
    let range = if (max_val - min_val).abs() < 0.01 { 1.0 } else { max_val - min_val };

    // Y-axis labels (5 ticks)
    for i in 0..=4 {
        let frac = i as f64 / 4.0;
        let val = min_val + frac * range;
        let yy = chart_top + chart_h - (frac as f32 * chart_h);
        write_text_right(&ctx, &format_currency(val, &data.currency_symbol), chart_x - 2.0, yy + 1.5, 6.0, false);
        // Grid line
        draw_line(&layer, chart_x, yy, chart_x + chart_w, yy, 0.2, 0.85, 0.85, 0.85);
    }

    // Draw line chart
    let n = points.len();
    if n > 1 {
        for i in 0..n - 1 {
            let x1 = chart_x + (i as f32 / (n - 1) as f32) * chart_w;
            let x2 = chart_x + ((i + 1) as f32 / (n - 1) as f32) * chart_w;
            let y1_frac = (points[i].value - min_val) / range;
            let y2_frac = (points[i + 1].value - min_val) / range;
            let y1_top = chart_top + chart_h - (y1_frac as f32 * chart_h);
            let y2_top = chart_top + chart_h - (y2_frac as f32 * chart_h);
            draw_line(&layer, x1, y1_top, x2, y2_top, 0.8, BRAND_R, BRAND_G, BRAND_B);
        }
    }

    // X-axis labels (show ~6 evenly spaced)
    let label_count = 6.min(n);
    for i in 0..label_count {
        let idx = if label_count > 1 { i * (n - 1) / (label_count - 1) } else { 0 };
        let x = chart_x + (idx as f32 / (n - 1).max(1) as f32) * chart_w;
        write_text_color(&ctx, &truncate(&points[idx].label, 10), x, chart_top + chart_h + 4.0, 5.5, false, 0.5, 0.5, 0.5);
    }
}

// ── Income vs Expenses chart ────────────────────────────────────────

fn draw_income_expenses_page(doc: &PdfDocumentReference, fonts: &PdfFonts, data: &ReportData) {
    let layer = add_page(doc, fonts, 4, &data.labels);
    let ctx = PageCtx { layer: &layer, fonts };
    let labels = &data.labels;
    let sym = &data.currency_symbol;

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&ctx, &labels.income_vs_expenses, top);

    let months = &data.monthly_income_expenses;
    if months.is_empty() {
        write_text_color(&ctx, &labels.no_transactions, MARGIN_LEFT, top + 10.0, 10.0, false, 0.5, 0.5, 0.5);
        return;
    }

    // Grouped bar chart
    let chart_x = MARGIN_LEFT + 15.0;
    let chart_top = top + 5.0;
    let chart_w = CONTENT_W - 20.0;
    let chart_h = 80.0;

    let max_val = months.iter().map(|m| m.income.max(m.expenses)).fold(0.0_f64, f64::max);
    let ceiling = if max_val < 0.01 { 1.0 } else { max_val };

    // Y-axis
    for i in 0..=4 {
        let frac = i as f64 / 4.0;
        let val = frac * ceiling;
        let yy = chart_top + chart_h - (frac as f32 * chart_h);
        write_text_right(&ctx, &format_currency(val, sym), chart_x - 2.0, yy + 1.5, 6.0, false);
        draw_line(&layer, chart_x, yy, chart_x + chart_w, yy, 0.2, 0.85, 0.85, 0.85);
    }

    let n = months.len();
    let group_w = chart_w / n as f32;
    let bar_w = (group_w * 0.35).min(12.0);

    for (i, m) in months.iter().enumerate() {
        let gx = chart_x + i as f32 * group_w;
        let center = gx + group_w / 2.0;

        // Income bar
        let ih = (m.income / ceiling) as f32 * chart_h;
        if ih > 0.1 {
            draw_rect(&layer, center - bar_w - 0.5, chart_top + chart_h - ih, bar_w, ih, CHART_INCOME_R, CHART_INCOME_G, CHART_INCOME_B);
        }

        // Expense bar
        let eh = (m.expenses / ceiling) as f32 * chart_h;
        if eh > 0.1 {
            draw_rect(&layer, center + 0.5, chart_top + chart_h - eh, bar_w, eh, CHART_EXPENSE_R, CHART_EXPENSE_G, CHART_EXPENSE_B);
        }

        // Label
        write_text_color(&ctx, &truncate(&m.label, 6), center - 4.0, chart_top + chart_h + 4.0, 5.5, false, 0.5, 0.5, 0.5);
    }

    // Legend
    let legend_top = chart_top + chart_h + 10.0;
    draw_rect(&layer, MARGIN_LEFT, legend_top, 4.0, 3.0, CHART_INCOME_R, CHART_INCOME_G, CHART_INCOME_B);
    write_text(&ctx, &labels.income, MARGIN_LEFT + 6.0, legend_top + 2.5, 7.0, false);
    draw_rect(&layer, MARGIN_LEFT + 40.0, legend_top, 4.0, 3.0, CHART_EXPENSE_R, CHART_EXPENSE_G, CHART_EXPENSE_B);
    write_text(&ctx, &labels.expenses, MARGIN_LEFT + 46.0, legend_top + 2.5, 7.0, false);

    // Summary table
    let table_top = legend_top + 12.0;
    let cols = vec![
        TableColumn { header: labels.month.clone(), width: 40.0, align_right: false },
        TableColumn { header: labels.income.clone(), width: 40.0, align_right: true },
        TableColumn { header: labels.expenses.clone(), width: 40.0, align_right: true },
        TableColumn { header: labels.net.clone(), width: 40.0, align_right: true },
    ];

    let mut tt = draw_table_header(&ctx, &cols, table_top);
    for (i, m) in months.iter().enumerate() {
        if tt > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
            break; // Prevent overflow — truncate if too many months
        }
        tt = draw_table_row(
            &ctx,
            &cols,
            &[
                m.label.clone(),
                format_currency(m.income, sym),
                format_currency(m.expenses, sym),
                format_currency(m.income - m.expenses, sym),
            ],
            tt,
            i % 2 == 1,
        );
    }
}

// ── Expense Breakdown page ──────────────────────────────────────────

fn draw_expense_breakdown_page(doc: &PdfDocumentReference, fonts: &PdfFonts, data: &ReportData, page_num: usize) {
    let layer = add_page(doc, fonts, page_num, &data.labels);
    let ctx = PageCtx { layer: &layer, fonts };
    let labels = &data.labels;
    let sym = &data.currency_symbol;

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&ctx, &labels.expense_breakdown, top);

    let cats = &data.expense_categories;
    if cats.is_empty() {
        write_text_color(&ctx, &labels.no_transactions, MARGIN_LEFT, top + 10.0, 10.0, false, 0.5, 0.5, 0.5);
        return;
    }

    // Horizontal bar chart (top 15)
    let chart_x = MARGIN_LEFT + 40.0;
    let max_amount = cats.iter().map(|c| c.amount).fold(0.0_f64, f64::max);
    let bar_max_w = CONTENT_W - 55.0;
    let bar_h = 5.5;

    let shown = cats.iter().take(15);
    for (i, cat) in shown.enumerate() {
        let cy = top + i as f32 * 8.0;
        let label = truncate(&cat.category, 18);
        write_text(&ctx, &label, MARGIN_LEFT, cy + 4.0, 6.5, false);
        let bw = if max_amount > 0.0 { (cat.amount / max_amount) as f32 * bar_max_w } else { 0.0 };
        draw_rect(&layer, chart_x, cy + 0.5, bw.max(1.0), bar_h, CHART_EXPENSE_R, CHART_EXPENSE_G, CHART_EXPENSE_B);
        write_text(&ctx, &format_currency(cat.amount, sym), chart_x + bw + 2.0, cy + 4.0, 6.0, false);
    }

    // Table below
    let table_top = top + (cats.len().min(15) as f32 * 8.0) + 10.0;
    let cols = vec![
        TableColumn { header: labels.category.clone(), width: 60.0, align_right: false },
        TableColumn { header: labels.amount.clone(), width: 50.0, align_right: true },
        TableColumn { header: labels.percentage.clone(), width: 30.0, align_right: true },
    ];

    let mut tt = draw_table_header(&ctx, &cols, table_top);
    for (i, cat) in cats.iter().enumerate() {
        if tt > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
            break;
        }
        tt = draw_table_row(
            &ctx,
            &cols,
            &[
                cat.category.clone(),
                format_currency(cat.amount, sym),
                format_percent(cat.percentage),
            ],
            tt,
            i % 2 == 1,
        );
    }
}

// ── Income Breakdown page ───────────────────────────────────────────

fn draw_income_breakdown_page(doc: &PdfDocumentReference, fonts: &PdfFonts, data: &ReportData, page_num: usize) {
    let layer = add_page(doc, fonts, page_num, &data.labels);
    let ctx = PageCtx { layer: &layer, fonts };
    let labels = &data.labels;
    let sym = &data.currency_symbol;

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&ctx, &labels.income_breakdown, top);

    let cats = &data.income_categories;
    if cats.is_empty() {
        write_text_color(&ctx, &labels.no_transactions, MARGIN_LEFT, top + 10.0, 10.0, false, 0.5, 0.5, 0.5);
        return;
    }

    let cols = vec![
        TableColumn { header: labels.category.clone(), width: 60.0, align_right: false },
        TableColumn { header: labels.amount.clone(), width: 50.0, align_right: true },
        TableColumn { header: labels.percentage.clone(), width: 30.0, align_right: true },
    ];

    top = draw_table_header(&ctx, &cols, top);

    for (i, cat) in cats.iter().enumerate() {
        if top > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
            break;
        }
        top = draw_table_row(
            &ctx,
            &cols,
            &[
                cat.category.clone(),
                format_currency(cat.amount, sym),
                format_percent(cat.percentage),
            ],
            top,
            i % 2 == 1,
        );
    }
}

// ── Cash Flow Summary page ──────────────────────────────────────────

fn draw_cash_flow_page(doc: &PdfDocumentReference, fonts: &PdfFonts, data: &ReportData, page_num: usize) {
    let layer = add_page(doc, fonts, page_num, &data.labels);
    let ctx = PageCtx { layer: &layer, fonts };
    let labels = &data.labels;
    let sym = &data.currency_symbol;
    let cf = &data.cash_flow;

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&ctx, &labels.cash_flow_summary, top);

    // Overview cards
    let items = [
        (&labels.total_income, cf.total_income),
        (&labels.total_expenses, cf.total_expenses),
        (&labels.investments, cf.total_investments),
        (
            if cf.surplus_or_deficit >= 0.0 { &labels.surplus } else { &labels.deficit },
            cf.surplus_or_deficit,
        ),
    ];

    for (i, (label, value)) in items.iter().enumerate() {
        let cy = top + i as f32 * 12.0;
        write_text(&ctx, label, MARGIN_LEFT, cy + 4.0, 9.0, true);
        write_text_right(&ctx, &format_currency(*value, sym), MARGIN_LEFT + CONTENT_W, cy + 4.0, 9.0, false);
    }

    top += 55.0;

    // Expense categories breakdown
    if !cf.expense_categories.is_empty() {
        write_text(&ctx, &labels.expenses, MARGIN_LEFT, top, 9.0, true);
        top += 6.0;

        for (i, cat) in cf.expense_categories.iter().enumerate() {
            if top > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
                break;
            }
            let cy = top + i as f32 * 5.5;
            write_text(&ctx, &truncate(&cat.category, 30), MARGIN_LEFT + 4.0, cy + 4.0, 7.0, false);
            write_text_right(&ctx, &format_currency(cat.amount, sym), MARGIN_LEFT + CONTENT_W, cy + 4.0, 7.0, false);
        }
    }
}

// ── Investment Holdings page ────────────────────────────────────────

fn draw_holdings_page(doc: &PdfDocumentReference, fonts: &PdfFonts, data: &ReportData, page_num: usize) -> bool {
    let portfolio = match &data.portfolio {
        Some(p) if !p.holdings.is_empty() => p,
        _ => return false,
    };

    let layer = add_page(doc, fonts, page_num, &data.labels);
    let ctx = PageCtx { layer: &layer, fonts };
    let labels = &data.labels;
    let sym = &data.currency_symbol;

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&ctx, &labels.investment_holdings, top);

    // Portfolio summary
    write_text(&ctx, &labels.portfolio_total, MARGIN_LEFT, top + 4.0, 9.0, true);
    write_text_right(&ctx, &format_currency(portfolio.total_value, sym), MARGIN_LEFT + CONTENT_W, top + 4.0, 9.0, false);
    top += 8.0;

    write_text(&ctx, &labels.cost_basis, MARGIN_LEFT, top + 4.0, 8.0, false);
    write_text_right(&ctx, &format_currency(portfolio.total_cost_basis, sym), MARGIN_LEFT + CONTENT_W, top + 4.0, 8.0, false);
    top += 7.0;

    write_text(&ctx, &labels.overall_roi, MARGIN_LEFT, top + 4.0, 8.0, false);
    write_text_right(&ctx, &format_percent(portfolio.overall_roi), MARGIN_LEFT + CONTENT_W, top + 4.0, 8.0, false);
    top += 10.0;

    // Holdings table
    let cols = vec![
        TableColumn { header: labels.ticker.clone(), width: 25.0, align_right: false },
        TableColumn { header: labels.shares.clone(), width: 25.0, align_right: true },
        TableColumn { header: labels.price.clone(), width: 25.0, align_right: true },
        TableColumn { header: labels.value.clone(), width: 30.0, align_right: true },
        TableColumn { header: labels.cost_basis.clone(), width: 30.0, align_right: true },
        TableColumn { header: labels.roi.clone(), width: 25.0, align_right: true },
    ];

    top = draw_table_header(&ctx, &cols, top);

    for (i, h) in portfolio.holdings.iter().enumerate() {
        if top > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
            break;
        }
        top = draw_table_row(
            &ctx,
            &cols,
            &[
                h.ticker.clone(),
                format!("{:.4}", h.shares),
                format_currency(h.price, sym),
                format_currency(h.current_value, sym),
                format_currency(h.cost_basis, sym),
                format_percent(h.roi),
            ],
            top,
            i % 2 == 1,
        );
    }

    true
}

// ── Transaction listing pages ───────────────────────────────────────

fn draw_transactions_pages(
    doc: &PdfDocumentReference,
    fonts: &PdfFonts,
    data: &ReportData,
    mut page_num: usize,
) -> usize {
    let labels = &data.labels;
    let sym = &data.currency_symbol;

    let cash_cols = vec![
        TableColumn { header: labels.date.clone(), width: 22.0, align_right: false },
        TableColumn { header: labels.payee.clone(), width: 42.0, align_right: false },
        TableColumn { header: labels.category.clone(), width: 30.0, align_right: false },
        TableColumn { header: labels.amount.clone(), width: 28.0, align_right: true },
        TableColumn { header: labels.notes.clone(), width: 48.0, align_right: false },
    ];

    let inv_cols = vec![
        TableColumn { header: labels.date.clone(), width: 22.0, align_right: false },
        TableColumn { header: labels.ticker.clone(), width: 22.0, align_right: false },
        TableColumn { header: labels.shares.clone(), width: 22.0, align_right: true },
        TableColumn { header: labels.price.clone(), width: 28.0, align_right: true },
        TableColumn { header: labels.fee.clone(), width: 22.0, align_right: true },
        TableColumn { header: labels.amount.clone(), width: 28.0, align_right: true },
    ];

    for account_txs in &data.accounts_transactions {
        page_num += 1;
        let mut layer = add_page(doc, fonts, page_num, labels);
        let mut ctx = PageCtx { layer: &layer, fonts };

        let mut top = MARGIN_TOP + HEADER_HEIGHT;
        top = draw_section_title(&ctx, &format!("{} — {}", &account_txs.account_name, &account_txs.currency), top);

        if account_txs.transactions.is_empty() {
            write_text_color(&ctx, &labels.no_transactions, MARGIN_LEFT, top + 10.0, 10.0, false, 0.5, 0.5, 0.5);
            continue;
        }

        // Separate cash and investment transactions
        let cash_txs: Vec<_> = account_txs.transactions.iter().filter(|t| t.ticker.is_empty()).collect();
        let inv_txs: Vec<_> = account_txs.transactions.iter().filter(|t| !t.ticker.is_empty()).collect();

        // Cash transactions
        if !cash_txs.is_empty() {
            write_text(&ctx, &labels.transactions_title, MARGIN_LEFT, top, 9.0, true);
            top += 6.0;
            top = draw_table_header(&ctx, &cash_cols, top);

            for (i, tx) in cash_txs.iter().enumerate() {
                if top > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
                    // New page
                    page_num += 1;
                    layer = add_page(doc, fonts, page_num, labels);
                    ctx = PageCtx { layer: &layer, fonts };
                    top = MARGIN_TOP + HEADER_HEIGHT;
                    top = draw_table_header(&ctx, &cash_cols, top);
                }
                top = draw_table_row(
                    &ctx,
                    &cash_cols,
                    &[
                        tx.date.clone(),
                        truncate(&tx.payee, 25),
                        truncate(&tx.category, 18),
                        format_currency(tx.amount, sym),
                        truncate(&tx.notes, 30),
                    ],
                    top,
                    i % 2 == 1,
                );
            }
            top += 6.0;
        }

        // Investment transactions
        if !inv_txs.is_empty() {
            if top > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 30.0 {
                page_num += 1;
                layer = add_page(doc, fonts, page_num, labels);
                ctx = PageCtx { layer: &layer, fonts };
                top = MARGIN_TOP + HEADER_HEIGHT;
            }

            write_text(&ctx, &labels.investment_holdings, MARGIN_LEFT, top, 9.0, true);
            top += 6.0;
            top = draw_table_header(&ctx, &inv_cols, top);

            for (i, tx) in inv_txs.iter().enumerate() {
                if top > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
                    page_num += 1;
                    layer = add_page(doc, fonts, page_num, labels);
                    ctx = PageCtx { layer: &layer, fonts };
                    top = MARGIN_TOP + HEADER_HEIGHT;
                    top = draw_table_header(&ctx, &inv_cols, top);
                }
                top = draw_table_row(
                    &ctx,
                    &inv_cols,
                    &[
                        tx.date.clone(),
                        tx.ticker.clone(),
                        format!("{:.4}", tx.shares),
                        format_currency(tx.price_per_share, sym),
                        format_currency(tx.fee, sym),
                        format_currency(tx.amount, sym),
                    ],
                    top,
                    i % 2 == 1,
                );
            }
        }
    }

    page_num
}

// ── Public entry point ──────────────────────────────────────────────

pub fn generate_report(data: &ReportData) -> Result<Vec<u8>, String> {
    let (doc, _, _) = PdfDocument::new("HoneyBear Folio Report", mm(PAGE_W), mm(PAGE_H), "Cover");

    let font_regular = doc
        .add_external_font(std::io::Cursor::new(FONT_REGULAR))
        .map_err(|e| format!("Failed to load regular font: {}", e))?;
    let font_bold = doc
        .add_external_font(std::io::Cursor::new(FONT_BOLD))
        .map_err(|e| format!("Failed to load bold font: {}", e))?;

    let fonts = PdfFonts {
        regular: font_regular,
        bold: font_bold,
    };

    // The first page created by PdfDocument::new is unused; we draw our own cover.
    // printpdf always creates an initial page, so page 1 is the cover.

    draw_cover_page(&doc, &fonts, data);
    draw_summary_page(&doc, &fonts, data);
    draw_net_worth_page(&doc, &fonts, data);
    draw_income_expenses_page(&doc, &fonts, data);

    let mut next_page: usize = 5;
    draw_expense_breakdown_page(&doc, &fonts, data, next_page);
    next_page += 1;
    draw_income_breakdown_page(&doc, &fonts, data, next_page);
    next_page += 1;
    draw_cash_flow_page(&doc, &fonts, data, next_page);
    next_page += 1;

    if draw_holdings_page(&doc, &fonts, data, next_page) {
        next_page += 1;
    }

    draw_transactions_pages(&doc, &fonts, data, next_page);

    let mut buf = Vec::new();
    doc.save(&mut std::io::BufWriter::new(std::io::Cursor::new(&mut buf)))
        .map_err(|e| format!("Failed to save PDF: {}", e))?;

    Ok(buf)
}

#[tauri::command]
pub fn generate_pdf_report(file_path: String, data: ReportData) -> Result<(), String> {
    let pdf_bytes = generate_report(&data)?;
    let file = File::create(&file_path).map_err(|e| format!("Failed to create file: {}", e))?;
    let mut writer = BufWriter::new(file);
    std::io::Write::write_all(&mut writer, &pdf_bytes)
        .map_err(|e| format!("Failed to write PDF: {}", e))?;
    Ok(())
}
