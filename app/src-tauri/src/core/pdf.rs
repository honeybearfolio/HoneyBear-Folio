use crate::models::ReportData;
use printpdf::{
    Color, FontId, LinePoint, Mm, Op, PdfDocument, PdfFontHandle, PdfPage, PdfSaveOptions,
    PdfWarnMsg, Point, PaintMode, Polygon, PolygonRing, Pt, RawImage, RawImageData,
    RawImageFormat, Rgb, TextItem, WindingOrder, XObjectId, XObjectTransform,
    Line,
};
use std::fs::File;
use std::io::BufWriter;

// Embed fonts at compile-time
const FONT_REGULAR: &[u8] = include_bytes!("../assets/LiberationSans-Regular.ttf");
const FONT_BOLD: &[u8] = include_bytes!("../assets/LiberationSans-Bold.ttf");
const APP_ICON: &[u8] = include_bytes!("../../icons/128x128.png");

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
    regular: FontId,
    bold: FontId,
    icon: Option<(XObjectId, f32, f32)>, // (xobj_id, icon_size_mm, dpi)
}

// ── Coordinate helpers ───────────────────────────────────────────────

fn x_pt(x_mm: f32) -> Pt {
    Mm(x_mm).into_pt()
}

fn y_pt(from_top_mm: f32) -> Pt {
    Mm(PAGE_H - from_top_mm).into_pt()
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

fn write_text(ops: &mut Vec<Op>, fonts: &PdfFonts, text: &str, x: f32, from_top: f32, size: f32, bold: bool) {
    let font_id = if bold { fonts.bold.clone() } else { fonts.regular.clone() };
    // Always set explicit dark color to prevent color inheritance from previous draw calls
    ops.push(Op::SetFillColor { col: Color::Rgb(Rgb::new(0.15, 0.15, 0.15, None)) });
    ops.push(Op::StartTextSection);
    ops.push(Op::SetFont { font: PdfFontHandle::External(font_id), size: Pt(size) });
    ops.push(Op::SetTextCursor { pos: Point { x: x_pt(x), y: y_pt(from_top) } });
    ops.push(Op::ShowText { items: vec![TextItem::Text(text.to_string())] });
    ops.push(Op::EndTextSection);
}

#[allow(clippy::too_many_arguments)]
fn write_text_color(
    ops: &mut Vec<Op>,
    fonts: &PdfFonts,
    text: &str,
    x: f32,
    from_top: f32,
    size: f32,
    bold: bool,
    color: Color,
) {
    let font_id = if bold { fonts.bold.clone() } else { fonts.regular.clone() };
    ops.push(Op::SetFillColor { col: color });
    ops.push(Op::StartTextSection);
    ops.push(Op::SetFont { font: PdfFontHandle::External(font_id), size: Pt(size) });
    ops.push(Op::SetTextCursor { pos: Point { x: x_pt(x), y: y_pt(from_top) } });
    ops.push(Op::ShowText { items: vec![TextItem::Text(text.to_string())] });
    ops.push(Op::EndTextSection);
    // Reset to dark text color to prevent color bleeding into subsequent draws
    ops.push(Op::SetFillColor { col: Color::Rgb(Rgb::new(0.15, 0.15, 0.15, None)) });
}

/// Approximate text width in mm for Liberation Sans at a given pt size.
fn text_width(text: &str, size_pt: f32) -> f32 {
    // Liberation Sans average character width ≈ 0.52 × font size in pt → mm
    let avg_char_mm = size_pt * 0.52 * 0.3528; // pt → mm ≈ 0.3528
    text.chars().count() as f32 * avg_char_mm
}

fn write_text_right(ops: &mut Vec<Op>, fonts: &PdfFonts, text: &str, right_x: f32, from_top: f32, size: f32, bold: bool) {
    let w = text_width(text, size);
    write_text(ops, fonts, text, right_x - w, from_top, size, bold);
}

#[allow(clippy::too_many_arguments)]
fn write_text_right_color(
    ops: &mut Vec<Op>,
    fonts: &PdfFonts,
    text: &str,
    right_x: f32,
    from_top: f32,
    size: f32,
    bold: bool,
    color: Color,
) {
    let w = text_width(text, size);
    write_text_color(ops, fonts, text, right_x - w, from_top, size, bold, color);
}

// ── Shapes ──────────────────────────────────────────────────────────

fn draw_rect(ops: &mut Vec<Op>, x: f32, from_top: f32, w: f32, h: f32, color: Color) {
    // DrawRectangle in printpdf 0.9 has a bug where it uses W+n (clipping) instead of fill.
    // Use DrawPolygon which correctly handles PaintMode::Fill.
    ops.push(Op::SetFillColor { col: color });
    ops.push(Op::DrawPolygon {
        polygon: Polygon {
            rings: vec![PolygonRing {
                points: vec![
                    LinePoint { p: Point { x: x_pt(x),     y: y_pt(from_top + h) }, bezier: false },
                    LinePoint { p: Point { x: x_pt(x + w), y: y_pt(from_top + h) }, bezier: false },
                    LinePoint { p: Point { x: x_pt(x + w), y: y_pt(from_top)     }, bezier: false },
                    LinePoint { p: Point { x: x_pt(x),     y: y_pt(from_top)     }, bezier: false },
                ],
            }],
            mode: PaintMode::Fill,
            winding_order: WindingOrder::NonZero,
        },
    });
}

fn draw_line(
    ops: &mut Vec<Op>,
    x1: f32,
    y1_top: f32,
    x2: f32,
    y2_top: f32,
    width: f32,
    color: Color,
) {
    ops.push(Op::SetOutlineColor { col: color });
    ops.push(Op::SetOutlineThickness { pt: Pt(width) });
    ops.push(Op::DrawLine {
        line: Line {
            points: vec![
                LinePoint { p: Point { x: x_pt(x1), y: y_pt(y1_top) }, bezier: false },
                LinePoint { p: Point { x: x_pt(x2), y: y_pt(y2_top) }, bezier: false },
            ],
            is_closed: false,
        },
    });
}

// ── Header / Footer ────────────────────────────────────────────────

fn draw_header_footer(ops: &mut Vec<Op>, fonts: &PdfFonts, page_num: usize, data: &ReportData) {
    let labels = &data.labels;

    // Header: brand bar
    draw_rect(
        ops,
        0.0,
        0.0,
        PAGE_W,
        HEADER_HEIGHT,
        Color::Rgb(Rgb::new(BRAND_R, BRAND_G, BRAND_B, None)),
    );

    // Header: Icon
    if let Some((ref icon_id, icon_size_mm, _dpi)) = fonts.icon {
        let icon_target_size_mm = icon_size_mm;
        let translate_y = Mm(PAGE_H - HEADER_HEIGHT + (HEADER_HEIGHT - icon_target_size_mm) / 2.0).into_pt();
        ops.push(Op::UseXobject {
            id: icon_id.clone(),
            transform: XObjectTransform {
                translate_x: Some(Mm(MARGIN_LEFT).into_pt()),
                translate_y: Some(translate_y),
                dpi: Some(_dpi),
                ..Default::default()
            },
        });
    }

    write_text_color(
        ops,
        fonts,
        "HoneyBear Folio",
        MARGIN_LEFT + 10.0,
        8.5,
        9.0,
        true,
        Color::Rgb(Rgb::new(1.0, 1.0, 1.0, None)),
    );

    // Add date range and generation date to the right side of the header
    let right_text = format!(
        "{} — {} | {}",
        data.date_range_start, data.date_range_end, data.currency_symbol
    );
    write_text_right_color(
        ops,
        fonts,
        &right_text,
        PAGE_W - MARGIN_RIGHT,
        8.5,
        7.0,
        false,
        Color::Rgb(Rgb::new(1.0, 1.0, 1.0, None)),
    );

    // Footer: thin accent line + page number
    draw_line(
        ops,
        MARGIN_LEFT,
        PAGE_H - 12.0,
        MARGIN_LEFT + CONTENT_W,
        PAGE_H - 12.0,
        0.3,
        Color::Rgb(Rgb::new(0.85, 0.85, 0.85, None)),
    );
    let page_text = format!("{} {}", labels.page, page_num);
    let tw = text_width(&page_text, 8.0);
    let center_x = (PAGE_W - tw) / 2.0;
    write_text_color(
        ops,
        fonts,
        &page_text,
        center_x,
        PAGE_H - 6.0,
        8.0,
        false,
        Color::Rgb(Rgb::new(0.5, 0.5, 0.5, None)),
    );
}

fn draw_section_title(ops: &mut Vec<Op>, fonts: &PdfFonts, title: &str, from_top: f32) -> f32 {
    write_text_color(
        ops,
        fonts,
        title,
        MARGIN_LEFT,
        from_top,
        14.0,
        true,
        Color::Rgb(Rgb::new(BRAND_R, BRAND_G, BRAND_B, None)),
    );
    // Underline
    draw_line(
        ops,
        MARGIN_LEFT,
        from_top + 2.0,
        MARGIN_LEFT + CONTENT_W,
        from_top + 2.0,
        0.5,
        Color::Rgb(Rgb::new(BRAND_R, BRAND_G, BRAND_B, None)),
    );
    from_top + 8.0
}

// ── Table drawing ───────────────────────────────────────────────────

struct TableColumn {
    header: String,
    width: f32,
    align_right: bool,
}

fn draw_table_header(ops: &mut Vec<Op>, fonts: &PdfFonts, cols: &[TableColumn], from_top: f32) -> f32 {
    // Header background — warm light amber tint
    draw_rect(
        ops,
        MARGIN_LEFT,
        from_top,
        CONTENT_W,
        6.0,
        Color::Rgb(Rgb::new(0.99, 0.96, 0.90, None)),
    );

    let mut x = MARGIN_LEFT + 1.0;
    for col in cols {
        if col.align_right {
            write_text_right(
                ops,
                fonts,
                &col.header,
                x + col.width - 1.0,
                from_top + 4.0,
                7.0,
                true,
            );
        } else {
            write_text(ops, fonts, &col.header, x, from_top + 4.0, 7.0, true);
        }
        x += col.width;
    }
    from_top + 7.0
}

fn draw_table_row(
    ops: &mut Vec<Op>,
    fonts: &PdfFonts,
    cols: &[TableColumn],
    values: &[String],
    from_top: f32,
    zebra: bool,
) -> f32 {
    if zebra {
        draw_rect(
            ops,
            MARGIN_LEFT,
            from_top,
            CONTENT_W,
            5.5,
            Color::Rgb(Rgb::new(0.98, 0.98, 0.97, None)),
        );
    }
    let mut x = MARGIN_LEFT + 1.0;
    for (i, col) in cols.iter().enumerate() {
        let val = values.get(i).map(|s| s.as_str()).unwrap_or("");
        let display = truncate(val, (col.width / 1.5) as usize);
        if col.align_right {
            write_text_right(
                ops,
                fonts,
                &display,
                x + col.width - 1.0,
                from_top + 4.0,
                7.0,
                false,
            );
        } else {
            write_text(ops, fonts, &display, x, from_top + 4.0, 7.0, false);
        }
        x += col.width;
    }
    from_top + 5.5
}

// ── Page factory ────────────────────────────────────────────────────

fn start_page(fonts: &PdfFonts, page_num: usize, data: &ReportData) -> Vec<Op> {
    let mut ops = Vec::new();
    draw_header_footer(&mut ops, fonts, page_num, data);
    ops
}

fn finish_page(doc: &mut PdfDocument, ops: Vec<Op>) {
    doc.pages.push(PdfPage::new(Mm(PAGE_W), Mm(PAGE_H), ops));
}

// ── Financial Summary page ──────────────────────────────────────────

fn draw_summary_page(doc: &mut PdfDocument, fonts: &PdfFonts, data: &ReportData) {
    let mut ops = start_page(fonts, 1, data);
    let sym = &data.currency_symbol;
    let labels = &data.labels;
    let s = &data.summary;

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&mut ops, fonts, &labels.financial_summary, top);

    // Key metrics as a card grid
    let metrics = [
        (&labels.net_worth, format_currency(s.net_worth, sym)),
        (&labels.total_income, format_currency(s.total_income, sym)),
        (
            &labels.total_expenses,
            format_currency(s.total_expenses, sym),
        ),
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
        draw_rect(
            &mut ops,
            cx,
            cy,
            card_w,
            17.0,
            Color::Rgb(Rgb::new(1.0, 0.98, 0.93, None)),
        );
        // Left accent bar
        draw_rect(
            &mut ops,
            cx,
            cy,
            1.2,
            17.0,
            Color::Rgb(Rgb::new(BRAND_R, BRAND_G, BRAND_B, None)),
        );
        write_text_color(
            &mut ops,
            fonts,
            label,
            cx + 4.0,
            cy + 6.0,
            7.0,
            false,
            Color::Rgb(Rgb::new(0.4, 0.4, 0.4, None)),
        );
        write_text(&mut ops, fonts, value, cx + 4.0, cy + 12.0, 11.0, true);
    }

    top += 45.0;

    // Account balances table
    top = draw_section_title(&mut ops, fonts, &labels.accounts, top);

    let cols = vec![
        TableColumn {
            header: labels.account.clone(),
            width: 45.0,
            align_right: false,
        },
        TableColumn {
            header: labels.currency.clone(),
            width: 20.0,
            align_right: false,
        },
        TableColumn {
            header: labels.cash_balance.clone(),
            width: 35.0,
            align_right: true,
        },
        TableColumn {
            header: labels.market_value.clone(),
            width: 35.0,
            align_right: true,
        },
        TableColumn {
            header: labels.total.clone(),
            width: 35.0,
            align_right: true,
        },
    ];

    top = draw_table_header(&mut ops, fonts, &cols, top);

    for (i, ab) in data.account_balances.iter().enumerate() {
        top = draw_table_row(
            &mut ops,
            fonts,
            &cols,
            &[
                ab.name.clone(),
                ab.currency.clone(),
                format_currency(ab.cash_balance, &ab.currency_symbol),
                format_currency(ab.market_value, &ab.currency_symbol),
                format_currency(ab.total, &ab.currency_symbol),
            ],
            top,
            i % 2 == 1,
        );
    }
    finish_page(doc, ops);
}

