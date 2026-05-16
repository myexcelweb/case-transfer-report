// src/utils/docx-generator.js

import {
    Document, Packer, Paragraph, Table, TableCell, TableRow,
    TextRun, HeadingLevel, WidthType, AlignmentType,
    BorderStyle, ShadingType
} from 'docx';

// ── Page / column constants (A4, 1" margins) ─────────────────────────────────
const TABLE_WIDTH = 9026;                          // DXA — A4 content width at 1" margins
const COL_YEAR = Math.round(TABLE_WIDTH * 0.25); // 25 %
const COL_CASES = TABLE_WIDTH - COL_YEAR;         // 75 %

const borderStyle = {
    top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
};

const cellPad = { top: 80, bottom: 80, left: 120, right: 120 };

// ── Shared helpers ────────────────────────────────────────────────────────────

const getCategoryTotal = (yearsData) =>
    Object.values(yearsData).reduce((sum, y) => sum + y.count, 0);

/** A standard header cell with blue-grey shading */
const hCell = (text, colWidthDxa) => new TableCell({
    borders: borderStyle,
    margins: cellPad,
    ...(colWidthDxa ? { width: { size: colWidthDxa, type: WidthType.DXA } } : {}),
    shading: { fill: 'D9E1F2', type: ShadingType.CLEAR },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
});

/** A footer cell with light-blue shading */
const fCell = (text, align = AlignmentType.CENTER) => new TableCell({
    borders: borderStyle,
    margins: cellPad,
    shading: { fill: 'D9E1F2', type: ShadingType.CLEAR },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })], alignment: align })],
});

/** Build equal-ish column widths for N columns */
const equalCols = (n) => {
    const w = Math.floor(TABLE_WIDTH / n);
    const last = TABLE_WIDTH - w * (n - 1);
    return [...Array(n - 1).fill(w), last];
};

// ── Build Category & Side Summary (shared between docx & excel) ───────────────
const buildCategorySideSummary = (processed) => {
    const summary = {}, allCategories = new Set(), allSides = new Set();
    processed.forEach(item => {
        const cat = item.combinedCategory || '(Unspecified)';
        const side = item.side || '(Unspecified)';
        allCategories.add(cat); allSides.add(side);
        if (!summary[cat]) summary[cat] = {};
        summary[cat][side] = (summary[cat][side] || 0) + 1;
    });
    return { summary, categories: [...allCategories].sort(), sides: [...allSides].sort() };
};

/**
 * Build Transfer From Summary structure:
 * { [fromCourt]: { categories: string[], toCourts: string[], data: { [cat]: { [toCourt]: number } } } }
 */
const buildTransferFromSummary = (processed) => {
    const raw = {};
    processed.forEach(item => {
        if (!item.fromCourt || !item.toCourt) return;
        const from = item.fromCourt;
        const to = item.toCourt;
        const cat = item.combinedCategory || item.category || '(Unspecified)';
        if (!raw[from]) raw[from] = {};
        if (!raw[from][cat]) raw[from][cat] = {};
        raw[from][cat][to] = (raw[from][cat][to] || 0) + 1;
    });

    const shaped = {};
    Object.keys(raw).sort().forEach(from => {
        const catMap = raw[from];
        const cats = Object.keys(catMap).sort();
        const toCourts = [...new Set(cats.flatMap(c => Object.keys(catMap[c])))].sort();
        shaped[from] = { categories: cats, toCourts, data: catMap };
    });
    return shaped;
};

// ── Two-column table (Year | Case Numbers) used for main Cases Report ─────────
const buildTwoColumnCategoryTable = (consoData) => {
    const rows = [];

    rows.push(new TableRow({
        tableHeader: true,
        children: [
            new TableCell({
                borders: borderStyle, margins: cellPad,
                width: { size: COL_YEAR, type: WidthType.DXA },
                shading: { fill: 'D9E1F2', type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: 'Year', bold: true })] })],
            }),
            new TableCell({
                borders: borderStyle, margins: cellPad,
                width: { size: COL_CASES, type: WidthType.DXA },
                shading: { fill: 'D9E1F2', type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: 'Case Numbers', bold: true })] })],
            }),
        ],
    }));

    const sideKeys = Object.keys(consoData).sort();
    const showSideRow = !(sideKeys.length === 1 && sideKeys[0] === 'General');

    sideKeys.forEach(side => {
        const sideData = consoData[side];
        const sideTotal = Object.values(sideData).reduce(
            (sum, catData) => sum + getCategoryTotal(catData), 0
        );

        if (showSideRow) {
            rows.push(new TableRow({
                children: [new TableCell({
                    borders: borderStyle, margins: cellPad, columnSpan: 2,
                    width: { size: TABLE_WIDTH, type: WidthType.DXA },
                    shading: { fill: 'D6EAF8', type: ShadingType.CLEAR },
                    children: [new Paragraph({
                        children: [
                            new TextRun({ text: side.toUpperCase(), bold: true }),
                            new TextRun({ text: `  (${sideTotal} cases)` }),
                        ],
                    })],
                })],
            }));
        }

        Object.keys(sideData).sort().forEach(categoryKey => {
            const yearsData = sideData[categoryKey];
            const categoryTotal = getCategoryTotal(yearsData);

            rows.push(new TableRow({
                children: [new TableCell({
                    borders: borderStyle, margins: cellPad, columnSpan: 2,
                    width: { size: TABLE_WIDTH, type: WidthType.DXA },
                    shading: { fill: 'F0F9F9', type: ShadingType.CLEAR },
                    children: [new Paragraph({
                        children: [new TextRun({ text: `${categoryKey} (${categoryTotal} cases)`, bold: true })],
                    })],
                })],
            }));

            Object.keys(yearsData).sort().forEach(year => {
                const yearData = yearsData[year];
                const caseNumbers = yearData.cases.sort((a, b) => Number(a) - Number(b)).join(', ');
                rows.push(new TableRow({
                    children: [
                        new TableCell({ borders: borderStyle, margins: cellPad, width: { size: COL_YEAR, type: WidthType.DXA }, children: [new Paragraph({ text: `${year} (${yearData.count})` })] }),
                        new TableCell({ borders: borderStyle, margins: cellPad, width: { size: COL_CASES, type: WidthType.DXA }, children: [new Paragraph({ text: caseNumbers })] }),
                    ],
                }));
            });
        });
    });

    return new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: [COL_YEAR, COL_CASES], rows });
};

