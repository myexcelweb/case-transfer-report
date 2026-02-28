// src/App.jsx
import React, { useState } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle, Settings, ClipboardList, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';

import { generateDocxReport } from './utils/docx-generator';
import { generateExcelReport } from './utils/excel-generator';
import { generatePdfReport } from './utils/pdf-generator';

const CaseTransferReportApp = () => {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({
    caseNo: '', fromCourt: '', toCourt: '', nature: '', side: ''
  });
  const [showMapping, setShowMapping] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [reportPreviewData, setReportPreviewData] = useState(null);
  const [showReportPreview, setShowReportPreview] = useState(false);

  const requiredColumns = [
    { key: 'caseNo', label: 'Case Number *', options: ['CASE NO', 'Case No.', 'CASE_NO', 'CASES_NO', 'CASES'] },
    { key: 'fromCourt', label: 'From Court (for Transfer Report)', options: ['FROM COURT', 'FROM_COURT'] },
    { key: 'toCourt', label: 'To Court (for Transfer Report)', options: ['TO COURT', 'TO_COURT'] },
    { key: 'nature', label: 'Nature (for Nature/Side Report)', options: ['NATURE', 'CASE NATURE'] },
    { key: 'side', label: 'Side (for Nature/Side Report)', options: ['SIDE'] }
  ];

  const sanitizeHeader = (header) => {
    return String(header || '').trim().toUpperCase().replace(/[^A-Z0-9\s_]/g, '');
  };

  const findHeaderRow = (rowsAsArray) => {
    let bestMatch = { score: -1, index: -1 };
    const allPossibleHeaders = new Set(requiredColumns.flatMap(rc => rc.options).map(sanitizeHeader));
    for (let i = 0; i < Math.min(10, rowsAsArray.length); i++) {
      const row = rowsAsArray[i];
      if (!row || row.length < 2) continue;
      let currentScore = 0;
      row.forEach(cell => {
        const sanitizedCell = sanitizeHeader(cell);
        if (sanitizedCell && allPossibleHeaders.has(sanitizedCell)) {
          currentScore++;
        }
      });
      if (currentScore > bestMatch.score) {
        bestMatch = { score: currentScore, index: i };
      }
    }
    return bestMatch;
  };

  const handleFileUpload = (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setData([]);
    setColumns([]);
    setStatus({ type: 'info', message: 'Reading file and detecting header...' });
    setShowReportPreview(false);
    setReportPreviewData(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rowsAsArray = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
        if (rowsAsArray.length === 0) {
          setStatus({ type: 'error', message: 'Excel file is empty!' }); return;
        }
        const headerInfo = findHeaderRow(rowsAsArray);
        if (headerInfo.score < 2) {
          setStatus({ type: 'error', message: 'Could not automatically identify a valid header row. Please ensure column names like "CASE NO" are present.' });
          return;
        }
        const headerRowIndex = headerInfo.index;
        const headers = rowsAsArray[headerRowIndex];
        const dataRows = rowsAsArray.slice(headerRowIndex + 1);
        const jsonData = dataRows.map(row => {
          const rowObject = {};
          headers.forEach((header, index) => {
            if (header) { rowObject[String(header).trim()] = row[index]; }
          });
          return rowObject;
        }).filter(obj => Object.values(obj).some(val => val !== null));
        if (jsonData.length === 0) {
          setStatus({ type: 'error', message: 'No data found below the identified header row.' }); return;
        }
        const cols = Object.keys(jsonData[0]);
        setColumns(cols);
        setData(jsonData);
        const autoMapping = {};
        requiredColumns.forEach(({ key, options }) => {
          const sanitizedOptions = options.map(sanitizeHeader);
          const foundCol = cols.find(col => sanitizedOptions.includes(sanitizeHeader(col)));
          if (foundCol) { autoMapping[key] = foundCol; }
        });
        setColumnMapping(autoMapping);
        setStatus({ type: 'success', message: `File loaded! Header detected on row ${headerRowIndex + 1}. Please check mappings.` });
        setShowMapping(true);
      } catch (error) {
        setStatus({ type: 'error', message: 'Error reading file: ' + error.message });
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const cleanYear = (yearStr) => {
    if (!yearStr) return '';
    const match = String(yearStr).match(/(\d{4})/);
    return match ? match[1] : String(yearStr).trim();
  };

  const processData = () => {
    if (data.length === 0) return [];
    return data.map(row => ({
      category: (String(row[columnMapping.caseNo] || '').split('/')[0] || '').trim(),
      caseNo: (String(row[columnMapping.caseNo] || '').split('/')[1] || '').trim(),
      year: cleanYear(String(row[columnMapping.caseNo] || '').split('/')[2] || ''),
      fromCourt: row[columnMapping.fromCourt] || '',
      toCourt: row[columnMapping.toCourt] || '',
      side: row[columnMapping.side] || '',
      nature: row[columnMapping.nature] || ''
    })).filter(item => item.caseNo && item.year);
  };

  const aggregateData = (processed) => {
    const reportData = {};
    processed.forEach(item => {
      let consoMain = '';
      let conso = '';
      if (item.fromCourt && item.toCourt) {
        consoMain = `${item.fromCourt} TO ${item.toCourt}`;
        const sidePart = item.side ? `(${item.side})` : '';
        const categoryNaturePart = [item.category, item.nature].filter(Boolean).join('-');
        conso = `${consoMain}${sidePart}${categoryNaturePart}`;
      } else {
        consoMain = [item.nature, item.side].filter(Boolean).join(' & ');
        if (!consoMain) consoMain = 'Uncategorized Cases';
        conso = item.category || 'Default Category';
      }
      if (!reportData[consoMain]) reportData[consoMain] = {};
      if (!reportData[consoMain][conso]) reportData[consoMain][conso] = {};
      if (!reportData[consoMain][conso][item.year]) { reportData[consoMain][conso][item.year] = { count: 0, cases: [] }; }
      reportData[consoMain][conso][item.year].count++;
      reportData[consoMain][conso][item.year].cases.push(item.caseNo);
    });
    return reportData;
  };

  const createTransferSummary = (processed) => {
    const summary = {};
    processed.forEach(item => {
      if (item.fromCourt && item.toCourt) {
        if (!summary[item.fromCourt]) summary[item.fromCourt] = {};
        if (!summary[item.fromCourt][item.toCourt]) summary[item.fromCourt][item.toCourt] = 0;
        summary[item.fromCourt][item.toCourt]++;
      }
    });
    return summary;
  };

  const createNatureSideSummary = (processed) => {
    const summary = {};
    const allNatures = new Set();
    const allSides = new Set();
    processed.forEach(item => {
      const nature = item.nature || '(Unspecified)';
      const side = item.side || '(Unspecified)';
      allNatures.add(nature);
      allSides.add(side);
      if (!summary[nature]) summary[nature] = {};
      if (!summary[nature][side]) summary[nature][side] = 0;
      summary[nature][side]++;
    });
    return {
      summaryData: summary,
      natures: [...allNatures].sort(),
      sides: [...allSides].sort()
    };
  };

  const handleGenerateReport = async (generatorFn, format) => {
    setProcessing(true);
    setStatus({ type: 'info', message: `Generating ${format} report...` });
    try {
      const processed = processData();
      const reportData = aggregateData(processed);
      const transferSummary = createTransferSummary(processed);
      await generatorFn(reportData, transferSummary, processed);
      setStatus({ type: 'success', message: `${format} report generated successfully!` });
    } catch (error) {
      console.error(`Error generating ${format}:`, error);
      setStatus({ type: 'error', message: `Error generating ${format}: ` + error.message });
    } finally {
      setProcessing(false);
    }
  };

  const handlePreviewGeneration = () => {
    if (showReportPreview) { setShowReportPreview(false); return; }
    if (!canGenerate) return;
    const processed = processData();
    setReportPreviewData({
      mainReport: aggregateData(processed),
      transferSummary: createTransferSummary(processed),
      natureSideSummary: createNatureSideSummary(processed),
      processedData: processed,
    });
    setShowReportPreview(true);
  };

  // --- UPDATED FUNCTION: Download Sample Template with exact data requested ---
  const handleDownloadTemplate = () => {
    const templateData = [
      ['CASE NO', 'FROM COURT', 'TO COURT', 'NATURE', 'SIDE'],
      ['RCS/123/2023', 'MSD', '3SD', 'OTHER', 'Civil'],
      ['CC/456/2024', '2SD', '2JD', 'IPC', 'Criminal'],
      ['SC/789/2022', 'PDJ', 'ADJ', 'IPC', 'Criminal']
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);

    // Auto-size columns to look neat
    ws['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sample Data');
    XLSX.writeFile(wb, 'Case_Report_Template.xlsx');
  };
  // --------------------------------------------------------------------------

  const canGenerate = data.length > 0 && columnMapping.caseNo &&
    ((columnMapping.fromCourt && columnMapping.toCourt) || columnMapping.nature || columnMapping.side);

  const getStatusAlertClass = () => {
    switch (status.type) {
      case 'success': return 'alert alert-success';
      case 'error': return 'alert alert-danger';
      case 'warning': return 'alert alert-warning';
      default: return 'alert alert-info';
    }
  };

  return (
    <div className="bg-light min-vh-100 p-4">
      <div className="container-xl">
        <div className="card shadow-lg border-0 rounded-4 overflow-hidden">
          <div className="card-header bg-primary text-white p-5">
            <div className="d-flex align-items-center gap-3 mb-2">
              <FileText size={40} /> <h1 className="h3">Category Wise Report Generator</h1>
            </div>
            <p className="mb-0 opacity-75">Upload Excel → Map Columns → Generate Reports</p>
          </div>
          <div className="card-body p-4 p-md-5">
            {status.message && (
              <div className={`d-flex align-items-center gap-3 ${getStatusAlertClass()}`} role="alert">
                {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                <div>{status.message}</div>
              </div>
            )}
            <div className="my-4">
              <label className="d-block">
                <div className="text-center p-5 border border-primary border-3 border-dashed rounded-3 bg-light-subtle" style={{ cursor: 'pointer' }}>
                  <Upload className="mx-auto mb-3 text-primary" size={48} />
                  <span className="fw-semibold text-secondary d-block mb-2">{file ? file.name : 'Click to upload Excel file'}</span>
                  <span className="text-muted small">Supports .xlsx and .xls files</span>
                  <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="d-none" />
                </div>
              </label>
              <div className="text-end mt-2">
                <button
                  onClick={handleDownloadTemplate}
                  className="btn btn-sm btn-link text-decoration-none d-inline-flex align-items-center gap-1"
                >
                  <FileDown size={18} /> Need a template? Download Sample Excel
                </button>
              </div>
            </div>
            {data.length > 0 && (
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h2 className="h5 mb-0 d-flex align-items-center gap-2"><Settings size={22} /> Column Mapping</h2>
                  <button onClick={() => setShowMapping(!showMapping)} className="btn btn-link">{showMapping ? 'Hide' : 'Show'}</button>
                </div>
                {showMapping && (
                  <div className="p-4 bg-light-subtle border rounded-3">
                    <p className="small text-muted mb-3">
                      Map <strong>Case Number</strong> and either the <strong>Court</strong> columns OR the <strong>Nature/Side</strong> columns to enable report generation.
                    </p>
                    {requiredColumns.map(({ key, label }) => (
                      <div className="mb-3" key={key}>
                        <label className="form-label fw-semibold">{label}</label>
                        <select value={columnMapping[key] || ''} onChange={(e) => setColumnMapping({ ...columnMapping, [key]: e.target.value })} className="form-select form-select-lg">
                          <option value="">-- Not Selected --</option>
                          {columns.map(col => (<option key={col} value={col}>{col}</option>))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="d-grid gap-3">
              <button onClick={handlePreviewGeneration} disabled={!canGenerate} className="btn btn-outline-secondary btn-lg w-100 d-flex align-items-center justify-content-center gap-2">
                <ClipboardList size={24} />
                {showReportPreview ? 'Hide Full Report Preview' : 'Generate & Preview Full Report'}
              </button>
              <div className="dropdown">
                <button
                  className="btn btn-primary btn-lg w-100 dropdown-toggle d-flex align-items-center justify-content-center gap-2"
                  type="button" id="dropdownMenuButton" data-bs-toggle="dropdown" aria-expanded="false" disabled={!canGenerate || processing} >
                  <Download size={24} />
                  {processing ? 'Generating...' : 'Download Final Report'}
                </button>
                <ul className="dropdown-menu w-100" aria-labelledby="dropdownMenuButton">
                  <li><button className="dropdown-item" onClick={() => handleGenerateReport(generateDocxReport, 'DOCX')}>As DOCX (.docx)</button></li>
                  <li><button className="dropdown-item" onClick={() => handleGenerateReport(generateExcelReport, 'Excel')}>As Excel (.xlsx)</button></li>
                  <li><button className="dropdown-item" onClick={() => handleGenerateReport(generatePdfReport, 'PDF')}>As PDF (.pdf)</button></li>
                </ul>
              </div>
            </div>
            {showReportPreview && reportPreviewData && (
              <div className="mt-5 p-4 border rounded-3 bg-white">
                <h2 className="mb-4">Cases Report Preview</h2>
                {Object.keys(reportPreviewData.mainReport).sort().map(consoMain => {
                  const consoData = reportPreviewData.mainReport[consoMain];
                  const totalCases = Object.values(consoData).reduce((sum, years) => sum + Object.values(years).reduce((s, y) => s + y.count, 0), 0);
                  return (
                    <div key={consoMain} className="mb-5">
                      <h4 className="bg-light p-3 rounded-top border-bottom">{consoMain} <span className="badge bg-secondary">{totalCases} cases</span></h4>
                      <div className="p-3 border border-top-0 rounded-bottom">
                        {Object.keys(consoData).sort().map(conso => {
                          const yearsData = consoData[conso];
                          const totalConsoCases = Object.values(yearsData).reduce((s, y) => s + y.count, 0);
                          return (
                            <div key={conso} className="mb-4">
                              <p><strong>Sub-Category:</strong> {conso} ({totalConsoCases} cases)</p>
                              <table className="table table-bordered table-sm small">
                                <thead className="table-light"><tr><th>Year</th><th>Case Numbers</th></tr></thead>
                                <tbody>{Object.keys(yearsData).sort().map(year => (
                                  <tr key={year}>
                                    <td style={{ width: '20%' }}><strong>{year}</strong> ({yearsData[year].count})</td>
                                    <td>{yearsData[year].cases.sort((a, b) => a - b).join(', ')}</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {reportPreviewData.processedData.some(p => p.fromCourt && p.toCourt) && (
                  <>
                    <h2 className="mb-4 mt-5">Transfer Summary Preview</h2>
                    <div className="table-responsive">
                      <table className="table table-bordered text-center">
                        <thead className="table-light">
                          <tr>
                            <th>FROM \ TO</th>
                            {[...new Set(reportPreviewData.processedData.map(p => p.toCourt))].sort().map(tc => <th key={tc}>{tc}</th>)}
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(reportPreviewData.transferSummary).sort().map(from => {
                            let rowTotal = 0;
                            const toCourts = [...new Set(reportPreviewData.processedData.map(p => p.toCourt))].sort();
                            return (
                              <tr key={from}>
                                <th className="table-light text-start">{from}</th>
                                {toCourts.map(to => {
                                  const count = reportPreviewData.transferSummary[from][to] || 0;
                                  rowTotal += count;
                                  return <td key={`${from}-${to}`}>{count > 0 ? count : '-'}</td>;
                                })}
                                <th className="table-light">{rowTotal}</th>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="table-light">
                          <tr>
                            <th>Total</th>
                            {[...new Set(reportPreviewData.processedData.map(p => p.toCourt))].sort().map(to => {
                              const colTotal = Object.keys(reportPreviewData.transferSummary).reduce((sum, from) => sum + (reportPreviewData.transferSummary[from][to] || 0), 0);
                              return <th key={`total-${to}`}>{colTotal}</th>;
                            })}
                            <th>{reportPreviewData.processedData.filter(p => p.fromCourt && p.toCourt).length}</th>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
                {reportPreviewData.processedData.some(p => p.nature || p.side) && (
                  <>
                    <h2 className="mb-4 mt-5">Nature & Side Summary Preview</h2>
                    <div className="table-responsive">
                      <table className="table table-bordered text-center">
                        <thead className="table-light">
                          <tr>
                            <th>NATURE \ SIDE</th>
                            {reportPreviewData.natureSideSummary.sides.map(side => <th key={side}>{side}</th>)}
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportPreviewData.natureSideSummary.natures.map(nature => {
                            let rowTotal = 0;
                            return (
                              <tr key={nature}>
                                <th className="table-light text-start">{nature}</th>
                                {reportPreviewData.natureSideSummary.sides.map(side => {
                                  const count = (reportPreviewData.natureSideSummary.summaryData[nature] && reportPreviewData.natureSideSummary.summaryData[nature][side]) || 0;
                                  rowTotal += count;
                                  return <td key={`${nature}-${side}`}>{count > 0 ? count : '-'}</td>;
                                })}
                                <th className="table-light">{rowTotal}</th>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="table-light">
                          <tr>
                            <th>Total</th>
                            {reportPreviewData.natureSideSummary.sides.map(side => {
                              const colTotal = reportPreviewData.natureSideSummary.natures.reduce((sum, nature) => {
                                return sum + ((reportPreviewData.natureSideSummary.summaryData[nature] && reportPreviewData.natureSideSummary.summaryData[nature][side]) || 0);
                              }, 0);
                              return <th key={`total-${side}`}>{colTotal}</th>;
                            })}
                            <th>{reportPreviewData.processedData.length}</th>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <footer className="text-center mt-5 text-secondary"><p className="small">Designed & Developed by Parimal Hodar | parimalhodar.dev@gmail.com</p></footer>
      </div>
    </div>
  );
};

export default CaseTransferReportApp;