// ── Net Worth Evolution chart ───────────────────────────────────────

fn draw_net_worth_page(doc: &mut PdfDocument, fonts: &PdfFonts, data: &ReportData) {
    let mut ops = start_page(fonts, 2, data);

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&mut ops, fonts, &data.labels.net_worth_evolution, top);

    let points = &data.net_worth_points;
    if points.is_empty() {
        write_text_color(
            &mut ops,
            fonts,
            &data.labels.no_transactions,
            MARGIN_LEFT,
            top + 10.0,
            10.0,
            false,
            Color::Rgb(Rgb::new(0.5, 0.5, 0.5, None)),
        );
        finish_page(doc, ops);
        return;
    }

    // Chart area
    let chart_x = MARGIN_LEFT + 15.0;
    let chart_top = top + 5.0;
    let chart_w = CONTENT_W - 20.0;
    let chart_h = 100.0;

    let min_val = points.iter().map(|p| p.value).fold(f64::MAX, f64::min);
    let max_val = points.iter().map(|p| p.value).fold(f64::MIN, f64::max);
    let range = if (max_val - min_val).abs() < 0.01 {
        1.0
    } else {
        max_val - min_val
    };

    // Y-axis labels (5 ticks)
    for i in 0..=4 {
        let frac = i as f64 / 4.0;
        let val = min_val + frac * range;
        let yy = chart_top + chart_h - (frac as f32 * chart_h);
        write_text_right(
            &mut ops,
            fonts,
            &format_currency(val, &data.currency_symbol),
            chart_x - 2.0,
            yy + 1.5,
            6.0,
            false,
        );
        // Grid line
        draw_line(
            &mut ops,
            chart_x,
            yy,
            chart_x + chart_w,
            yy,
            0.2,
            Color::Rgb(Rgb::new(0.85, 0.85, 0.85, None)),
        );
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
            draw_line(
                &mut ops,
                x1,
                y1_top,
                x2,
                y2_top,
                0.8,
                Color::Rgb(Rgb::new(BRAND_R, BRAND_G, BRAND_B, None)),
            );
        }
    }

    // X-axis labels (show ~6 evenly spaced)
    let label_count = 6.min(n);
    for i in 0..label_count {
        let idx = if label_count > 1 {
            i * (n - 1) / (label_count - 1)
        } else {
            0
        };
        let x = chart_x + (idx as f32 / (n - 1).max(1) as f32) * chart_w;
        write_text_color(
            &mut ops,
            fonts,
            &truncate(&points[idx].label, 10),
            x,
            chart_top + chart_h + 4.0,
            5.5,
            false,
            Color::Rgb(Rgb::new(0.5, 0.5, 0.5, None)),
        );
    }
    finish_page(doc, ops);
}

