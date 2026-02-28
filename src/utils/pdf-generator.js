// src/utils/pdf-generator.js

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePdfReport = (reportData, transferSummary, processed) => {
    const hasCourtData = processed.some(p => p.fromCourt && p.toCourt);
    const doc = new jsPDF();
    let yPos = 15;
    const pageHeight = doc.internal.pageSize.height;
    const bottomMargin = 20;

    doc.setFontSize(18);
    doc.text('Cases Report', 14, yPos);
    yPos += 10;

    Object.keys(reportData).sort().forEach(mainGroup => {
        const totalCases = Object.values(reportData[mainGroup]).reduce((sum, years) => sum + Object.values(years).reduce((s, y) => s + y.count, 0), 0);
        if (yPos + 30 > pageHeight - bottomMargin) { doc.addPage(); yPos = 15; }
        doc.setFontSize(14);
        doc.text(`${mainGroup} (${totalCases} cases)`, 14, yPos);
        yPos += 8;

        Object.keys(reportData[mainGroup]).sort().forEach(subCategory => {
            const subCategoryData = reportData[mainGroup][subCategory];
            const totalSubCases = Object.values(subCategoryData).reduce((s, y) => s + y.count, 0);
            if (yPos + 25 > pageHeight - bottomMargin) { doc.addPage(); yPos = 15; }
            doc.setFontSize(11);
            doc.text(`Sub-Category: ${subCategory} (${totalSubCases} cases)`, 16, yPos);
            yPos += 2;

            const tableBody = Object.keys(subCategoryData).sort().map(year => {
                return [`${year} (${subCategoryData[year].count})`, subCategoryData[year].cases.sort((a, b) => a - b).join(', ')];
            });

            autoTable(doc, {
                startY: yPos,
                head: [['Year', 'Case Numbers']],
                body: tableBody,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                margin: { left: 14, right: 14 }
            });
            yPos = doc.lastAutoTable.finalY + 10;
        });
    });

    if (hasCourtData) {
        doc.addPage();
        doc.setFontSize(18);
        doc.text('Transfer Summary', 14, 15);
        const fromCourts = Object.keys(transferSummary).sort();
        const toCourts = [...new Set(processed.map(p => p.toCourt))].sort();
        const head = [['FROM \\ TO', ...toCourts, 'Total']];
        const body = fromCourts.map(from => {
            let rowTotal = 0;
            const rowData = [from];
            toCourts.forEach(to => {
                const count = transferSummary[from][to] || 0;
                rowData.push(count > 0 ? count : '-');
                rowTotal += count;
            });
            rowData.push(rowTotal);
            return rowData;
        });
        const foot = [['Total']];
        toCourts.forEach(to => { foot[0].push(fromCourts.reduce((sum, from) => sum + (transferSummary[from][to] || 0), 0)); });
        foot[0].push(processed.filter(p => p.fromCourt && p.toCourt).length);
        autoTable(doc, { startY: 25, head, body, foot, theme: 'grid' });
    }

    doc.save('CasesReport_Formatted.pdf');
};