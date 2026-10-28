#!/usr/bin/env python3
"""Render the verified Markdown final report to the project PDF destinations."""

import html
import json
import re
import shutil
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.platypus import (
    LongTable,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
)


ROOT_DIR = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT_DIR / "docs" / "LexiGuard_Final_Project_Report.md"
EXPERIMENT_PATH = ROOT_DIR / "data" / "logistic_regression_experiments.json"
GROUPED_CV_PATH = ROOT_DIR / "data" / "logistic_regression_grouped_cv.json"
FINAL_TEST_PATH = ROOT_DIR / "data" / "logistic_regression_final_test.json"
PRIMARY_PDF = ROOT_DIR / "docs" / "LexiGuard_Final_Project_Report.pdf"
COPY_PATHS = [
    ROOT_DIR / "docs" / "LexiGuard_ML_Project_Report.pdf",
    ROOT_DIR / "public" / "LexiGuard_ML_Project_Report.pdf",
]


def register_fonts() -> tuple[str, str]:
    regular = Path(r"C:\Windows\Fonts\arial.ttf")
    bold = Path(r"C:\Windows\Fonts\arialbd.ttf")
    if regular.is_file() and bold.is_file():
        pdfmetrics.registerFont(TTFont("LexiGuardArial", str(regular)))
        pdfmetrics.registerFont(TTFont("LexiGuardArialBold", str(bold)))
        return "LexiGuardArial", "LexiGuardArialBold"
    return "Helvetica", "Helvetica-Bold"


def make_styles(body_font: str, bold_font: str) -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ReportTitle", parent=base["Title"], fontName=bold_font, fontSize=20,
            leading=24, alignment=1, textColor=colors.HexColor("#16324f"),
            spaceAfter=12,
        ),
        "h1": ParagraphStyle(
            "ReportH1", parent=base["Heading1"], fontName=bold_font, fontSize=16,
            leading=20, textColor=colors.HexColor("#16324f"), spaceBefore=14,
            spaceAfter=7, keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "ReportH2", parent=base["Heading2"], fontName=bold_font, fontSize=12,
            leading=15, textColor=colors.HexColor("#245b83"), spaceBefore=10,
            spaceAfter=5, keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "ReportBody", parent=base["BodyText"], fontName=body_font, fontSize=8.5,
            leading=12, spaceAfter=5,
        ),
        "small": ParagraphStyle(
            "ReportSmall", parent=base["BodyText"], fontName=body_font, fontSize=6.5,
            leading=8,
        ),
        "code": ParagraphStyle(
            "ReportCode", fontName="Courier", fontSize=6.5, leading=8,
            leftIndent=6, rightIndent=6, backColor=colors.HexColor("#f2f4f7"),
            borderPadding=5, spaceBefore=4, spaceAfter=7,
        ),
        "quote": ParagraphStyle(
            "ReportQuote", parent=base["BodyText"], fontName=body_font, fontSize=8.5,
            leading=12, leftIndent=12, textColor=colors.HexColor("#34495e"),
            borderColor=colors.HexColor("#7c9db5"), borderWidth=1,
            borderPadding=6, spaceBefore=4, spaceAfter=7,
        ),
    }


def inline_markup(text: str) -> str:
    escaped = html.escape(text, quote=False)
    escaped = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        r'<link href="\2" color="#1769aa">\1</link>',
        escaped,
    )
    escaped = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', escaped)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    return re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", escaped)


