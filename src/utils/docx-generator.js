// src/utils/docx-generator.js

import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, HeadingLevel, WidthType } from 'docx';

// These are helper functions, local to this file
const generateDocxReportSections = (reportData) => {
    const sections = [];
    Object.keys(reportData).sort().forEach(consoMain => {
        const consoData = reportData[consoMain];
        const totalCases = Object.values(consoData).reduce((sum, years) => sum + Object.values(years).reduce((s, y) => s + y.count, 0), 0);
        sections.push(new Paragraph({ text: `${consoMain} (${totalCases} cases)`, heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }));
        Object.keys(consoData).sort().forEach(conso => {
            const yearsData = consoData[conso];
            const totalConsoCases = Object.values(yearsData).reduce((s, y) => s + y.count, 0);
            sections.push(new Paragraph({ children: [new TextRun({ text: 'Sub-Category: ', bold: true }), new TextRun({ text: `${conso} (${totalConsoCases} cases)` })], spacing: { before: 200, after: 100 } }));
            const tableRows = [new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Year', bold: true })], width: { size: 20, type: WidthType.PERCENTAGE } }), new TableCell({ children: [new Paragraph({ text: 'Case Numbers', bold: true })], width: { size: 80, type: WidthType.PERCENTAGE } })] })];
            Object.keys(yearsData).sort().forEach(year => {
                const yearData = yearsData[year];
                tableRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph(`${year} (${yearData.count})`)] }), new TableCell({ children: [new Paragraph(yearData.cases.sort((a, b) => a - b).join(', '))] })] }));
            });
            sections.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }), new Paragraph({ text: '', spacing: { after: 200 } }));
        });
    });
    return sections;
};

const generateDocxTransferTable = (summary, processed) => {
    const fromCourts = Object.keys(summary).sort();
    const toCourts = [...new Set(processed.filter(p => p.toCourt).map(p => p.toCourt))].sort();
    if (fromCourts.length === 0 || toCourts.length === 0) return new Table({ rows: [] });
    const headerRow = new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'FROM \\ TO', bold: true })] }), ...toCourts.map(tc => new TableCell({ children: [new Paragraph({ text: tc, bold: true })] })), new TableCell({ children: [new Paragraph({ text: 'Total', bold: true })] })] });
    const dataRows = fromCourts.map(from => {
        let rowTotal = 0;
        const cells = [new TableCell({ children: [new Paragraph({ text: from, bold: true })] }), ...toCourts.map(to => { const count = summary[from][to] || 0; rowTotal += count; return new TableCell({ children: [new Paragraph(count > 0 ? String(count) : '-')] }); }), new TableCell({ children: [new Paragraph({ text: String(rowTotal), bold: true })] })];
        return new TableRow({ children: cells });
    });
    const totalRow = new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Total', bold: true })] }), ...toCourts.map(to => { const colTotal = fromCourts.reduce((sum, from) => sum + (summary[from][to] || 0), 0); return new TableCell({ children: [new Paragraph({ text: String(colTotal), bold: true })] }); }), new TableCell({ children: [new Paragraph({ text: String(processed.filter(p => p.fromCourt).length), bold: true })] })] });
    return new Table({ rows: [headerRow, ...dataRows, totalRow], width: { size: 100, type: WidthType.PERCENTAGE } });
};


// This is the main exported function
export const generateDocxReport = async (reportData, transferSummary, processed) => {
    const hasCourtData = processed.some(p => p.fromCourt && p.toCourt);
    const docChildren = [
        new Paragraph({ text: 'Cases Report', heading: HeadingLevel.HEADING_1, spacing: { after: 400 } }),
        ...generateDocxReportSections(reportData)
    ];

    if (hasCourtData) {
        docChildren.push(
            new Paragraph({ text: '', pageBreakBefore: true }),
            new Paragraph({ text: 'Transfer Summary', heading: HeadingLevel.HEADING_1, spacing: { after: 400 } }),
            generateDocxTransferTable(transferSummary, processed)
        );
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