// ── Income vs Expenses chart ────────────────────────────────────────

fn draw_income_expenses_page(doc: &mut PdfDocument, fonts: &PdfFonts, data: &ReportData) {
    let mut ops = start_page(fonts, 3, data);
    let labels = &data.labels;
    let sym = &data.currency_symbol;

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&mut ops, fonts, &labels.income_vs_expenses, top);

    let months = &data.monthly_income_expenses;
    if months.is_empty() {
        write_text_color(
            &mut ops,
            fonts,
            &labels.no_transactions,
            MARGIN_LEFT,
            top + 10.0,
            10.0,
            false,
            Color::Rgb(Rgb::new(0.5, 0.5, 0.5, None)),
        );
        finish_page(doc, ops);
        return;
    }

    // Grouped bar chart
    let chart_x = MARGIN_LEFT + 15.0;
    let chart_top = top + 5.0;
    let chart_w = CONTENT_W - 20.0;
    let chart_h = 80.0;

    let max_val = months
        .iter()
        .map(|m| m.income.max(m.expenses))
        .fold(0.0_f64, f64::max);
    let ceiling = if max_val < 0.01 { 1.0 } else { max_val };

    // Y-axis
    for i in 0..=4 {
        let frac = i as f64 / 4.0;
        let val = frac * ceiling;
        let yy = chart_top + chart_h - (frac as f32 * chart_h);
        write_text_right(
            &mut ops,
            fonts,
            &format_currency(val, sym),
            chart_x - 2.0,
            yy + 1.5,
            6.0,
            false,
        );
        draw_line(
            &mut ops,
            chart_x,
            yy,
            chart_x + chart_w,
            yy,
            0.2,
            Color::Rgb(Rgb::new(0.85, 0.85, 0.85, None)),
        );
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
            draw_rect(
                &mut ops,
                center - bar_w - 0.5,
                chart_top + chart_h - ih,
                bar_w,
                ih,
                Color::Rgb(Rgb::new(
                    CHART_INCOME_R,
                    CHART_INCOME_G,
                    CHART_INCOME_B,
                    None,
                )),
            );
        }

        // Expense bar
        let eh = (m.expenses / ceiling) as f32 * chart_h;
        if eh > 0.1 {
            draw_rect(
                &mut ops,
                center + 0.5,
                chart_top + chart_h - eh,
                bar_w,
                eh,
                Color::Rgb(Rgb::new(
                    CHART_EXPENSE_R,
                    CHART_EXPENSE_G,
                    CHART_EXPENSE_B,
                    None,
                )),
            );
        }

        // Label
        write_text_color(
            &mut ops,
            fonts,
            &truncate(&m.label, 6),
            center - 4.0,
            chart_top + chart_h + 4.0,
            5.5,
            false,
            Color::Rgb(Rgb::new(0.5, 0.5, 0.5, None)),
        );
    }

    // Legend
    let legend_top = chart_top + chart_h + 10.0;
    draw_rect(
        &mut ops,
        MARGIN_LEFT,
        legend_top,
        4.0,
        3.0,
        Color::Rgb(Rgb::new(
            CHART_INCOME_R,
            CHART_INCOME_G,
            CHART_INCOME_B,
            None,
        )),
    );
    write_text(
        &mut ops,
        fonts,
        &labels.income,
        MARGIN_LEFT + 6.0,
        legend_top + 2.5,
        7.0,
        false,
    );
    draw_rect(
        &mut ops,
        MARGIN_LEFT + 40.0,
        legend_top,
        4.0,
        3.0,
        Color::Rgb(Rgb::new(
            CHART_EXPENSE_R,
            CHART_EXPENSE_G,
            CHART_EXPENSE_B,
            None,
        )),
    );
    write_text(
        &mut ops,
        fonts,
        &labels.expenses,
        MARGIN_LEFT + 46.0,
        legend_top + 2.5,
        7.0,
        false,
    );

    // Summary table
    let table_top = legend_top + 12.0;
    let cols = vec![
        TableColumn {
            header: labels.month.clone(),
            width: 40.0,
            align_right: false,
        },
        TableColumn {
            header: labels.income.clone(),
            width: 40.0,
            align_right: true,
        },
        TableColumn {
            header: labels.expenses.clone(),
            width: 40.0,
            align_right: true,
        },
        TableColumn {
            header: labels.net.clone(),
            width: 40.0,
            align_right: true,
        },
    ];

    let mut tt = draw_table_header(&mut ops, fonts, &cols, table_top);
    for (i, m) in months.iter().enumerate() {
        if tt > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
            break; // Prevent overflow — truncate if too many months
        }
        tt = draw_table_row(
            &mut ops,
            fonts,
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
    finish_page(doc, ops);
}