def split_table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def architecture_drawing() -> Drawing:
    width = 516
    height = 176
    diagram = Drawing(width, height)
    box_width = 94
    box_height = 38
    positions = [4, 108, 212, 316, 420]
    rows = [
        (
            126,
            "TRAINING / VALIDATION",
            [
                "AOK / CUAD\nsource CSV",
                "Preprocess\nand deduplicate",
                "Contract-level\ntrain / test split",
                "Fit TF-IDF on\nfit portion only",
                "Select using\nvalidation Macro F1",
            ],
        ),
        (
            44,
            "APPLICATION RUNTIME",
            [
                "User contract\ntext / document",
                "React / Vite\nreview UI",
                "Express\nAPI",
                "TS classifier +\nrisk service",
                "Results and\nassistant fallback",
            ],
        ),
    ]
    for y, row_label, labels in rows:
        diagram.add(
            String(4, y + box_height + 8, row_label, fontName="Helvetica-Bold",
                   fontSize=7, fillColor=colors.HexColor("#36566f"))
        )
        for index, (x, label) in enumerate(zip(positions, labels)):
            diagram.add(
                Rect(
                    x, y, box_width, box_height, rx=4, ry=4,
                    fillColor=colors.HexColor("#eaf2f8"),
                    strokeColor=colors.HexColor("#527995"),
                    strokeWidth=0.8,
                )
            )
            label_lines = label.split("\n")
            first_y = y + box_height / 2 + (len(label_lines) - 1) * 4
            for line_index, text in enumerate(label_lines):
                diagram.add(
                    String(
                        x + box_width / 2,
                        first_y - line_index * 8,
                        text,
                        fontName="Helvetica",
                        fontSize=6.4,
                        textAnchor="middle",
                        fillColor=colors.HexColor("#18364d"),
                    )
                )
            if index < len(positions) - 1:
                start_x = x + box_width
                end_x = positions[index + 1]
                center_y = y + box_height / 2
                diagram.add(
                    Line(start_x, center_y, end_x - 4, center_y,
                         strokeColor=colors.HexColor("#527995"), strokeWidth=1)
                )
                diagram.add(
                    Polygon(
                        [end_x - 4, center_y + 3, end_x, center_y,
                         end_x - 4, center_y - 3],
                        fillColor=colors.HexColor("#527995"),
                        strokeColor=colors.HexColor("#527995"),
                    )
                )
    return diagram


def append_experiment_diagnostics(story: list, styles: dict[str, ParagraphStyle]) -> None:
    if not EXPERIMENT_PATH.is_file():
        raise FileNotFoundError(
            f"Experiment results not found for the PDF diagnostics appendix: {EXPERIMENT_PATH}"
        )
    experiment = json.loads(EXPERIMENT_PATH.read_text(encoding="utf-8"))
    selected = experiment["selection"]["best_configuration"]
    result = next(
        config for config in experiment["configurations"]
        if config["C"] == selected["C"]
        and config["max_features"] == selected["max_features"]
    )
    categories = experiment["category_order"]
    validation = result["validation_metrics"]

    story.extend([
        PageBreak(),
        Paragraph("Appendix: Selected Validation Diagnostics", styles["h1"]),
        Paragraph(
            f"Selected by validation Macro F1: C={selected['C']}, "
            f"max_features={selected['max_features']}; "
            f"validation Macro F1={validation['macro_f1']:.2f}%. "
            "The test set was not used.",
            styles["body"],
        ),
        Paragraph("Per-class validation metrics", styles["h2"]),
    ])
    per_class_rows = [[
        Paragraph("<b>Category</b>", styles["small"]),
        Paragraph("<b>Support</b>", styles["small"]),
        Paragraph("<b>Precision</b>", styles["small"]),
        Paragraph("<b>Recall</b>", styles["small"]),
        Paragraph("<b>F1</b>", styles["small"]),
    ]]
    for metric in validation["per_class"]:
        per_class_rows.append([
            Paragraph(inline_markup(metric["category"]), styles["small"]),
            Paragraph(str(metric["support"]), styles["small"]),
            Paragraph(f"{metric['precision']:.2f}%", styles["small"]),
            Paragraph(f"{metric['recall']:.2f}%", styles["small"]),
            Paragraph(f"{metric['f1']:.2f}%", styles["small"]),
        ])
    per_class_table = LongTable(
        per_class_rows,
        colWidths=[190, 55, 75, 75, 55],
        repeatRows=1,
        hAlign="LEFT",
    )
    per_class_table.setStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dce8f1")),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#aab7c4")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f7f9fb")]),
    ])
    story.extend([
        per_class_table,
        Spacer(1, 8),
        Paragraph("Validation confusion matrix: nonzero cells", styles["h2"]),
        Paragraph(
            "Rows identify the actual and predicted category labels. Diagonal rows "
            "are correct predictions; off-diagonal rows are errors.",
            styles["body"],
        ),
    ])
    matrix_rows = [[
        Paragraph("<b>Actual category</b>", styles["small"]),
        Paragraph("<b>Predicted category</b>", styles["small"]),
        Paragraph("<b>Count</b>", styles["small"]),
    ]]
    matrix = validation["confusion_matrix"]
    for actual_index, actual_category in enumerate(categories):
        for predicted_index, predicted_category in enumerate(categories):
            count = matrix[actual_index][predicted_index]
            if count:
                matrix_rows.append([
                    Paragraph(inline_markup(actual_category), styles["small"]),
                    Paragraph(inline_markup(predicted_category), styles["small"]),
                    Paragraph(str(count), styles["small"]),
                ])
    matrix_table = LongTable(
        matrix_rows, colWidths=[190, 190, 65], repeatRows=1, hAlign="LEFT"
    )
    matrix_table.setStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dce8f1")),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#aab7c4")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f7f9fb")]),
    ])
    story.append(matrix_table)