// ── Main Cases Report sections ────────────────────────────────────────────────
const generateDocxReportSections = (reportData) => {
    const sections = [];
    Object.keys(reportData).sort().forEach(consoMain => {
        const consoData = reportData[consoMain];
        const totalCases = Object.values(consoData).reduce(
            (sum, sideData) => sum + Object.values(sideData).reduce(
                (s2, years) => s2 + Object.values(years).reduce((s3, y) => s3 + y.count, 0), 0), 0
        );
        sections.push(new Paragraph({
            text: `${consoMain} (${totalCases} cases)`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
        }));
        sections.push(buildTwoColumnCategoryTable(consoData));
        sections.push(new Paragraph({ text: '', spacing: { after: 300 } }));
    });
    return sections;
};

// ── Transfer Summary table ────────────────────────────────────────────────────
const generateDocxTransferTable = (summary, processed) => {
    const fromCourts = Object.keys(summary).sort();
    const toCourts = [...new Set(processed.filter(p => p.toCourt).map(p => p.toCourt))].sort();
    if (!fromCourts.length || !toCourts.length) return new Table({ rows: [] });

    const colCount = toCourts.length + 2;
    const colWidths = equalCols(colCount);

    const headerRow = new TableRow({
        tableHeader: true,
        children: [hCell('FROM \\ TO'), ...toCourts.map(tc => hCell(tc)), hCell('Total')],
    });

    const dataRows = fromCourts.map(from => {
        let rowTotal = 0;
        return new TableRow({
            children: [
                new TableCell({ borders: borderStyle, margins: cellPad, children: [new Paragraph({ children: [new TextRun({ text: from, bold: true })] })] }),
                ...toCourts.map(to => {
                    const count = summary[from]?.[to] || 0;
                    rowTotal += count;
                    return new TableCell({ borders: borderStyle, margins: cellPad, children: [new Paragraph({ text: count > 0 ? String(count) : '-', alignment: AlignmentType.CENTER })] });
                }),
                new TableCell({ borders: borderStyle, margins: cellPad, children: [new Paragraph({ children: [new TextRun({ text: String(rowTotal), bold: true })], alignment: AlignmentType.CENTER })] }),
            ],
        });
    });

    const totalRow = new TableRow({
        children: [
            fCell('Total', AlignmentType.LEFT),
            ...toCourts.map(to => fCell(String(fromCourts.reduce((s, f) => s + (summary[f]?.[to] || 0), 0)))),
            fCell(String(processed.filter(p => p.fromCourt && p.toCourt).length)),
        ],
    });

    return new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: colWidths, rows: [headerRow, ...dataRows, totalRow] });
};

// ── Category & Side Summary table ────────────────────────────────────────────
const generateDocxCategorySideTable = (processed) => {
    const { summary, categories, sides } = buildCategorySideSummary(processed);
    if (!categories.length || !sides.length) return null;

    const colCount = sides.length + 2;
    const colWidths = equalCols(colCount);

    const headerRow = new TableRow({
        tableHeader: true,
        children: [hCell('CATEGORY \\ SIDE'), ...sides.map(s => hCell(s)), hCell('Total')],
    });

    const dataRows = categories.map(cat => {
        let rowTotal = 0;
        return new TableRow({
            children: [
                new TableCell({ borders: borderStyle, margins: cellPad, children: [new Paragraph({ children: [new TextRun({ text: cat, bold: true })] })] }),
                ...sides.map(side => {
                    const count = summary[cat]?.[side] || 0;
                    rowTotal += count;
                    return new TableCell({ borders: borderStyle, margins: cellPad, children: [new Paragraph({ text: count > 0 ? String(count) : '—', alignment: AlignmentType.CENTER })] });
                }),
                new TableCell({ borders: borderStyle, margins: cellPad, children: [new Paragraph({ children: [new TextRun({ text: String(rowTotal), bold: true })], alignment: AlignmentType.CENTER })] }),
            ],
        });
    });

    const totalRow = new TableRow({
        children: [
            fCell('Total', AlignmentType.LEFT),
            ...sides.map(side => fCell(String(categories.reduce((s, cat) => s + (summary[cat]?.[side] || 0), 0)))),
            fCell(String(processed.length)),
        ],
    });

    return new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: colWidths, rows: [headerRow, ...dataRows, totalRow] });
};