// ── Expense Breakdown page ──────────────────────────────────────────

fn draw_expense_breakdown_page(
    doc: &mut PdfDocument,
    fonts: &PdfFonts,
    data: &ReportData,
    page_num: usize,
) {
    let mut ops = start_page(fonts, page_num, data);
    let labels = &data.labels;
    let sym = &data.currency_symbol;

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&mut ops, fonts, &labels.expense_breakdown, top);

    let cats = &data.expense_categories;
    if cats.is_empty() {
        write_text_color(
            &mut ops,
            fonts,
            &labels.no_transactions,
            MARGIN_LEFT,
            top + 10.0,
            10.0,
            false,
            Color::Rgb(Rgb::new(0.5, 0.5, 0.5, None)),
        );
        finish_page(doc, ops);
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
        write_text(&mut ops, fonts, &label, MARGIN_LEFT, cy + 4.0, 6.5, false);
        let bw = if max_amount > 0.0 {
            (cat.amount / max_amount) as f32 * bar_max_w
        } else {
            0.0
        };
        draw_rect(
            &mut ops,
            chart_x,
            cy + 0.5,
            bw.max(1.0),
            bar_h,
            Color::Rgb(Rgb::new(
                CHART_EXPENSE_R,
                CHART_EXPENSE_G,
                CHART_EXPENSE_B,
                None,
            )),
        );
        write_text(
            &mut ops,
            fonts,
            &format_currency(cat.amount, sym),
            chart_x + bw + 2.0,
            cy + 4.0,
            6.0,
            false,
        );
    }

    // Table below
    let table_top = top + (cats.len().min(15) as f32 * 8.0) + 10.0;
    let cols = vec![
        TableColumn {
            header: labels.category.clone(),
            width: 60.0,
            align_right: false,
        },
        TableColumn {
            header: labels.amount.clone(),
            width: 50.0,
            align_right: true,
        },
        TableColumn {
            header: labels.percentage.clone(),
            width: 30.0,
            align_right: true,
        },
    ];

    let mut tt = draw_table_header(&mut ops, fonts, &cols, table_top);
    for (i, cat) in cats.iter().enumerate() {
        if tt > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
            break;
        }
        tt = draw_table_row(
            &mut ops,
            fonts,
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
    finish_page(doc, ops);
}