def numeric_confusion_table(
    matrix: list[list[int]],
    categories: list[str],
    styles: dict[str, ParagraphStyle],
    compact_style: ParagraphStyle,
) -> list:
    rows = [[
        Paragraph("<b>Actual / Pred.</b>", compact_style),
        *[
            Paragraph(f"<b>{index + 1:02d}</b>", compact_style)
            for index in range(len(categories))
        ],
    ]]
    for row_index, row in enumerate(matrix):
        rows.append([
            Paragraph(f"<b>{row_index + 1:02d}</b>", compact_style),
            *[Paragraph(str(value), compact_style) for value in row],
        ])
    widths = [58] + [36] * len(categories)
    table = LongTable(rows, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dce8f1")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#edf3f7")),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#aab7c4")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 1), (-1, -1), "CENTER"),
        ("ROWBACKGROUNDS", (1, 1), (-1, -1),
         [colors.white, colors.HexColor("#f7f9fb")]),
    ])
    mapping = [
        Paragraph(
            f"{index + 1:02d}: {inline_markup(category)}",
            styles["small"],
        )
        for index, category in enumerate(categories)
    ]
    return [table, Spacer(1, 4), *mapping]


def metric_table(
    metrics: dict[str, float],
    styles: dict[str, ParagraphStyle],
) -> LongTable:
    rows = [[
        Paragraph("<b>Metric</b>", styles["small"]),
        Paragraph("<b>Score</b>", styles["small"]),
    ]]
    for label, key in (
        ("Accuracy", "accuracy"),
        ("Macro precision", "macro_precision"),
        ("Macro recall", "macro_recall"),
        ("Macro F1", "macro_f1"),
        ("Weighted precision", "weighted_precision"),
        ("Weighted recall", "weighted_recall"),
        ("Weighted F1", "weighted_f1"),
    ):
        rows.append([
            Paragraph(label, styles["small"]),
            Paragraph(f"{metrics[key]:.2f}%", styles["small"]),
        ])
    table = LongTable(rows, colWidths=[180, 90], repeatRows=1, hAlign="LEFT")
    table.setStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dce8f1")),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#aab7c4")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f7f9fb")]),
    ])
    return table


