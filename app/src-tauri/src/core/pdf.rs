use crate::models::ReportData;
use printpdf::{
    Color, FontId, Line, LinePoint, Mm, Op, PaintMode, PdfDocument, PdfFontHandle, PdfPage,
    PdfSaveOptions, PdfWarnMsg, Point, Polygon, PolygonRing, Pt, RawImage, RawImageData,
    RawImageFormat, Rgb, TextItem, WindingOrder, XObjectId, XObjectTransform,
};
use std::fs::File;
use std::io::BufWriter;

// Embed fonts at compile-time — Open Sans (Regular / Semibold / Bold)
const FONT_REGULAR: &[u8] = include_bytes!("../assets/OpenSans-Regular.ttf");
const FONT_SEMIBOLD: &[u8] = include_bytes!("../assets/OpenSans-Semibold.ttf");
const FONT_BOLD: &[u8] = include_bytes!("../assets/OpenSans-Bold.ttf");
const APP_ICON: &[u8] = include_bytes!("../../icons/128x128.png");

// Page dimensions (A4 in mm)
const PAGE_W: f32 = 210.0;
const PAGE_H: f32 = 297.0;
const MARGIN_LEFT: f32 = 22.0;
const MARGIN_RIGHT: f32 = 22.0;
const MARGIN_TOP: f32 = 22.0;
const MARGIN_BOTTOM: f32 = 20.0;
const CONTENT_W: f32 = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;
const HEADER_HEIGHT: f32 = 9.0;
const FOOTER_HEIGHT: f32 = 10.0;

// ── Colour palette ──────────────────────────────────────────────────

/// Brand colour (honey/amber — matches app theme)
const BRAND_R: f32 = 0.976; // #F98C07
const BRAND_G: f32 = 0.549;
const BRAND_B: f32 = 0.027;

fn brand_color() -> Color {
    Color::Rgb(Rgb::new(BRAND_R, BRAND_G, BRAND_B, None))
}

/// Primary text — dark charcoal (#1E293B)
fn text_primary() -> Color {
    Color::Rgb(Rgb::new(0.118, 0.161, 0.231, None))
}

/// Secondary text — medium slate (#64748B)
fn text_secondary() -> Color {
    Color::Rgb(Rgb::new(0.392, 0.455, 0.545, None))
}

/// Subtle border / grid lines (#E2E8F0)
fn color_border() -> Color {
    Color::Rgb(Rgb::new(0.886, 0.910, 0.941, None))
}

/// Table header background — light warm gray (#F8FAFC)
fn color_table_header_bg() -> Color {
    Color::Rgb(Rgb::new(0.973, 0.980, 0.988, None))
}

/// Zebra row background (#F8FAFC)
fn color_zebra_bg() -> Color {
    Color::Rgb(Rgb::new(0.976, 0.980, 0.984, None))
}

/// Card background (#FFFBF5 — warm off-white)
fn color_card_bg() -> Color {
    Color::Rgb(Rgb::new(1.0, 0.984, 0.961, None))
}

/// Income green (#16A34A)
fn color_income() -> Color {
    Color::Rgb(Rgb::new(0.086, 0.639, 0.290, None))
}

/// Expense red (#DC2626)
fn color_expense() -> Color {
    Color::Rgb(Rgb::new(0.863, 0.149, 0.149, None))
}

fn color_white() -> Color {
    Color::Rgb(Rgb::new(1.0, 1.0, 1.0, None))
}

/// Multi-colour chart palette for category breakdowns
fn chart_palette(index: usize) -> Color {
    const PALETTE: [(f32, f32, f32); 8] = [
        (0.231, 0.510, 0.965), // #3B82F6 blue
        (0.545, 0.361, 0.965), // #8B5CF6 violet
        (0.086, 0.639, 0.290), // #16A34A green
        (0.976, 0.549, 0.027), // #F98C07 amber
        (0.878, 0.282, 0.298), // #E0484C coral
        (0.047, 0.647, 0.584), // #0CA596 teal
        (0.914, 0.580, 0.204), // #E99434 orange
        (0.612, 0.459, 0.788), // #9C75C9 purple
    ];
    let (r, g, b) = PALETTE[index % PALETTE.len()];
    Color::Rgb(Rgb::new(r, g, b, None))
}

struct PdfFonts {
    regular: FontId,
    semibold: FontId,
    bold: FontId,
    icon: Option<(XObjectId, f32, f32)>,
}

// ── Coordinate helpers ───────────────────────────────────────────────

fn x_pt(x_mm: f32) -> Pt {
    Mm(x_mm).into_pt()
}

fn y_pt(from_top_mm: f32) -> Pt {
    Mm(PAGE_H - from_top_mm).into_pt()
}

