// src/utils/excel-generator.js

import * as XLSX from 'xlsx';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Main export ───────────────────────────────────────────────────────────────

export const generateExcelReport = (reportData, transferSummary, processed) => {
    const hasCourtData = processed.some(p => p.fromCourt && p.toCourt);
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Cases Report ─────────────────────────────────────────────────
    const wsData = [];
    const merges = [];
    let rowIndex = 0;

    wsData.push(['Cases Report']);
    merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 1 } });
    rowIndex++;
    wsData.push([]); rowIndex++;

    Object.keys(reportData).sort().forEach(consoMain => {
        const consoData = reportData[consoMain];
        const totalCases = Object.values(consoData).reduce(
            (sum, sideData) => sum + Object.values(sideData).reduce(
                (s2, catData) => s2 + getCategoryTotal(catData), 0), 0
        );

        wsData.push([`${consoMain} (${totalCases} cases)`]);
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 1 } });
        rowIndex++;

        wsData.push(['Year', 'Case Numbers']);
        rowIndex++;

        const sideKeys = Object.keys(consoData).sort();
        const showSideRow = !(sideKeys.length === 1 && sideKeys[0] === 'General');

        sideKeys.forEach(side => {
            const sideData = consoData[side];
            const sideTotal = Object.values(sideData).reduce(
                (sum, catData) => sum + getCategoryTotal(catData), 0
            );

            if (showSideRow) {
                wsData.push([`${side.toUpperCase()}  (${sideTotal} cases)`, '']);
                merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 1 } });
                rowIndex++;
            }

            Object.keys(sideData).sort().forEach(categoryKey => {
                const yearsData = sideData[categoryKey];
                const categoryTotal = getCategoryTotal(yearsData);

                wsData.push([`${categoryKey} (${categoryTotal} cases)`, '']);
                merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 1 } });
                rowIndex++;

                Object.keys(yearsData).sort().forEach(year => {
                    const yearData = yearsData[year];
                    const caseNumbers = yearData.cases.sort((a, b) => Number(a) - Number(b)).join(', ');
                    wsData.push([`${year} (${yearData.count})`, caseNumbers]);
                    rowIndex++;
                });
            });
        });

        wsData.push([]); rowIndex++;
    });

    const wsCases = XLSX.utils.aoa_to_sheet(wsData);
    wsCases['!merges'] = merges;
    wsCases['!cols'] = [{ wch: 25 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsCases, 'Cases Report');

    // ── Sheet 2: Transfer Summary ─────────────────────────────────────────────
    if (hasCourtData) {
        const fromCourts = Object.keys(transferSummary).sort();
        const toCourts = [...new Set(processed.map(p => p.toCourt).filter(Boolean))].sort();
        const summaryData = [['FROM \\ TO', ...toCourts, 'Total']];

        fromCourts.forEach(from => {
            let rowTotal = 0;
            const row = [from];
            toCourts.forEach(to => {
                const count = transferSummary[from]?.[to] || 0;
                row.push(count > 0 ? count : '-');
                rowTotal += count;
            });
            row.push(rowTotal);
            summaryData.push(row);
        });

        const totalRow = ['Total'];
        toCourts.forEach(to =>
            totalRow.push(fromCourts.reduce((sum, from) => sum + (transferSummary[from]?.[to] || 0), 0))
        );
        totalRow.push(processed.filter(p => p.fromCourt && p.toCourt).length);
        summaryData.push(totalRow);

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 18 }, ...toCourts.map(() => ({ wch: 12 })), { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Transfer Summary');
    }

    // ── Sheet 3: Category & Side Summary ─────────────────────────────────────
    const { summary, categories, sides } = buildCategorySideSummary(processed);
    const catSideData = [['CATEGORY \\ SIDE', ...sides, 'Total']];

    categories.forEach(cat => {
        let rowTotal = 0;
        const row = [cat];
        sides.forEach(side => {
            const count = summary[cat]?.[side] || 0;
            row.push(count > 0 ? count : '—');
            rowTotal += count;
        });
        row.push(rowTotal);
        catSideData.push(row);
    });

    const totalRowCat = ['Total'];
    sides.forEach(side =>
        totalRowCat.push(categories.reduce((sum, cat) => sum + (summary[cat]?.[side] || 0), 0))
    );
    totalRowCat.push(processed.length);
    catSideData.push(totalRowCat);

    const wsCatSide = XLSX.utils.aoa_to_sheet(catSideData);
    wsCatSide['!cols'] = [{ wch: 28 }, ...sides.map(() => ({ wch: 14 })), { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsCatSide, 'Category & Side Summary');

    // ── Sheet 4: Transfer From Summary (one table per from-court) ────────────
    if (hasCourtData) {
        const fromSummary = buildTransferFromSummary(processed);
        const fromCourts = Object.keys(fromSummary).sort();

        if (fromCourts.length > 0) {
            const wsRows = [];
            const wsMerges = [];
            let ri = 0;

            // Sheet title
            wsRows.push(['Transfer From Summary']);
            wsMerges.push({ s: { r: ri, c: 0 }, e: { r: ri, c: 5 } });
            ri++;
            wsRows.push([]); ri++;

            fromCourts.forEach(from => {
                const { categories: cats, toCourts, data } = fromSummary[from];
                const fromTotal = cats.reduce(
                    (s, cat) => s + toCourts.reduce((s2, to) => s2 + (data[cat]?.[to] || 0), 0), 0
                );
                const colCount = toCourts.length + 2; // category col + to-courts + total

                // From-court heading (spans all columns)
                wsRows.push([`From Court: ${from}  (${fromTotal} cases)`, ...Array(colCount - 1).fill('')]);
                wsMerges.push({ s: { r: ri, c: 0 }, e: { r: ri, c: colCount - 1 } });
                ri++;

                // Header row: CATEGORY | ...toCourts | Total
                wsRows.push(['CATEGORY \\ TO COURT', ...toCourts, 'Total']);
                ri++;

                // Data rows
                cats.forEach(cat => {
                    let rowTotal = 0;
                    const row = [cat];
                    toCourts.forEach(to => {
                        const count = data[cat]?.[to] || 0;
                        row.push(count > 0 ? count : '—');
                        rowTotal += count;
                    });
                    row.push(rowTotal);
                    wsRows.push(row);
                    ri++;
                });

                // Total footer row
                const footRow = ['Total'];
                toCourts.forEach(to =>
                    footRow.push(cats.reduce((s, cat) => s + (data[cat]?.[to] || 0), 0))
                );
                footRow.push(fromTotal);
                wsRows.push(footRow);
                ri++;

                // Blank separator
                wsRows.push([]); ri++;
            });

            const wsFrom = XLSX.utils.aoa_to_sheet(wsRows);
            wsFrom['!merges'] = wsMerges;
            // Dynamic column widths: category col wide, others medium
            wsFrom['!cols'] = [{ wch: 30 }, ...Array(20).fill({ wch: 12 })];
            XLSX.utils.book_append_sheet(wb, wsFrom, 'Transfer From Summary');
        }
    }

    XLSX.writeFile(wb, 'CasesReport_Formatted.xlsx');
};