// ── Income Breakdown page ───────────────────────────────────────────

fn draw_income_breakdown_page(
    doc: &mut PdfDocument,
    fonts: &PdfFonts,
    data: &ReportData,
    page_num: usize,
) {
    let mut ops = start_page(fonts, page_num, data);
    let labels = &data.labels;
    let sym = &data.currency_symbol;

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&mut ops, fonts, &labels.income_breakdown, top);

    let cats = &data.income_categories;
    if cats.is_empty() {
        write_text_color(
            &mut ops,
            fonts,
            &labels.no_transactions,
            MARGIN_LEFT,
            top + 10.0,
            10.0,
            false,
            Color::Rgb(Rgb::new(0.5, 0.5, 0.5, None)),
        );
        finish_page(doc, ops);
        return;
    }

    let cols = vec![
        TableColumn {
            header: labels.category.clone(),
            width: 60.0,
            align_right: false,
        },
        TableColumn {
            header: labels.amount.clone(),
            width: 50.0,
            align_right: true,
        },
        TableColumn {
            header: labels.percentage.clone(),
            width: 30.0,
            align_right: true,
        },
    ];

    top = draw_table_header(&mut ops, fonts, &cols, top);

    for (i, cat) in cats.iter().enumerate() {
        if top > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
            break;
        }
        top = draw_table_row(
            &mut ops,
            fonts,
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
    finish_page(doc, ops);
}