// ── Transfer From Summary tables (one per from-court) ────────────────────────
const generateDocxTransferFromTables = (processed) => {
    const fromSummary = buildTransferFromSummary(processed);
    const fromCourts = Object.keys(fromSummary).sort();
    if (!fromCourts.length) return [];

    const elements = [];

    fromCourts.forEach(from => {
        const { categories, toCourts, data } = fromSummary[from];
        const fromTotal = categories.reduce(
            (s, cat) => s + toCourts.reduce((s2, to) => s2 + (data[cat]?.[to] || 0), 0), 0
        );

        // Sub-heading per from-court
        elements.push(new Paragraph({
            children: [
                new TextRun({ text: `From Court: ${from}`, bold: true }),
                new TextRun({ text: `  (${fromTotal} cases)` }),
            ],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 300, after: 160 },
        }));

        const colCount = toCourts.length + 2; // category + to-courts + total
        const colWidths = equalCols(colCount);

        const headerRow = new TableRow({
            tableHeader: true,
            children: [hCell('CATEGORY \\ TO COURT'), ...toCourts.map(tc => hCell(tc)), hCell('Total')],
        });

        const dataRows = categories.map(cat => {
            let rowTotal = 0;
            return new TableRow({
                children: [
                    new TableCell({ borders: borderStyle, margins: cellPad, children: [new Paragraph({ children: [new TextRun({ text: cat, bold: true })] })] }),
                    ...toCourts.map(to => {
                        const count = data[cat]?.[to] || 0;
                        rowTotal += count;
                        return new TableCell({ borders: borderStyle, margins: cellPad, children: [new Paragraph({ text: count > 0 ? String(count) : '—', alignment: AlignmentType.CENTER })] });
                    }),
                    new TableCell({ borders: borderStyle, margins: cellPad, children: [new Paragraph({ children: [new TextRun({ text: String(rowTotal), bold: true })], alignment: AlignmentType.CENTER })] }),
                ],
            });
        });

        const totalRow = new TableRow({
            children: [
                fCell('Total', AlignmentType.LEFT),
                ...toCourts.map(to => fCell(String(categories.reduce((s, cat) => s + (data[cat]?.[to] || 0), 0)))),
                fCell(String(fromTotal)),
            ],
        });

        elements.push(
            new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: colWidths, rows: [headerRow, ...dataRows, totalRow] }),
            new Paragraph({ text: '', spacing: { after: 240 } })
        );
    });

    return elements;
};

// ── Public export ─────────────────────────────────────────────────────────────
export const generateDocxReport = async (reportData, transferSummary, processed) => {
    const hasCourtData = processed.some(p => p.fromCourt && p.toCourt);

    const docChildren = [
        new Paragraph({ text: 'Cases Report', heading: HeadingLevel.HEADING_1, spacing: { after: 400 } }),
        ...generateDocxReportSections(reportData),
    ];

    // Transfer Summary
    if (hasCourtData) {
        docChildren.push(
            new Paragraph({ text: '', pageBreakBefore: true }),
            new Paragraph({ text: 'Transfer Summary', heading: HeadingLevel.HEADING_1, spacing: { after: 400 } }),
            generateDocxTransferTable(transferSummary, processed)
        );
    }

    // Category & Side Summary
    const catSideTable = generateDocxCategorySideTable(processed);
    if (catSideTable) {
        docChildren.push(
            new Paragraph({ text: '', pageBreakBefore: true }),
            new Paragraph({ text: 'Category & Side Summary', heading: HeadingLevel.HEADING_1, spacing: { after: 400 } }),
            catSideTable
        );
    }

    // Transfer From Summary (new)
    if (hasCourtData) {
        const fromElements = generateDocxTransferFromTables(processed);
        if (fromElements.length > 0) {
            docChildren.push(
                new Paragraph({ text: '', pageBreakBefore: true }),
                new Paragraph({
                    text: 'Transfer From Summary (Category × Transfer-To Courts)',
                    heading: HeadingLevel.HEADING_1,
                    spacing: { after: 400 },
                }),
                ...fromElements
            );
        }
    }

    const doc = new Document({ sections: [{ children: docChildren }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CasesReport_Combined.docx';
    a.click();
    URL.revokeObjectURL(url);
};