def per_class_table(
    rows_data: list[dict],
    styles: dict[str, ParagraphStyle],
    grouped: bool,
) -> LongTable:
    rows = [[
        Paragraph("<b>Category</b>", styles["small"]),
        Paragraph("<b>Support</b>", styles["small"]),
        Paragraph("<b>Precision</b>", styles["small"]),
        Paragraph("<b>Recall</b>", styles["small"]),
        Paragraph("<b>F1</b>", styles["small"]),
    ]]
    for item in rows_data:
        if grouped:
            support = str(item["support_total"])
            precision = item["precision"]
            recall = item["recall"]
            f1 = item["f1"]
            values = [
                f"{precision['mean']:.2f} ± {precision['std']:.2f}%",
                f"{recall['mean']:.2f} ± {recall['std']:.2f}%",
                f"{f1['mean']:.2f} ± {f1['std']:.2f}%",
            ]
        else:
            support = str(item["support"])
            values = [
                f"{item['precision']:.2f}%",
                f"{item['recall']:.2f}%",
                f"{item['f1']:.2f}%",
            ]
        rows.append([
            Paragraph(inline_markup(item["category"]), styles["small"]),
            Paragraph(support, styles["small"]),
            *[Paragraph(value, styles["small"]) for value in values],
        ])
    table = LongTable(
        rows, colWidths=[190, 55, 85, 85, 85], repeatRows=1, hAlign="LEFT"
    )
    table.setStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dce8f1")),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#aab7c4")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f7f9fb")]),
    ])
    return table


def append_grouped_cv_diagnostics(
    story: list, styles: dict[str, ParagraphStyle]
) -> None:
    if not GROUPED_CV_PATH.is_file():
        raise FileNotFoundError(f"Grouped CV results not found: {GROUPED_CV_PATH}")
    result = json.loads(GROUPED_CV_PATH.read_text(encoding="utf-8"))
    categories = result["category_order"]
    selected_config = result["selection"]["selected_configuration"]
    selected = next(
        config for config in result["configurations"]
        if config["C"] == selected_config["C"]
        and config["max_features"] == selected_config["max_features"]
    )
    compact_style = ParagraphStyle(
        "ConfusionCell", parent=styles["small"], fontSize=5.5, leading=6.5
    )
    story.extend([
        PageBreak(),
        Paragraph("Appendix: Five-Fold Grouped Cross-Validation", styles["h1"]),
        Paragraph(
            "StratifiedGroupKFold, five folds, shuffle enabled, random_state=42. "
            "The 3,848 training-partition clauses from 368 source contracts were "
            "used; each fold kept source contracts intact and fit its own TF-IDF. "
            "The held-out test partition was not used for selection.",
            styles["body"],
        ),
    ])
    comparison_rows = [[
        Paragraph(f"<b>{heading}</b>", compact_style)
        for heading in (
            "C / features", "Accuracy", "Macro P", "Macro R", "Macro F1",
            "Weighted P", "Weighted R", "Weighted F1", "Train−val gap",
        )
    ]]
    for config in result["configurations"]:
        aggregate = config["validation_aggregate"]
        gap = config["macro_f1_gap_train_minus_validation"]

        def compact(metric: dict[str, float]) -> str:
            return f"{metric['mean']:.2f} ± {metric['std']:.2f}%"

        comparison_rows.append([
            Paragraph(f"{config['C']} / {config['max_features']}", compact_style),
            *[
                Paragraph(compact(aggregate[key]), compact_style)
                for key in ("accuracy", "macro_precision", "macro_recall",
                            "macro_f1", "weighted_precision", "weighted_recall",
                            "weighted_f1")
            ],
            Paragraph(f"{gap['mean']:.2f} ± {gap['std']:.2f} pp", compact_style),
        ])
    comparison = LongTable(
        comparison_rows,
        colWidths=[48, 48, 48, 48, 48, 48, 48, 48, 68],
        repeatRows=1,
        hAlign="LEFT",
    )
    comparison.setStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dce8f1")),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#aab7c4")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ])
    story.extend([
        comparison,
        Spacer(1, 6),
        Paragraph(
            f"Selected by mean validation Macro F1: C={selected_config['C']}, "
            f"max_features={selected_config['max_features']} "
            f"({result['selection']['mean_validation_macro_f1']:.2f}% ± "
            f"{result['selection']['validation_macro_f1_std']:.2f} pp).",
            styles["body"],
        ),
        Paragraph("Selected configuration: per-class out-of-fold metrics", styles["h2"]),
        per_class_table(
            selected["validation_aggregate"]["per_class"], styles, grouped=True
        ),
        Spacer(1, 7),
        Paragraph("Selected configuration: pooled out-of-fold confusion matrix", styles["h2"]),
        *numeric_confusion_table(
            selected["validation_aggregate"]["confusion_matrix_out_of_fold"],
            categories,
            styles,
            compact_style,
        ),
    ])