// ── Cash Flow Summary page ──────────────────────────────────────────

fn draw_cash_flow_page(
    doc: &mut PdfDocument,
    fonts: &PdfFonts,
    data: &ReportData,
    page_num: usize,
) {
    let mut ops = start_page(fonts, page_num, data);
    let labels = &data.labels;
    let sym = &data.currency_symbol;
    let cf = &data.cash_flow;

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&mut ops, fonts, &labels.cash_flow_summary, top);

    // Overview cards
    let items = [
        (&labels.total_income, cf.total_income),
        (&labels.total_expenses, cf.total_expenses),
        (&labels.investments, cf.total_investments),
        (
            if cf.surplus_or_deficit >= 0.0 {
                &labels.surplus
            } else {
                &labels.deficit
            },
            cf.surplus_or_deficit,
        ),
    ];

    for (i, (label, value)) in items.iter().enumerate() {
        let cy = top + i as f32 * 12.0;
        write_text(&mut ops, fonts, label, MARGIN_LEFT, cy + 4.0, 9.0, true);
        write_text_right(
            &mut ops,
            fonts,
            &format_currency(*value, sym),
            MARGIN_LEFT + CONTENT_W,
            cy + 4.0,
            9.0,
            false,
        );
    }

    top += 55.0;

    // Expense categories breakdown
    if !cf.expense_categories.is_empty() {
        write_text(&mut ops, fonts, &labels.expenses, MARGIN_LEFT, top, 9.0, true);
        top += 6.0;

        for (i, cat) in cf.expense_categories.iter().enumerate() {
            if top > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
                break;
            }
            let cy = top + i as f32 * 5.5;
            write_text(
                &mut ops,
                fonts,
                &truncate(&cat.category, 30),
                MARGIN_LEFT + 4.0,
                cy + 4.0,
                7.0,
                false,
            );
            write_text_right(
                &mut ops,
                fonts,
                &format_currency(cat.amount, sym),
                MARGIN_LEFT + CONTENT_W,
                cy + 4.0,
                7.0,
                false,
            );
        }
    }
    finish_page(doc, ops);
}

// ── Investment Holdings page ────────────────────────────────────────