/// Format a monetary value with thousands separators and two decimals.
fn format_currency(value: f64, symbol: &str) -> String {
    let abs = value.abs();
    let integer = abs as u64;
    let frac = ((abs - integer as f64) * 100.0).round() as u64;

    // Build integer part with thousands separators
    let int_str = integer.to_string();
    let mut formatted = String::new();
    for (i, ch) in int_str.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            formatted.push(',');
        }
        formatted.push(ch);
    }
    let int_formatted: String = formatted.chars().rev().collect();

    if value < 0.0 {
        format!("-{}{}.{:02}", symbol, int_formatted, frac)
    } else {
        format!("{}{}.{:02}", symbol, int_formatted, frac)
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

/// Check whether the current Y position has exceeded the printable area.
fn needs_new_page(top: f32) -> bool {
    top > PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT - 10.0
}

// ── Text drawing ────────────────────────────────────────────────────

/// Font weight selector for the three embedded weights.
#[derive(Clone, Copy)]
enum Weight {
    Regular,
    Semibold,
    Bold,
}

fn font_for_weight(fonts: &PdfFonts, weight: Weight) -> FontId {
    match weight {
        Weight::Regular => fonts.regular.clone(),
        Weight::Semibold => fonts.semibold.clone(),
        Weight::Bold => fonts.bold.clone(),
    }
}

fn write_text(
    ops: &mut Vec<Op>,
    fonts: &PdfFonts,
    text: &str,
    x: f32,
    from_top: f32,
    size: f32,
    bold: bool,
) {
    let weight = if bold { Weight::Bold } else { Weight::Regular };
    write_text_weight(ops, fonts, text, x, from_top, size, weight, text_primary());
}

fn write_text_weight_val(
    ops: &mut Vec<Op>,
    fonts: &PdfFonts,
    text: &str,
    x: f32,
    from_top: f32,
    size: f32,
    weight: Weight,
) {
    write_text_weight(ops, fonts, text, x, from_top, size, weight, text_primary());
}

fn write_text_weight(
    ops: &mut Vec<Op>,
    fonts: &PdfFonts,
    text: &str,
    x: f32,
    from_top: f32,
    size: f32,
    weight: Weight,
    color: Color,
) {
    let font_id = font_for_weight(fonts, weight);
    ops.push(Op::SetFillColor { col: color });
    ops.push(Op::StartTextSection);
    ops.push(Op::SetFont {
        font: PdfFontHandle::External(font_id),
        size: Pt(size),
    });
    ops.push(Op::SetTextCursor {
        pos: Point {
            x: x_pt(x),
            y: y_pt(from_top),
        },
    });
    ops.push(Op::ShowText {
        items: vec![TextItem::Text(text.to_string())],
    });
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
    let weight = if bold { Weight::Bold } else { Weight::Regular };
    write_text_weight(ops, fonts, text, x, from_top, size, weight, color);
}

/// Approximate text width in mm for Open Sans at a given pt size.
fn text_width(text: &str, size_pt: f32) -> f32 {
    // Open Sans average character width ≈ 0.50 × font size in pt → mm
    let avg_char_mm = size_pt * 0.50 * 0.3528;
    text.chars().count() as f32 * avg_char_mm
}

fn write_text_right(
    ops: &mut Vec<Op>,
    fonts: &PdfFonts,
    text: &str,
    right_x: f32,
    from_top: f32,
    size: f32,
    bold: bool,
) {
    let w = text_width(text, size);
    write_text(ops, fonts, text, right_x - w, from_top, size, bold);
}

#[allow(clippy::too_many_arguments)]
fn write_text_right_weight(
    ops: &mut Vec<Op>,
    fonts: &PdfFonts,
    text: &str,
    right_x: f32,
    from_top: f32,
    size: f32,
    weight: Weight,
    color: Color,
) {
    let w = text_width(text, size);
    write_text_weight(ops, fonts, text, right_x - w, from_top, size, weight, color);
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
                    LinePoint {
                        p: Point {
                            x: x_pt(x),
                            y: y_pt(from_top + h),
                        },
                        bezier: false,
                    },
                    LinePoint {
                        p: Point {
                            x: x_pt(x + w),
                            y: y_pt(from_top + h),
                        },
                        bezier: false,
                    },
                    LinePoint {
                        p: Point {
                            x: x_pt(x + w),
                            y: y_pt(from_top),
                        },
                        bezier: false,
                    },
                    LinePoint {
                        p: Point {
                            x: x_pt(x),
                            y: y_pt(from_top),
                        },
                        bezier: false,
                    },
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
                LinePoint {
                    p: Point {
                        x: x_pt(x1),
                        y: y_pt(y1_top),
                    },
                    bezier: false,
                },
                LinePoint {
                    p: Point {
                        x: x_pt(x2),
                        y: y_pt(y2_top),
                    },
                    bezier: false,
                },
            ],
            is_closed: false,
        },
    });
}

// ── Header / Footer ────────────────────────────────────────────────

fn draw_header_footer(ops: &mut Vec<Op>, fonts: &PdfFonts, page_num: usize, data: &ReportData) {
    let labels = &data.labels;

    // Header: slim brand bar
    draw_rect(ops, 0.0, 0.0, PAGE_W, HEADER_HEIGHT, brand_color());

    // Header: Icon
    if let Some((ref icon_id, icon_size_mm, _dpi)) = fonts.icon {
        let translate_y =
            Mm(PAGE_H - HEADER_HEIGHT + (HEADER_HEIGHT - icon_size_mm) / 2.0).into_pt();
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

    write_text_weight(
        ops,
        fonts,
        "HoneyBear Folio",
        MARGIN_LEFT + 10.0,
        6.5,
        8.0,
        Weight::Bold,
        color_white(),
    );

    // Date range on the right
    let right_text = format!(
        "{} — {} · {}",
        data.date_range_start, data.date_range_end, data.currency_symbol
    );
    write_text_right_weight(
        ops,
        fonts,
        &right_text,
        PAGE_W - MARGIN_RIGHT,
        6.5,
        7.0,
        Weight::Regular,
        color_white(),
    );

    // Subtle bottom border on header
    draw_line(
        ops,
        0.0,
        HEADER_HEIGHT,
        PAGE_W,
        HEADER_HEIGHT,
        0.3,
        color_border(),
    );

    // Footer: hairline separator
    let footer_line_y = PAGE_H - FOOTER_HEIGHT - 1.0;
    draw_line(
        ops,
        MARGIN_LEFT,
        footer_line_y,
        MARGIN_LEFT + CONTENT_W,
        footer_line_y,
        0.2,
        color_border(),
    );

    // Footer: generation date on the left, page number on the right
    let footer_text_y = PAGE_H - 6.0;
    write_text_weight(
        ops,
        fonts,
        &data.generation_date,
        MARGIN_LEFT,
        footer_text_y,
        7.0,
        Weight::Regular,
        text_secondary(),
    );

    let page_text = format!("{} {}", labels.page, page_num);
    write_text_right_weight(
        ops,
        fonts,
        &page_text,
        PAGE_W - MARGIN_RIGHT,
        footer_text_y,
        7.0,
        Weight::Regular,
        text_secondary(),
    );
}

fn draw_section_title(ops: &mut Vec<Op>, fonts: &PdfFonts, title: &str, from_top: f32) -> f32 {
    write_text_weight(
        ops,
        fonts,
        title,
        MARGIN_LEFT,
        from_top,
        13.0,
        Weight::Bold,
        text_primary(),
    );
    // Short accent underline (just under the text, not full width)
    let title_w = text_width(title, 13.0).min(CONTENT_W);
    draw_line(
        ops,
        MARGIN_LEFT,
        from_top + 2.5,
        MARGIN_LEFT + title_w,
        from_top + 2.5,
        0.6,
        brand_color(),
    );
    from_top + 10.0
}

// ── Table drawing ───────────────────────────────────────────────────

const ROW_HEIGHT: f32 = 6.5;

struct TableColumn {
    header: String,
    width: f32,
    align_right: bool,
}

fn draw_table_header(
    ops: &mut Vec<Op>,
    fonts: &PdfFonts,
    cols: &[TableColumn],
    from_top: f32,
) -> f32 {
    // Header background — neutral light gray
    draw_rect(
        ops,
        MARGIN_LEFT,
        from_top,
        CONTENT_W,
        7.0,
        color_table_header_bg(),
    );
    // Bottom border under header
    draw_line(
        ops,
        MARGIN_LEFT,
        from_top + 7.0,
        MARGIN_LEFT + CONTENT_W,
        from_top + 7.0,
        0.3,
        color_border(),
    );

    let mut x = MARGIN_LEFT + 1.5;
    for col in cols {
        if col.align_right {
            write_text_right_weight(
                ops,
                fonts,
                &col.header,
                x + col.width - 1.5,
                from_top + 4.5,
                8.0,
                Weight::Semibold,
                text_secondary(),
            );
        } else {
            write_text_weight(
                ops,
                fonts,
                &col.header,
                x,
                from_top + 4.5,
                8.0,
                Weight::Semibold,
                text_secondary(),
            );
        }
        x += col.width;
    }
    from_top + 7.5
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
            ROW_HEIGHT,
            color_zebra_bg(),
        );
    }
    let mut x = MARGIN_LEFT + 1.5;
    for (i, col) in cols.iter().enumerate() {
        let val = values.get(i).map(|s| s.as_str()).unwrap_or("");
        let display = truncate(val, (col.width / 1.4) as usize);
        if col.align_right {
            write_text_right(
                ops,
                fonts,
                &display,
                x + col.width - 1.5,
                from_top + 4.5,
                8.0,
                false,
            );
        } else {
            write_text(ops, fonts, &display, x, from_top + 4.5, 8.0, false);
        }
        x += col.width;
    }
    from_top + ROW_HEIGHT
}

