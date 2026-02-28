// src/utils/excel-generator.js

import * as XLSX from 'xlsx';

export const generateExcelReport = (reportData, transferSummary, processed) => {
    const hasCourtData = processed.some(p => p.fromCourt && p.toCourt);
    const wb = XLSX.utils.book_new();
    const wsData = [];
    const merges = [];
    let rowIndex = 0;

    Object.keys(reportData).sort().forEach(mainGroup => {
        const totalCases = Object.values(reportData[mainGroup]).reduce((sum, years) => sum + Object.values(years).reduce((s, y) => s + y.count, 0), 0);
        wsData.push([`${mainGroup} (${totalCases} cases)`]);
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 2 } });
        rowIndex++;

        Object.keys(reportData[mainGroup]).sort().forEach(subCategory => {
            const subCategoryData = reportData[mainGroup][subCategory];
            const totalSubCases = Object.values(subCategoryData).reduce((s, y) => s + y.count, 0);
            wsData.push([`Sub-Category: ${subCategory} (${totalSubCases} cases)`]);
            merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 2 } });
            rowIndex++;
            wsData.push(['Year', 'Case Numbers']);
            rowIndex++;
            Object.keys(subCategoryData).sort().forEach(year => {
                wsData.push([`${year} (${subCategoryData[year].count})`, subCategoryData[year].cases.sort((a, b) => a - b).join(', ')]);
                rowIndex++;
            });
            wsData.push([]);
            rowIndex++;
        });
    });

    const wsCases = XLSX.utils.aoa_to_sheet(wsData);
    wsCases['!merges'] = merges;
    wsCases['!cols'] = [{ wch: 30 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsCases, 'Cases Report');

    if (hasCourtData) {
        const fromCourts = Object.keys(transferSummary).sort();
        const toCourts = [...new Set(processed.map(p => p.toCourt))].sort();
        const summaryData = [['FROM \\ TO', ...toCourts, 'Total']];
        fromCourts.forEach(from => {
            let rowTotal = 0;
            const row = [from];
            toCourts.forEach(to => {
                const count = transferSummary[from][to] || 0;
                row.push(count);
                rowTotal += count;
            });
            row.push(rowTotal);
            summaryData.push(row);
        });
        const totalRow = ['Total'];
        toCourts.forEach(to => {
            totalRow.push(fromCourts.reduce((sum, from) => sum + (transferSummary[from][to] || 0), 0));
        });
        totalRow.push(processed.filter(p => p.fromCourt && p.toCourt).length);
        summaryData.push(totalRow);
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Transfer Summary');
    }

    XLSX.writeFile(wb, 'CasesReport_Formatted.xlsx');
};