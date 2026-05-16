// src/utils/pdf-generator.js

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getCategoryTotal = (yearsData) =>
    Object.values(yearsData).reduce((sum, y) => sum + y.count, 0);

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

// ── Colour palette ────────────────────────────────────────────────────────────
const COLOR = {
    headerBlue: [41, 128, 185],   // thead background
    footerBlue: [214, 234, 248],  // tfoot / total row background
    sideBlue: [214, 234, 248],  // side-row highlight
    categoryTeal: [240, 249, 249],  // category-row highlight
    fromDark: [26, 82, 118],    // from-court sub-heading background (dark navy)
};

// ── Public export ─────────────────────────────────────────────────────────────
export const generatePdfReport = (reportData, transferSummary, processed) => {
    const hasCourtData = processed.some(p => p.fromCourt && p.toCourt);
    const doc = new jsPDF();
    let yPos = 15;
    const pageH = doc.internal.pageSize.height;
    const bottomMargin = 20;

    const ensureSpace = (needed = 30) => {
        if (yPos + needed > pageH - bottomMargin) { doc.addPage(); yPos = 15; }
    };

    // ── Section heading helper ─────────────────────────────────────────────────
    const sectionHeading = (text, size = 18) => {
        ensureSpace(20);
        doc.setFontSize(size);
        doc.setFont(undefined, 'bold');
        doc.text(text, 14, yPos);
        doc.setFont(undefined, 'normal');
        yPos += size === 18 ? 12 : 10;
    };

    // ── 1. Cases Report ────────────────────────────────────────────────────────
    sectionHeading('Cases Report', 18);

    Object.keys(reportData).sort().forEach(consoMain => {
        const consoData = reportData[consoMain];
        const totalCases = Object.values(consoData).reduce(
            (sum, sideData) => sum + Object.values(sideData).reduce(
                (s2, catData) => s2 + getCategoryTotal(catData), 0), 0
        );

        ensureSpace(30);
        doc.setFontSize(13);
        doc.setFont(undefined, 'bold');
        doc.text(`${consoMain} (${totalCases} cases)`, 14, yPos);
        doc.setFont(undefined, 'normal');
        yPos += 8;

        const sideKeys = Object.keys(consoData).sort();
        const showSideRow = !(sideKeys.length === 1 && sideKeys[0] === 'General');
        const tableBody = [];

        sideKeys.forEach(side => {
            const sideData = consoData[side];
            const sideTotal = Object.values(sideData).reduce(
                (sum, catData) => sum + getCategoryTotal(catData), 0
            );

            if (showSideRow) {
                tableBody.push([{
                    content: `${side.toUpperCase()}  (${sideTotal} cases)`,
                    colSpan: 2,
                    styles: { fontStyle: 'bold', fillColor: COLOR.sideBlue, textColor: 0, halign: 'left' },
                }]);
            }

            Object.keys(sideData).sort().forEach(categoryKey => {
                const yearsData = sideData[categoryKey];
                const categoryTotal = getCategoryTotal(yearsData);

                tableBody.push([{
                    content: `${categoryKey} (${categoryTotal} cases)`,
                    colSpan: 2,
                    styles: { fontStyle: 'bold', fillColor: COLOR.categoryTeal, textColor: 0, halign: 'left' },
                }]);

                Object.keys(yearsData).sort().forEach(year => {
                    const yearData = yearsData[year];
                    const caseNumbers = yearData.cases.sort((a, b) => Number(a) - Number(b)).join(', ');
                    tableBody.push([`${year} (${yearData.count})`, caseNumbers]);
                });
            });
        });

        autoTable(doc, {
            startY: yPos,
            head: [['Year', 'Case Numbers']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: COLOR.headerBlue, textColor: 255, fontStyle: 'bold' },
            columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 'auto' } },
            margin: { left: 14, right: 14 },
            styles: { fontSize: 9, cellPadding: 2 },
        });
        yPos = doc.lastAutoTable.finalY + 12;
    });

    // ── 2. Transfer Summary ────────────────────────────────────────────────────
    if (hasCourtData) {
        doc.addPage(); yPos = 15;
        sectionHeading('Transfer Summary', 18);

        const fromCourts = Object.keys(transferSummary).sort();
        const toCourts = [...new Set(processed.map(p => p.toCourt).filter(Boolean))].sort();

        const head = [['FROM \\ TO', ...toCourts, 'Total']];
        const body = fromCourts.map(from => {
            let rowTotal = 0;
            const row = [from];
            toCourts.forEach(to => {
                const count = transferSummary[from]?.[to] || 0;
                row.push(count > 0 ? count : '-');
                rowTotal += count;
            });
            row.push(rowTotal);
            return row;
        });
        const foot = [['Total', ...toCourts.map(to =>
            fromCourts.reduce((s, f) => s + (transferSummary[f]?.[to] || 0), 0)
        ), processed.filter(p => p.fromCourt && p.toCourt).length]];

        autoTable(doc, {
            startY: yPos, head, body, foot, theme: 'grid',
            headStyles: { fillColor: COLOR.headerBlue, textColor: 255, fontStyle: 'bold' },
            footStyles: { fillColor: COLOR.footerBlue, textColor: 0, fontStyle: 'bold' },
            margin: { left: 14, right: 14 },
            styles: { fontSize: 9 },
        });
        yPos = doc.lastAutoTable.finalY + 12;
    }

    // ── 3. Category & Side Summary ─────────────────────────────────────────────
    const { summary, categories, sides } = buildCategorySideSummary(processed);
    if (categories.length > 0 && sides.length > 0) {
        ensureSpace(40);
        if (yPos > 40) { yPos += 10; } // small gap if on same page
        sectionHeading('Category & Side Summary', 16);

        const headCat = [['CATEGORY \\ SIDE', ...sides, 'Total']];
        const bodyCat = categories.map(cat => {
            let rowTotal = 0;
            const row = [cat];
            sides.forEach(side => {
                const count = summary[cat]?.[side] || 0;
                row.push(count > 0 ? count : '—');
                rowTotal += count;
            });
            row.push(rowTotal);
            return row;
        });
        const footCat = [['Total', ...sides.map(side =>
            categories.reduce((s, cat) => s + (summary[cat]?.[side] || 0), 0)
        ), processed.length]];

        autoTable(doc, {
            startY: yPos, head: headCat, body: bodyCat, foot: footCat, theme: 'grid',
            headStyles: { fillColor: COLOR.headerBlue, textColor: 255, fontStyle: 'bold' },
            footStyles: { fillColor: COLOR.footerBlue, textColor: 0, fontStyle: 'bold' },
            margin: { left: 14, right: 14 },
            styles: { fontSize: 9 },
        });
        yPos = doc.lastAutoTable.finalY + 12;
    }

    // ── 4. Transfer From Summary ───────────────────────────────────────────────
    if (hasCourtData) {
        const fromSummary = buildTransferFromSummary(processed);
        const fromCourts = Object.keys(fromSummary).sort();

        if (fromCourts.length > 0) {
            doc.addPage(); yPos = 15;
            sectionHeading('Transfer From Summary (Category × Transfer-To Courts)', 16);

            fromCourts.forEach(from => {
                const { categories: cats, toCourts, data } = fromSummary[from];
                const fromTotal = cats.reduce(
                    (s, cat) => s + toCourts.reduce((s2, to) => s2 + (data[cat]?.[to] || 0), 0), 0
                );

                ensureSpace(35);

                // From-court sub-heading bar
                doc.setFillColor(...COLOR.fromDark);
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                const barY = yPos - 4;
                doc.rect(14, barY, doc.internal.pageSize.width - 28, 8, 'F');
                doc.text(`From Court: ${from}  (${fromTotal} cases)`, 16, yPos + 1);
                doc.setTextColor(0, 0, 0);
                doc.setFont(undefined, 'normal');
                yPos += 12;

                const head = [['CATEGORY \\ TO COURT', ...toCourts, 'Total']];
                const body = cats.map(cat => {
                    let rowTotal = 0;
                    const row = [cat];
                    toCourts.forEach(to => {
                        const count = data[cat]?.[to] || 0;
                        row.push(count > 0 ? count : '—');
                        rowTotal += count;
                    });
                    row.push(rowTotal);
                    return row;
                });
                const foot = [['Total', ...toCourts.map(to =>
                    cats.reduce((s, cat) => s + (data[cat]?.[to] || 0), 0)
                ), fromTotal]];

                autoTable(doc, {
                    startY: yPos, head, body, foot, theme: 'grid',
                    headStyles: { fillColor: COLOR.headerBlue, textColor: 255, fontStyle: 'bold' },
                    footStyles: { fillColor: COLOR.footerBlue, textColor: 0, fontStyle: 'bold' },
                    margin: { left: 14, right: 14 },
                    styles: { fontSize: 9 },
                });
                yPos = doc.lastAutoTable.finalY + 14;
            });
        }
    }

    doc.save('CasesReport_Formatted.pdf');
};