fn draw_holdings_page(
    doc: &mut PdfDocument,
    fonts: &PdfFonts,
    data: &ReportData,
    page_num: usize,
) -> bool {
    let portfolio = match &data.portfolio {
        Some(p) if !p.holdings.is_empty() => p,
        _ => return false,
    };

    let mut ops = start_page(fonts, page_num, data);
    let labels = &data.labels;
    let sym = &data.currency_symbol;

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&mut ops, fonts, &labels.investment_holdings, top);

    // Portfolio summary
    write_text(
        &mut ops,
        fonts,
        &labels.portfolio_total,
        MARGIN_LEFT,
        top + 4.0,
        9.0,
        true,
    );
    write_text_right(
        &mut ops,
        fonts,
        &format_currency(portfolio.total_value, sym),
        MARGIN_LEFT + CONTENT_W,
        top + 4.0,
        9.0,
        false,
    );
    top += 8.0;

    write_text(&mut ops, fonts, &labels.cost_basis, MARGIN_LEFT, top + 4.0, 8.0, false);
    write_text_right(
        &mut ops,
        fonts,
        &format_currency(portfolio.total_cost_basis, sym),
        MARGIN_LEFT + CONTENT_W,
        top + 4.0,
        8.0,
        false,
    );
    top += 7.0;

    write_text(
        &mut ops,
        fonts,
        &labels.overall_roi,
        MARGIN_LEFT,
        top + 4.0,
        8.0,
        false,
    );
    write_text_right(
        &mut ops,
        fonts,
        &format_percent(portfolio.overall_roi),
        MARGIN_LEFT + CONTENT_W,
        top + 4.0,
        8.0,
        false,
    );
    top += 10.0;

    // Holdings table
    let cols = vec![
        TableColumn {
            header: labels.ticker.clone(),
            width: 25.0,
            align_right: false,
        },
        TableColumn {
            header: labels.shares.clone(),
            width: 25.0,
            align_right: true,
        },
        TableColumn {
            header: labels.price.clone(),
            width: 25.0,
            align_right: true,
        },
        TableColumn {
            header: labels.value.clone(),
            width: 30.0,
            align_right: true,
        },
        TableColumn {
            header: labels.cost_basis.clone(),
            width: 30.0,
            align_right: true,
        },
        TableColumn {
            header: labels.roi.clone(),
            width: 25.0,
            align_right: true,
        },
    ];

    top = draw_table_header(&mut ops, fonts, &cols, top);

    for (i, h) in portfolio.holdings.iter().enumerate() {
        if top > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
            break;
        }
        top = draw_table_row(
            &mut ops,
            fonts,
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

    finish_page(doc, ops);
    true
}

// ── Transaction listing pages ───────────────────────────────────────