def append_final_test_diagnostics(
    story: list, styles: dict[str, ParagraphStyle]
) -> None:
    if not FINAL_TEST_PATH.is_file():
        raise FileNotFoundError(f"Final test results not found: {FINAL_TEST_PATH}")
    result = json.loads(FINAL_TEST_PATH.read_text(encoding="utf-8"))
    candidate = result["candidate_frozen_before_test_evaluation"]
    categories = json.loads(
        GROUPED_CV_PATH.read_text(encoding="utf-8")
    )["category_order"]
    metrics = result["test_metrics"]
    compact_style = ParagraphStyle(
        "TestConfusionCell", parent=styles["small"], fontSize=5.5, leading=6.5
    )
    story.extend([
        PageBreak(),
        Paragraph("Appendix: Frozen Candidate Final Test Evaluation", styles["h1"]),
        Paragraph(
            f"Candidate frozen from grouped CV: C={candidate['C']}, "
            f"max_features={candidate['max_features']}. The candidate "
            f"was scored once on {result['test_split']['test_contracts']} held-out "
            f"contracts / {result['test_split']['test_clauses']} clauses after "
            "selection. The production export was not changed.",
            styles["body"],
        ),
        metric_table(metrics, styles),
        Spacer(1, 8),
        Paragraph("Per-class test metrics", styles["h2"]),
        per_class_table(metrics["per_class"], styles, grouped=False),
        Spacer(1, 8),
        Paragraph("Test confusion matrix (numeric index mapping)", styles["h2"]),
        *numeric_confusion_table(
            metrics["confusion_matrix"], categories, styles, compact_style
        ),
    ])