/// Draw a bold totals row with a top border.
fn draw_table_totals_row(
    ops: &mut Vec<Op>,
    fonts: &PdfFonts,
    cols: &[TableColumn],
    values: &[String],
    from_top: f32,
) -> f32 {
    draw_line(
        ops,
        MARGIN_LEFT,
        from_top,
        MARGIN_LEFT + CONTENT_W,
        from_top,
        0.4,
        text_secondary(),
    );
    let mut x = MARGIN_LEFT + 1.5;
    for (i, col) in cols.iter().enumerate() {
        let val = values.get(i).map(|s| s.as_str()).unwrap_or("");
        if col.align_right {
            write_text_right_weight(
                ops,
                fonts,
                val,
                x + col.width - 1.5,
                from_top + 5.0,
                8.0,
                Weight::Semibold,
                text_primary(),
            );
        } else {
            write_text_weight_val(ops, fonts, val, x, from_top + 5.0, 8.0, Weight::Semibold);
        }
        x += col.width;
    }
    from_top + ROW_HEIGHT + 1.0
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

    // ── Hero Net Worth card (full width) ────────────────────────────
    let hero_h = 24.0;
    draw_rect(
        &mut ops,
        MARGIN_LEFT,
        top,
        CONTENT_W,
        hero_h,
        color_card_bg(),
    );
    // Thin left accent
    draw_rect(&mut ops, MARGIN_LEFT, top, 1.5, hero_h, brand_color());

    write_text_weight(
        &mut ops,
        fonts,
        &labels.net_worth,
        MARGIN_LEFT + 6.0,
        top + 7.0,
        8.0,
        Weight::Regular,
        text_secondary(),
    );
    write_text_weight(
        &mut ops,
        fonts,
        &format_currency(s.net_worth, sym),
        MARGIN_LEFT + 6.0,
        top + 16.0,
        16.0,
        Weight::Bold,
        text_primary(),
    );

    // Mini sparkline for net worth trend (right side of hero card)
    let nw_points = &data.net_worth_points;
    if nw_points.len() > 1 {
        let spark_x = MARGIN_LEFT + CONTENT_W - 55.0;
        let spark_w = 45.0;
        let spark_top = top + 5.0;
        let spark_h = 14.0;
        let min_v = nw_points.iter().map(|p| p.value).fold(f64::MAX, f64::min);
        let max_v = nw_points.iter().map(|p| p.value).fold(f64::MIN, f64::max);
        let range = if (max_v - min_v).abs() < 0.01 {
            1.0
        } else {
            max_v - min_v
        };
        let n = nw_points.len();
        for i in 0..n - 1 {
            let x1 = spark_x + (i as f32 / (n - 1) as f32) * spark_w;
            let x2 = spark_x + ((i + 1) as f32 / (n - 1) as f32) * spark_w;
            let y1_frac = (nw_points[i].value - min_v) / range;
            let y2_frac = (nw_points[i + 1].value - min_v) / range;
            let y1 = spark_top + spark_h - (y1_frac as f32 * spark_h);
            let y2 = spark_top + spark_h - (y2_frac as f32 * spark_h);
            draw_line(&mut ops, x1, y1, x2, y2, 0.6, brand_color());
        }
    }

    top += hero_h + 4.0;

    // ── Secondary metrics row (5 cards) ─────────────────────────────
    let secondary = [
        (&labels.total_income, format_currency(s.total_income, sym)),
        (
            &labels.total_expenses,
            format_currency(s.total_expenses, sym),
        ),
        (&labels.net_savings, format_currency(s.net_savings, sym)),
        (&labels.savings_rate, format_percent(s.savings_rate)),
        (&labels.accounts, s.account_count.to_string()),
    ];

    let gap = 3.0;
    let card_w = (CONTENT_W - gap * 4.0) / 5.0;
    let card_h = 18.0;
    for (i, (label, value)) in secondary.iter().enumerate() {
        let cx = MARGIN_LEFT + i as f32 * (card_w + gap);

        // White card with subtle border
        draw_rect(&mut ops, cx, top, card_w, card_h, color_white());
        draw_line(&mut ops, cx, top, cx + card_w, top, 0.2, color_border());
        draw_line(
            &mut ops,
            cx,
            top + card_h,
            cx + card_w,
            top + card_h,
            0.2,
            color_border(),
        );
        draw_line(&mut ops, cx, top, cx, top + card_h, 0.2, color_border());
        draw_line(
            &mut ops,
            cx + card_w,
            top,
            cx + card_w,
            top + card_h,
            0.2,
            color_border(),
        );
        // Small amber dot indicator
        draw_rect(&mut ops, cx + 3.5, top + 4.5, 2.0, 2.0, brand_color());

        write_text_weight(
            &mut ops,
            fonts,
            label,
            cx + 7.5,
            top + 6.5,
            6.5,
            Weight::Regular,
            text_secondary(),
        );
        write_text_weight(
            &mut ops,
            fonts,
            value,
            cx + 3.5,
            top + 14.0,
            9.0,
            Weight::Semibold,
            text_primary(),
        );
    }

    top += card_h + 12.0;

    // ── Account balances table ──────────────────────────────────────
    top = draw_section_title(&mut ops, fonts, &labels.accounts, top);

    let cols = vec![
        TableColumn {
            header: labels.account.clone(),
            width: 44.0,
            align_right: false,
        },
        TableColumn {
            header: labels.currency.clone(),
            width: 18.0,
            align_right: false,
        },
        TableColumn {
            header: labels.cash_balance.clone(),
            width: 34.0,
            align_right: true,
        },
        TableColumn {
            header: labels.market_value.clone(),
            width: 34.0,
            align_right: true,
        },
        TableColumn {
            header: labels.total.clone(),
            width: 34.0,
            align_right: true,
        },
    ];

    top = draw_table_header(&mut ops, fonts, &cols, top);

    let mut total_cash = 0.0_f64;
    let mut total_market = 0.0_f64;
    let mut total_all = 0.0_f64;
    for (i, ab) in data.account_balances.iter().enumerate() {
        // Convert to app currency for totals
        total_cash += ab.cash_balance * ab.exchange_rate;
        total_market += ab.market_value * ab.exchange_rate;
        total_all += ab.total * ab.exchange_rate;
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
    // Totals row
    if !data.account_balances.is_empty() {
        let _top = draw_table_totals_row(
            &mut ops,
            fonts,
            &cols,
            &[
                labels.total.clone(),
                String::new(),
                format_currency(total_cash, sym),
                format_currency(total_market, sym),
                format_currency(total_all, sym),
            ],
            top,
        );
    }
    finish_page(doc, ops);
}

// ── Net Worth Evolution chart ───────────────────────────────────────

fn draw_net_worth_page(doc: &mut PdfDocument, fonts: &PdfFonts, data: &ReportData) {
    let mut ops = start_page(fonts, 2, data);
    let sym = &data.currency_symbol;

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
            text_secondary(),
        );
        finish_page(doc, ops);
        return;
    }

    // ── Change callout box ──────────────────────────────────────────
    let first_val = points.first().unwrap().value;
    let last_val = points.last().unwrap().value;
    let abs_change = last_val - first_val;
    let pct_change = if first_val.abs() > 0.01 {
        (abs_change / first_val) * 100.0
    } else {
        0.0
    };
    let change_text = format!(
        "{} ({}) over period",
        format_currency(abs_change, sym),
        format_percent(pct_change),
    );
    let change_color = if abs_change >= 0.0 {
        color_income()
    } else {
        color_expense()
    };
    write_text_weight(
        &mut ops,
        fonts,
        &change_text,
        MARGIN_LEFT,
        top + 4.0,
        8.0,
        Weight::Semibold,
        change_color,
    );
    top += 10.0;

    // Chart area
    let chart_x = MARGIN_LEFT + 18.0;
    let chart_top = top + 5.0;
    let chart_w = CONTENT_W - 22.0;
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
        write_text_right_weight(
            &mut ops,
            fonts,
            &format_currency(val, sym),
            chart_x - 2.0,
            yy + 1.5,
            6.0,
            Weight::Regular,
            text_secondary(),
        );
        draw_line(
            &mut ops,
            chart_x,
            yy,
            chart_x + chart_w,
            yy,
            0.15,
            color_border(),
        );
    }

    // Area fill under line (light brand tint)
    let n = points.len();
    if n > 1 {
        // Use a light tint of brand color for area fill
        let area_color = Color::Rgb(Rgb::new(
            BRAND_R * 0.12 + 1.0 * 0.88,
            BRAND_G * 0.12 + 1.0 * 0.88,
            BRAND_B * 0.12 + 1.0 * 0.88,
            None,
        ));
        let mut area_points = Vec::new();
        // Bottom-left
        area_points.push(LinePoint {
            p: Point {
                x: x_pt(chart_x),
                y: y_pt(chart_top + chart_h),
            },
            bezier: false,
        });
        // All data points
        for (i, pt) in points.iter().enumerate() {
            let px = chart_x + (i as f32 / (n - 1) as f32) * chart_w;
            let frac = (pt.value - min_val) / range;
            let py = chart_top + chart_h - (frac as f32 * chart_h);
            area_points.push(LinePoint {
                p: Point {
                    x: x_pt(px),
                    y: y_pt(py),
                },
                bezier: false,
            });
        }
        // Bottom-right
        area_points.push(LinePoint {
            p: Point {
                x: x_pt(chart_x + chart_w),
                y: y_pt(chart_top + chart_h),
            },
            bezier: false,
        });

        ops.push(Op::SetFillColor { col: area_color });
        ops.push(Op::DrawPolygon {
            polygon: Polygon {
                rings: vec![PolygonRing {
                    points: area_points,
                }],
                mode: PaintMode::Fill,
                winding_order: WindingOrder::NonZero,
            },
        });

        // Line itself
        for i in 0..n - 1 {
            let x1 = chart_x + (i as f32 / (n - 1) as f32) * chart_w;
            let x2 = chart_x + ((i + 1) as f32 / (n - 1) as f32) * chart_w;
            let y1_frac = (points[i].value - min_val) / range;
            let y2_frac = (points[i + 1].value - min_val) / range;
            let y1 = chart_top + chart_h - (y1_frac as f32 * chart_h);
            let y2 = chart_top + chart_h - (y2_frac as f32 * chart_h);
            draw_line(&mut ops, x1, y1, x2, y2, 0.8, brand_color());
        }

        // Dots at data points (every Nth to avoid clutter)
        let dot_step = (n / 12).max(1);
        for i in (0..n).step_by(dot_step).chain(std::iter::once(n - 1)) {
            let px = chart_x + (i as f32 / (n - 1) as f32) * chart_w;
            let frac = (points[i].value - min_val) / range;
            let py = chart_top + chart_h - (frac as f32 * chart_h);
            draw_rect(&mut ops, px - 0.6, py - 0.6, 1.2, 1.2, brand_color());
        }

        // Start & end value annotations
        let first_y_frac = (points[0].value - min_val) / range;
        let first_py = chart_top + chart_h - (first_y_frac as f32 * chart_h);
        write_text_weight(
            &mut ops,
            fonts,
            &format_currency(points[0].value, sym),
            chart_x + 1.0,
            first_py - 2.5,
            6.0,
            Weight::Semibold,
            text_primary(),
        );
        let last_y_frac = (points[n - 1].value - min_val) / range;
        let last_py = chart_top + chart_h - (last_y_frac as f32 * chart_h);
        let last_label = format_currency(points[n - 1].value, sym);
        let last_tw = text_width(&last_label, 6.0);
        write_text_weight(
            &mut ops,
            fonts,
            &last_label,
            chart_x + chart_w - last_tw - 1.0,
            last_py - 2.5,
            6.0,
            Weight::Semibold,
            text_primary(),
        );
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
        write_text_weight(
            &mut ops,
            fonts,
            &truncate(&points[idx].label, 10),
            x,
            chart_top + chart_h + 4.0,
            6.0,
            Weight::Regular,
            text_secondary(),
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

    // Section title with inline legend (right-aligned)
    top = draw_section_title(&mut ops, fonts, &labels.income_vs_expenses, top);
    let legend_y = top - 6.5;
    let legend_right = MARGIN_LEFT + CONTENT_W;
    draw_rect(
        &mut ops,
        legend_right - 60.0,
        legend_y - 2.0,
        3.5,
        3.0,
        color_income(),
    );
    write_text_weight(
        &mut ops,
        fonts,
        &labels.income,
        legend_right - 55.5,
        legend_y + 0.5,
        7.0,
        Weight::Regular,
        text_secondary(),
    );
    draw_rect(
        &mut ops,
        legend_right - 30.0,
        legend_y - 2.0,
        3.5,
        3.0,
        color_expense(),
    );
    write_text_weight(
        &mut ops,
        fonts,
        &labels.expenses,
        legend_right - 25.5,
        legend_y + 0.5,
        7.0,
        Weight::Regular,
        text_secondary(),
    );

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
            text_secondary(),
        );
        finish_page(doc, ops);
        return;
    }

    // Grouped bar chart
    let chart_x = MARGIN_LEFT + 18.0;
    let chart_top = top + 5.0;
    let chart_w = CONTENT_W - 22.0;
    let chart_h = 75.0;

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
        write_text_right_weight(
            &mut ops,
            fonts,
            &format_currency(val, sym),
            chart_x - 2.0,
            yy + 1.5,
            6.0,
            Weight::Regular,
            text_secondary(),
        );
        draw_line(
            &mut ops,
            chart_x,
            yy,
            chart_x + chart_w,
            yy,
            0.15,
            color_border(),
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
                color_income(),
            );
            // Value label on top of bar
            if group_w > 10.0 {
                let val_text = format_currency(m.income, sym);
                let tw = text_width(&val_text, 5.0);
                write_text_weight(
                    &mut ops,
                    fonts,
                    &val_text,
                    center - bar_w - 0.5 + (bar_w - tw) / 2.0,
                    chart_top + chart_h - ih - 2.5,
                    5.0,
                    Weight::Regular,
                    text_secondary(),
                );
            }
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
                color_expense(),
            );
            if group_w > 10.0 {
                let val_text = format_currency(m.expenses, sym);
                let tw = text_width(&val_text, 5.0);
                write_text_weight(
                    &mut ops,
                    fonts,
                    &val_text,
                    center + 0.5 + (bar_w - tw) / 2.0,
                    chart_top + chart_h - eh - 2.5,
                    5.0,
                    Weight::Regular,
                    text_secondary(),
                );
            }
        }

        // Month label
        write_text_weight(
            &mut ops,
            fonts,
            &truncate(&m.label, 6),
            center - 4.0,
            chart_top + chart_h + 4.0,
            6.0,
            Weight::Regular,
            text_secondary(),
        );
    }

    // Net trend line overlay
    if n > 1 {
        for i in 0..n - 1 {
            let net1 = months[i].income - months[i].expenses;
            let net2 = months[i + 1].income - months[i + 1].expenses;
            let net_max = months
                .iter()
                .map(|m| (m.income - m.expenses).abs())
                .fold(0.0_f64, f64::max);
            let net_ceil = if net_max < 0.01 { ceiling } else { ceiling };
            let y1_frac = (net1 / net_ceil).min(1.0).max(-1.0);
            let y2_frac = (net2 / net_ceil).min(1.0).max(-1.0);
            let baseline = chart_top + chart_h;
            let y1 = baseline - (y1_frac as f32 * chart_h);
            let y2 = baseline - (y2_frac as f32 * chart_h);
            let gx1 = chart_x + i as f32 * group_w + group_w / 2.0;
            let gx2 = chart_x + (i + 1) as f32 * group_w + group_w / 2.0;
            draw_line(&mut ops, gx1, y1, gx2, y2, 0.5, text_secondary());
        }
    }

    // Summary table
    let table_top = chart_top + chart_h + 14.0;
    let col_w = CONTENT_W / 4.0;
    let cols = vec![
        TableColumn {
            header: labels.month.clone(),
            width: col_w,
            align_right: false,
        },
        TableColumn {
            header: labels.income.clone(),
            width: col_w,
            align_right: true,
        },
        TableColumn {
            header: labels.expenses.clone(),
            width: col_w,
            align_right: true,
        },
        TableColumn {
            header: labels.net.clone(),
            width: col_w,
            align_right: true,
        },
    ];

    let mut tt = draw_table_header(&mut ops, fonts, &cols, table_top);
    let mut sum_income = 0.0_f64;
    let mut sum_expenses = 0.0_f64;
    for (i, m) in months.iter().enumerate() {
        if needs_new_page(tt) {
            break;
        }
        sum_income += m.income;
        sum_expenses += m.expenses;
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
    // Totals row
    if !months.is_empty() && !needs_new_page(tt) {
        draw_table_totals_row(
            &mut ops,
            fonts,
            &cols,
            &[
                labels.total.clone(),
                format_currency(sum_income, sym),
                format_currency(sum_expenses, sym),
                format_currency(sum_income - sum_expenses, sym),
            ],
            tt,
        );
    }
    finish_page(doc, ops);
}