fn draw_transactions_pages(
    doc: &mut PdfDocument,
    fonts: &PdfFonts,
    data: &ReportData,
    mut page_num: usize,
) -> usize {
    let labels = &data.labels;

    // columns arranged date / payee / category / notes / amount
    // ensure total width stays comfortably under CONTENT_W so header background
    // doesn’t spill past the right margin (offset used in draw_table_header)
    let cash_cols = vec![
        TableColumn {
            header: labels.date.clone(),
            width: 22.0,
            align_right: false,
        },
        TableColumn {
            header: labels.payee.clone(),
            width: 42.0,
            align_right: false,
        },
        TableColumn {
            header: labels.category.clone(),
            width: 30.0,
            align_right: false,
        },
        // narrower notes column now that space is tight
        TableColumn {
            header: labels.notes.clone(),
            width: 40.0,
            align_right: false,
        },
        // still enough room for amounts
        TableColumn {
            header: labels.amount.clone(),
            width: 34.0,
            align_right: true,
        },
    ];

    let inv_cols = vec![
        TableColumn {
            header: labels.date.clone(),
            width: 22.0,
            align_right: false,
        },
        TableColumn {
            header: labels.ticker.clone(),
            width: 22.0,
            align_right: false,
        },
        TableColumn {
            header: labels.shares.clone(),
            width: 22.0,
            align_right: true,
        },
        TableColumn {
            header: labels.price.clone(),
            width: 28.0,
            align_right: true,
        },
        TableColumn {
            header: labels.fee.clone(),
            width: 22.0,
            align_right: true,
        },
        TableColumn {
            header: labels.amount.clone(),
            width: 28.0,
            align_right: true,
        },
    ];

    for account_txs in &data.accounts_transactions {
        page_num += 1;
        let mut ops = start_page(fonts, page_num, data);

        let mut top = MARGIN_TOP + HEADER_HEIGHT;
        top = draw_section_title(
            &mut ops,
            fonts,
            &format!("{} — {}", &account_txs.account_name, &account_txs.currency),
            top,
        );

        if account_txs.transactions.is_empty() {
            write_text_color(
                &mut ops,
                fonts,
                &labels.no_transactions,
                MARGIN_LEFT,
                top + 10.0,
                10.0,
                false,
                Color::Rgb(Rgb::new(0.5, 0.5, 0.5, None)),
            );
            finish_page(doc, ops);
            continue;
        }

        // Separate cash and investment transactions
        let cash_txs: Vec<_> = account_txs
            .transactions
            .iter()
            .filter(|t| t.ticker.is_empty())
            .collect();
        let inv_txs: Vec<_> = account_txs
            .transactions
            .iter()
            .filter(|t| !t.ticker.is_empty())
            .collect();

        // Cash transactions
        if !cash_txs.is_empty() {
            write_text(
                &mut ops,
                fonts,
                &labels.transactions_title,
                MARGIN_LEFT,
                top,
                9.0,
                true,
            );
            top += 6.0;
            top = draw_table_header(&mut ops, fonts, &cash_cols, top);

            for (i, tx) in cash_txs.iter().enumerate() {
                if top > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
                    // New page
                    finish_page(doc, ops);
                    page_num += 1;
                    ops = start_page(fonts, page_num, data);
                    top = MARGIN_TOP + HEADER_HEIGHT;
                    top = draw_table_header(&mut ops, fonts, &cash_cols, top);
                }
                top = draw_table_row(
                    &mut ops,
                    fonts,
                    &cash_cols,
                    &[
                        tx.date.clone(),
                        truncate(&tx.payee, 25),
                        truncate(&tx.category, 18),
                        // notes column now before amount
                        truncate(&tx.notes, 25),
                        format_currency(tx.amount, &account_txs.currency_symbol),
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
                finish_page(doc, ops);
                page_num += 1;
                ops = start_page(fonts, page_num, data);
                top = MARGIN_TOP + HEADER_HEIGHT;
            }

            write_text(
                &mut ops,
                fonts,
                &labels.investment_holdings,
                MARGIN_LEFT,
                top,
                9.0,
                true,
            );
            top += 6.0;
            top = draw_table_header(&mut ops, fonts, &inv_cols, top);

            for (i, tx) in inv_txs.iter().enumerate() {
                if top > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0 {
                    finish_page(doc, ops);
                    page_num += 1;
                    ops = start_page(fonts, page_num, data);
                    top = MARGIN_TOP + HEADER_HEIGHT;
                    top = draw_table_header(&mut ops, fonts, &inv_cols, top);
                }
                top = draw_table_row(
                    &mut ops,
                    fonts,
                    &inv_cols,
                    &[
                        tx.date.clone(),
                        tx.ticker.clone(),
                        format!("{:.4}", tx.shares),
                        format_currency(tx.price_per_share, &account_txs.currency_symbol),
                        format_currency(tx.fee, &account_txs.currency_symbol),
                        format_currency(tx.amount, &account_txs.currency_symbol),
                    ],
                    top,
                    i % 2 == 1,
                );
            }
        }

        finish_page(doc, ops);
    }

    page_num
}

// ── Public entry point ──────────────────────────────────────────────

pub fn generate_report(data: &ReportData) -> Result<Vec<u8>, String> {
    let mut doc = PdfDocument::new("HoneyBear Folio Report");

    // Load fonts using new ParsedFont API
    let font_regular = printpdf::ParsedFont::from_bytes(FONT_REGULAR, 0, &mut Vec::new())
        .ok_or_else(|| "Failed to load regular font".to_string())?;
    let font_bold = printpdf::ParsedFont::from_bytes(FONT_BOLD, 0, &mut Vec::new())
        .ok_or_else(|| "Failed to load bold font".to_string())?;

    let regular_id = doc.add_font(&font_regular);
    let bold_id = doc.add_font(&font_bold);

    // Register icon image using the image crate (always available)
    let icon_info = if let Ok(dynamic_img) = ::image::load_from_memory(APP_ICON) {
        let (width, height) = (dynamic_img.width(), dynamic_img.height());
        let icon_size_mm = 8.0_f32;
        let dpi = (width as f32 / icon_size_mm) * 25.4;
        let rgba = dynamic_img.to_rgba8();
        let raw_image = RawImage {
            pixels: RawImageData::U8(rgba.into_raw()),
            width: width as usize,
            height: height as usize,
            data_format: RawImageFormat::RGBA8,
            tag: Vec::new(),
        };
        let xobj_id = doc.add_image(&raw_image);
        Some((xobj_id, icon_size_mm, dpi))
    } else {
        None
    };

    let fonts = PdfFonts {
        regular: regular_id,
        bold: bold_id,
        icon: icon_info,
    };

    draw_summary_page(&mut doc, &fonts, data);
    draw_net_worth_page(&mut doc, &fonts, data);
    draw_income_expenses_page(&mut doc, &fonts, data);

    let mut next_page: usize = 4;
    draw_expense_breakdown_page(&mut doc, &fonts, data, next_page);
    next_page += 1;
    draw_income_breakdown_page(&mut doc, &fonts, data, next_page);
    next_page += 1;
    draw_cash_flow_page(&mut doc, &fonts, data, next_page);
    next_page += 1;

    if draw_holdings_page(&mut doc, &fonts, data, next_page) {
        next_page += 1;
    }

    draw_transactions_pages(&mut doc, &fonts, data, next_page);

    let mut warnings = Vec::<PdfWarnMsg>::new();
    let buf = doc.save(&PdfSaveOptions::default(), &mut warnings);

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