def render_markdown(source: Path, output: Path, styles: dict[str, ParagraphStyle],
                    body_font: str) -> None:
    lines = source.read_text(encoding="utf-8").splitlines()
    story = []
    index = 0
    title_written = False

    while index < len(lines):
        stripped = lines[index].strip()
        if not stripped:
            index += 1
            continue

        if stripped.startswith("```"):
            is_mermaid = stripped.startswith("```mermaid")
            index += 1
            code_lines = []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code_lines.append(lines[index])
                index += 1
            if is_mermaid and any("flowchart" in line for line in code_lines):
                story.extend([Spacer(1, 4), architecture_drawing(), Spacer(1, 6)])
            else:
                story.append(Preformatted("\n".join(code_lines), styles["code"]))
            index += 1
            continue

        if stripped.startswith("|"):
            raw_rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                row = split_table_row(lines[index])
                is_separator = row and all(
                    re.fullmatch(r":?-{2,}:?", cell.replace(" ", "")) for cell in row
                )
                if not is_separator:
                    raw_rows.append(row)
                index += 1
            if raw_rows:
                column_count = max(map(len, raw_rows))
                rows = []
                for row_index, row in enumerate(raw_rows):
                    padded = row + [""] * (column_count - len(row))
                    cells = []
                    for cell in padded:
                        content = inline_markup(cell.replace("<br/>", " "))
                        if row_index == 0:
                            content = f"<b>{content}</b>"
                        cells.append(Paragraph(content, styles["small"]))
                    rows.append(cells)
                available_width = letter[0] - 1.3 * inch
                table = LongTable(
                    rows,
                    colWidths=[available_width / column_count] * column_count,
                    repeatRows=1,
                    hAlign="LEFT",
                )
                table.setStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dce8f1")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#16324f")),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#aab7c4")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1),
                     [colors.white, colors.HexColor("#f7f9fb")]),
                ])
                story.extend([Spacer(1, 3), table, Spacer(1, 5)])
            continue

        if stripped in ("---", "***", "___"):
            story.append(Spacer(1, 6))
            index += 1
            continue

        if stripped.startswith("#"):
            level = len(stripped) - len(stripped.lstrip("#"))
            heading = inline_markup(stripped[level:].strip())
            if level == 1 and not title_written:
                story.extend([Spacer(1, 0.35 * inch),
                              Paragraph(heading, styles["title"])])
                title_written = True
            else:
                style_key = "h1" if level <= 2 else "h2"
                story.append(Paragraph(heading, styles[style_key]))
            index += 1
            continue

        if stripped.startswith(">"):
            story.append(Paragraph(
                inline_markup(stripped[1:].strip()), styles["quote"]
            ))
            index += 1
            continue

        if re.match(r"^[-*] ", stripped) or re.match(r"^\d+\. ", stripped):
            item = re.sub(r"^[-*] ", "• ", stripped)
            story.append(Paragraph(
                inline_markup(item),
                ParagraphStyle(
                    f"List{index}", parent=styles["body"],
                    leftIndent=12, firstLineIndent=-8, spaceAfter=2,
                ),
            ))
            index += 1
            continue

        paragraph = [stripped]
        index += 1
        while index < len(lines):
            following = lines[index].strip()
            starts_block = (
                not following
                or following.startswith(("#", "|", "```", ">"))
                or re.match(r"^[-*] ", following)
                or re.match(r"^\d+\. ", following)
                or following in ("---", "***", "___")
            )
            if starts_block:
                break
            paragraph.append(following)
            index += 1
        story.append(Paragraph(inline_markup(" ".join(paragraph)), styles["body"]))

    append_experiment_diagnostics(story, styles)
    append_grouped_cv_diagnostics(story, styles)
    append_final_test_diagnostics(story, styles)

    def draw_footer(canvas, document) -> None:
        canvas.saveState()
        canvas.setFont(body_font, 7)
        canvas.setFillColor(colors.HexColor("#667788"))
        canvas.drawString(0.65 * inch, 0.4 * inch,
                          "LexiGuard — Final Project Report")
        canvas.drawRightString(letter[0] - 0.65 * inch, 0.4 * inch,
                               f"Page {document.page}")
        canvas.restoreState()

    document = SimpleDocTemplate(
        str(output), pagesize=letter, rightMargin=0.65 * inch,
        leftMargin=0.65 * inch, topMargin=0.62 * inch, bottomMargin=0.65 * inch,
        title="LexiGuard Final Project Report", author="LexiGuard Project",
    )
    document.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)


def main() -> None:
    if not SOURCE_PATH.is_file():
        raise FileNotFoundError(
            f"Final Markdown report not found: {SOURCE_PATH}"
        )
    body_font, bold_font = register_fonts()
    styles = make_styles(body_font, bold_font)
    PRIMARY_PDF.parent.mkdir(parents=True, exist_ok=True)
    render_markdown(SOURCE_PATH, PRIMARY_PDF, styles, body_font)
    for destination in COPY_PATHS:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(PRIMARY_PDF, destination)
    print(f"Generated {PRIMARY_PDF}")
    for destination in COPY_PATHS:
        print(f"Updated {destination}")


if __name__ == "__main__":
    main()