// ── Expense Breakdown page ──────────────────────────────────────────

fn draw_category_breakdown_page(
    doc: &mut PdfDocument,
    fonts: &PdfFonts,
    data: &ReportData,
    page_num: usize,
    title: &str,
    categories: &[crate::models::ReportCategoryAmount],
    _is_expense: bool,
) {
    let mut ops = start_page(fonts, page_num, data);
    let labels = &data.labels;
    let sym = &data.currency_symbol;

    let mut top = MARGIN_TOP + HEADER_HEIGHT;
    top = draw_section_title(&mut ops, fonts, title, top);

    if categories.is_empty() {
        write_text_color(
            &mut ops,
            fonts,
            &labels.no_transactions,
            MARGIN_LEFT,
            top + 10.0,
            10.0,
            false,
            text_secondary(),
        );
        finish_page(doc, ops);
        return;
    }

    // Horizontal bar chart (top 15) — each bar gets its own colour
    let chart_x = MARGIN_LEFT + 42.0;
    let max_amount = categories.iter().map(|c| c.amount).fold(0.0_f64, f64::max);
    let bar_max_w = CONTENT_W - 58.0;
    let bar_h = 5.0;

    let shown: Vec<_> = categories.iter().take(15).collect();
    for (i, cat) in shown.iter().enumerate() {
        let cy = top + i as f32 * 8.5;
        let label = truncate(&cat.category, 20);
        write_text(&mut ops, fonts, &label, MARGIN_LEFT, cy + 4.0, 7.0, false);
        let bw = if max_amount > 0.0 {
            (cat.amount / max_amount) as f32 * bar_max_w
        } else {
            0.0
        };
        let bar_color = chart_palette(i);
        draw_rect(&mut ops, chart_x, cy + 0.5, bw.max(1.0), bar_h, bar_color);
        // Amount + percentage label after bar
        let after_text = format!(
            "{} ({})",
            format_currency(cat.amount, sym),
            format_percent(cat.percentage)
        );
        write_text_weight(
            &mut ops,
            fonts,
            &after_text,
            chart_x + bw + 2.0,
            cy + 4.0,
            6.0,
            Weight::Regular,
            text_secondary(),
        );
    }

    // Table below
    let table_top = top + (shown.len() as f32 * 8.5) + 12.0;
    let cols = vec![
        TableColumn {
            header: labels.category.clone(),
            width: 60.0,
            align_right: false,
        },
        TableColumn {
            header: labels.amount.clone(),
            width: 48.0,
            align_right: true,
        },
        TableColumn {
            header: labels.percentage.clone(),
            width: 28.0,
            align_right: true,
        },
    ];

    let mut tt = draw_table_header(&mut ops, fonts, &cols, table_top);
    let mut page_num_local = page_num;
    for (i, cat) in categories.iter().enumerate() {
        if needs_new_page(tt) {
            finish_page(doc, ops);
            page_num_local += 1;
            ops = start_page(fonts, page_num_local, data);
            tt = MARGIN_TOP + HEADER_HEIGHT;
            tt = draw_table_header(&mut ops, fonts, &cols, tt);
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

fn draw_expense_breakdown_page(
    doc: &mut PdfDocument,
    fonts: &PdfFonts,
    data: &ReportData,
    page_num: usize,
) {
    draw_category_breakdown_page(
        doc,
        fonts,
        data,
        page_num,
        &data.labels.expense_breakdown.clone(),
        &data.expense_categories,
        true,
    );
}

// ── Income Breakdown page ───────────────────────────────────────────

fn draw_income_breakdown_page(
    doc: &mut PdfDocument,
    fonts: &PdfFonts,
    data: &ReportData,
    page_num: usize,
) {
    draw_category_breakdown_page(
        doc,
        fonts,
        data,
        page_num,
        &data.labels.income_breakdown.clone(),
        &data.income_categories,
        false,
    );
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

    // ── Visual waterfall flow ───────────────────────────────────────
    let flow_items: Vec<(&str, f64, Color)> = vec![
        (&labels.total_income, cf.total_income, color_income()),
        (&labels.total_expenses, cf.total_expenses, color_expense()),
        (&labels.investments, cf.total_investments, chart_palette(0)),
        (
            if cf.surplus_or_deficit >= 0.0 {
                &labels.surplus
            } else {
                &labels.deficit
            },
            cf.surplus_or_deficit,
            if cf.surplus_or_deficit >= 0.0 {
                color_income()
            } else {
                color_expense()
            },
        ),
    ];

    let max_abs = flow_items
        .iter()
        .map(|(_, v, _)| v.abs())
        .fold(0.0_f64, f64::max);
    let bar_max_w = CONTENT_W - 70.0;
    let bar_x = MARGIN_LEFT + 55.0;

    for (i, (label, value, color)) in flow_items.iter().enumerate() {
        let cy = top + i as f32 * 16.0;

        // Label
        write_text_weight_val(
            &mut ops,
            fonts,
            label,
            MARGIN_LEFT,
            cy + 5.0,
            9.0,
            Weight::Semibold,
        );

        // Bar proportional to max
        let bw = if max_abs > 0.0 {
            (value.abs() / max_abs) as f32 * bar_max_w
        } else {
            0.0
        };
        draw_rect(&mut ops, bar_x, cy + 1.0, bw.max(2.0), 8.0, color.clone());

        // Value after bar
        let val_text = format_currency(*value, sym);
        write_text_weight(
            &mut ops,
            fonts,
            &val_text,
            bar_x + bw + 3.0,
            cy + 6.0,
            9.0,
            Weight::Semibold,
            text_primary(),
        );

        // Connector line between rows (except last)
        if i < flow_items.len() - 1 {
            let arrow_y = cy + 12.0;
            draw_line(
                &mut ops,
                MARGIN_LEFT + 10.0,
                arrow_y,
                MARGIN_LEFT + 10.0,
                arrow_y + 4.0,
                0.3,
                color_border(),
            );
        }
    }

    top += flow_items.len() as f32 * 16.0 + 14.0;

    // ── Top 5 expense categories (compact) ──────────────────────────
    if !cf.expense_categories.is_empty() {
        // Hairline separator
        draw_line(
            &mut ops,
            MARGIN_LEFT,
            top - 4.0,
            MARGIN_LEFT + CONTENT_W,
            top - 4.0,
            0.2,
            color_border(),
        );

        write_text_weight_val(
            &mut ops,
            fonts,
            &labels.expenses,
            MARGIN_LEFT,
            top + 4.0,
            9.0,
            Weight::Semibold,
        );
        top += 10.0;

        let cols = vec![
            TableColumn {
                header: labels.category.clone(),
                width: 60.0,
                align_right: false,
            },
            TableColumn {
                header: labels.amount.clone(),
                width: 48.0,
                align_right: true,
            },
            TableColumn {
                header: labels.percentage.clone(),
                width: 28.0,
                align_right: true,
            },
        ];
        top = draw_table_header(&mut ops, fonts, &cols, top);

        for (i, cat) in cf.expense_categories.iter().take(5).enumerate() {
            if needs_new_page(top) {
                break;
            }
            top = draw_table_row(
                &mut ops,
                fonts,
                &cols,
                &[
                    truncate(&cat.category, 35),
                    format_currency(cat.amount, sym),
                    format_percent(cat.percentage),
                ],
                top,
                i % 2 == 1,
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

    // ── Portfolio summary cards (3 across) ──────────────────────────
    let gain_loss = portfolio.total_value - portfolio.total_cost_basis;
    let cards = [
        (
            &labels.portfolio_total,
            format_currency(portfolio.total_value, sym),
        ),
        (
            &labels.cost_basis,
            format_currency(portfolio.total_cost_basis, sym),
        ),
        (
            &labels.overall_roi,
            format!(
                "{} ({})",
                format_currency(gain_loss, sym),
                format_percent(portfolio.overall_roi),
            ),
        ),
    ];
    let gap = 3.0;
    let card_w = (CONTENT_W - gap * 2.0) / 3.0;
    let card_h = 18.0;
    for (i, (label, value)) in cards.iter().enumerate() {
        let cx = MARGIN_LEFT + i as f32 * (card_w + gap);
        draw_rect(&mut ops, cx, top, card_w, card_h, color_card_bg());
        draw_rect(&mut ops, cx, top, 1.5, card_h, brand_color());
        write_text_weight(
            &mut ops,
            fonts,
            label,
            cx + 5.0,
            top + 6.5,
            7.0,
            Weight::Regular,
            text_secondary(),
        );
        let val_color = if i == 2 {
            if gain_loss >= 0.0 {
                color_income()
            } else {
                color_expense()
            }
        } else {
            text_primary()
        };
        write_text_weight(
            &mut ops,
            fonts,
            value,
            cx + 5.0,
            top + 14.0,
            9.0,
            Weight::Semibold,
            val_color,
        );
    }
    top += card_h + 6.0;

    // ── Allocation bar (horizontal stacked) ─────────────────────────
    if portfolio.total_value > 0.0 {
        write_text_weight_val(
            &mut ops,
            fonts,
            "Allocation",
            MARGIN_LEFT,
            top + 4.0,
            8.0,
            Weight::Semibold,
        );
        top += 7.0;
        let bar_y = top;
        let bar_h = 6.0;
        let mut bx = MARGIN_LEFT;
        for (i, h) in portfolio.holdings.iter().enumerate() {
            let frac = (h.current_value / portfolio.total_value) as f32;
            let seg_w = frac * CONTENT_W;
            if seg_w > 0.5 {
                draw_rect(&mut ops, bx, bar_y, seg_w, bar_h, chart_palette(i));
            }
            bx += seg_w;
        }
        // Legend below allocation bar
        top += bar_h + 2.0;
        let mut lx = MARGIN_LEFT;
        for (i, h) in portfolio.holdings.iter().enumerate() {
            let pct = (h.current_value / portfolio.total_value) * 100.0;
            if pct < 1.0 {
                continue;
            }
            let legend_text = format!("{} {:.0}%", h.ticker, pct);
            let tw = text_width(&legend_text, 6.0) + 5.0;
            if lx + tw > MARGIN_LEFT + CONTENT_W {
                lx = MARGIN_LEFT;
                top += 5.0;
            }
            draw_rect(&mut ops, lx, top, 2.5, 2.5, chart_palette(i));
            write_text_weight(
                &mut ops,
                fonts,
                &legend_text,
                lx + 3.5,
                top + 2.5,
                6.0,
                Weight::Regular,
                text_secondary(),
            );
            lx += tw;
        }
        top += 8.0;
    }

    // ── Holdings table ──────────────────────────────────────────────
    let cols = vec![
        TableColumn {
            header: labels.ticker.clone(),
            width: 24.0,
            align_right: false,
        },
        TableColumn {
            header: labels.shares.clone(),
            width: 24.0,
            align_right: true,
        },
        TableColumn {
            header: labels.price.clone(),
            width: 24.0,
            align_right: true,
        },
        TableColumn {
            header: labels.value.clone(),
            width: 28.0,
            align_right: true,
        },
        TableColumn {
            header: labels.cost_basis.clone(),
            width: 28.0,
            align_right: true,
        },
        TableColumn {
            header: labels.roi.clone(),
            width: 24.0,
            align_right: true,
        },
    ];

    top = draw_table_header(&mut ops, fonts, &cols, top);

    for (i, h) in portfolio.holdings.iter().enumerate() {
        if needs_new_page(top) {
            finish_page(doc, ops);
            ops = start_page(fonts, page_num + 1, data);
            top = MARGIN_TOP + HEADER_HEIGHT;
            top = draw_table_header(&mut ops, fonts, &cols, top);
        }
        // Color-code ROI
        let roi_text = format_percent(h.roi);
        let row_values = vec![
            h.ticker.clone(),
            format!("{:.4}", h.shares),
            format_currency(h.price, sym),
            format_currency(h.current_value, sym),
            format_currency(h.cost_basis, sym),
            roi_text,
        ];
        // Draw row with color-coded ROI column
        if i % 2 == 1 {
            draw_rect(
                &mut ops,
                MARGIN_LEFT,
                top,
                CONTENT_W,
                ROW_HEIGHT,
                color_zebra_bg(),
            );
        }
        let mut x = MARGIN_LEFT + 1.5;
        for (j, col) in cols.iter().enumerate() {
            let val = &row_values[j];
            let display = truncate(val, (col.width / 1.4) as usize);
            // Use green/red for the ROI column
            let col_color = if j == 5 {
                if h.roi >= 0.0 {
                    color_income()
                } else {
                    color_expense()
                }
            } else {
                text_primary()
            };
            if col.align_right {
                write_text_right_weight(
                    &mut ops,
                    fonts,
                    &display,
                    x + col.width - 1.5,
                    top + 4.5,
                    8.0,
                    Weight::Regular,
                    col_color,
                );
            } else {
                write_text_weight(
                    &mut ops,
                    fonts,
                    &display,
                    x,
                    top + 4.5,
                    8.0,
                    Weight::Regular,
                    col_color,
                );
            }
            x += col.width;
        }
        top += ROW_HEIGHT;
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

    let cash_cols = vec![
        TableColumn {
            header: labels.date.clone(),
            width: 22.0,
            align_right: false,
        },
        TableColumn {
            header: labels.payee.clone(),
            width: 40.0,
            align_right: false,
        },
        TableColumn {
            header: labels.category.clone(),
            width: 28.0,
            align_right: false,
        },
        TableColumn {
            header: labels.notes.clone(),
            width: 40.0,
            align_right: false,
        },
        TableColumn {
            header: labels.amount.clone(),
            width: 32.0,
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
                text_secondary(),
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

        // Per-account summary line
        let total_in: f64 = account_txs
            .transactions
            .iter()
            .filter(|t| t.amount > 0.0)
            .map(|t| t.amount)
            .sum();
        let total_out: f64 = account_txs
            .transactions
            .iter()
            .filter(|t| t.amount < 0.0)
            .map(|t| t.amount)
            .sum();
        let net = total_in + total_out;
        let summary_text = format!(
            "In: {}  ·  Out: {}  ·  Net: {}",
            format_currency(total_in, &account_txs.currency_symbol),
            format_currency(total_out, &account_txs.currency_symbol),
            format_currency(net, &account_txs.currency_symbol),
        );
        write_text_weight(
            &mut ops,
            fonts,
            &summary_text,
            MARGIN_LEFT,
            top + 4.0,
            7.5,
            Weight::Regular,
            text_secondary(),
        );
        top += 10.0;

        // Cash transactions
        if !cash_txs.is_empty() {
            write_text_weight_val(
                &mut ops,
                fonts,
                &labels.transactions_title,
                MARGIN_LEFT,
                top,
                9.0,
                Weight::Semibold,
            );
            top += 7.0;
            top = draw_table_header(&mut ops, fonts, &cash_cols, top);

            for (i, tx) in cash_txs.iter().enumerate() {
                if needs_new_page(top) {
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
                        truncate(&tx.payee, 30),
                        truncate(&tx.category, 20),
                        truncate(&tx.notes, 30),
                        format_currency(tx.amount, &account_txs.currency_symbol),
                    ],
                    top,
                    i % 2 == 1,
                );
            }
            top += 8.0;
        }

        // Investment transactions
        if !inv_txs.is_empty() {
            if needs_new_page(top) {
                finish_page(doc, ops);
                page_num += 1;
                ops = start_page(fonts, page_num, data);
                top = MARGIN_TOP + HEADER_HEIGHT;
            }

            write_text_weight_val(
                &mut ops,
                fonts,
                &labels.investment_holdings,
                MARGIN_LEFT,
                top,
                9.0,
                Weight::Semibold,
            );
            top += 7.0;
            top = draw_table_header(&mut ops, fonts, &inv_cols, top);

            for (i, tx) in inv_txs.iter().enumerate() {
                if needs_new_page(top) {
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

    // Load fonts — Open Sans Regular, Semibold, Bold
    let font_regular = printpdf::ParsedFont::from_bytes(FONT_REGULAR, 0, &mut Vec::new())
        .ok_or_else(|| "Failed to load regular font".to_string())?;
    let font_semibold = printpdf::ParsedFont::from_bytes(FONT_SEMIBOLD, 0, &mut Vec::new())
        .ok_or_else(|| "Failed to load semibold font".to_string())?;
    let font_bold = printpdf::ParsedFont::from_bytes(FONT_BOLD, 0, &mut Vec::new())
        .ok_or_else(|| "Failed to load bold font".to_string())?;

    let regular_id = doc.add_font(&font_regular);
    let semibold_id = doc.add_font(&font_semibold);
    let bold_id = doc.add_font(&font_bold);

    // Register icon image
    let icon_info = if let Ok(dynamic_img) = ::image::load_from_memory(APP_ICON) {
        let (width, height) = (dynamic_img.width(), dynamic_img.height());
        let icon_size_mm = 6.0_f32;
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
        semibold: semibold_id,
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
