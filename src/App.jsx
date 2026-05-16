// src/App.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Settings, FileDown, FileSpreadsheet, File, ChevronDown, ChevronUp, Loader2, Trash2, HelpCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

import { generateDocxReport } from './utils/docx-generator';
import { generateExcelReport } from './utils/excel-generator';
import { generatePdfReport } from './utils/pdf-generator';

// All three summary tables
import AllSummaries from './Summaries';

const CaseTransferReportApp = () => {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({ caseNo: '', fromCourt: '', toCourt: '', nature: '', side: '' });
  const [showMapping, setShowMapping] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [reportPreviewData, setReportPreviewData] = useState(null);
  const previewRef = useRef(null);

  const requiredColumns = [
    { key: 'caseNo', label: 'Case Number *', options: ['CASE NO', 'Case No.', 'CASE_NO', 'CASES_NO', 'CASES'] },
    { key: 'fromCourt', label: 'From Court (Transfer Report)', options: ['FROM COURT', 'FROM_COURT'] },
    { key: 'toCourt', label: 'To Court (Transfer Report)', options: ['TO COURT', 'TO_COURT'] },
    { key: 'nature', label: 'Nature', options: ['NATURE', 'CASE NATURE'] },
    { key: 'side', label: 'Side', options: ['SIDE'] },
  ];

  const sanitizeHeader = h => String(h || '').trim().toUpperCase().replace(/[^A-Z0-9\s_]/g, '');

  const findHeaderRow = (rows) => {
    const allHeaders = new Set(requiredColumns.flatMap(rc => rc.options).map(sanitizeHeader));
    let best = { score: -1, index: -1 };
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;
      const score = row.filter(cell => allHeaders.has(sanitizeHeader(cell))).length;
      if (score > best.score) best = { score, index: i };
    }
    return best;
  };

  const cleanYear = y => {
    if (!y) return '';
    const m = String(y).match(/(\d{4})/);
    return m ? m[1] : String(y).trim();
  };

  const handleFileUpload = (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setData([]); setColumns([]);
    setReportPreviewData(null);
    setStatus({ type: 'info', message: 'Reading file…' });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rowsAsArray = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        if (!rowsAsArray.length) { setStatus({ type: 'error', message: 'File is empty!' }); return; }

        const headerInfo = findHeaderRow(rowsAsArray);
        if (headerInfo.score < 2) {
          setStatus({ type: 'error', message: 'Could not detect header row. Ensure columns like "CASE NO" exist.' });
          return;
        }
        const headers = rowsAsArray[headerInfo.index];
        const jsonData = rowsAsArray.slice(headerInfo.index + 1)
          .map(row => {
            const obj = {};
            headers.forEach((h, i) => { if (h) obj[String(h).trim()] = row[i]; });
            return obj;
          })
          .filter(obj => Object.values(obj).some(v => v !== null));

        if (!jsonData.length) { setStatus({ type: 'error', message: 'No data rows found.' }); return; }

        const cols = Object.keys(jsonData[0]);
        const autoMapping = {};
        requiredColumns.forEach(({ key, options }) => {
          const sanitized = options.map(sanitizeHeader);
          const found = cols.find(c => sanitized.includes(sanitizeHeader(c)));
          if (found) autoMapping[key] = found;
        });

        setColumns(cols);
        setData(jsonData);
        setColumnMapping(autoMapping);
        setStatus({ type: 'success', message: `${jsonData.length} rows loaded from "${uploadedFile.name}"` });
      } catch (err) {
        setStatus({ type: 'error', message: 'Error reading file: ' + err.message });
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const clearFile = () => {
    setFile(null);
    setData([]);
    setColumns([]);
    setColumnMapping({ caseNo: '', fromCourt: '', toCourt: '', nature: '', side: '' });
    setReportPreviewData(null);
    setStatus({ type: 'info', message: 'File cleared. Upload a new file.' });
  };

  const processData = () =>
    data.map(row => {
      const caseNoRaw = String(row[columnMapping.caseNo] || '');
      const parts = caseNoRaw.split('/');
      const casePrefix = parts[0] || '';
      const caseNo = parts[1] || '';
      const year = cleanYear(parts[2] || '');
      const natureRaw = row[columnMapping.nature] || '';
      const sideRaw = row[columnMapping.side] || '';
      let combinedCategory = '';
      if (casePrefix && natureRaw) combinedCategory = `${casePrefix} - ${natureRaw}`;
      else if (casePrefix) combinedCategory = casePrefix;
      else if (natureRaw) combinedCategory = natureRaw;
      else combinedCategory = '(Unspecified)';
      return {
        category: (casePrefix || '').trim(),
        caseNo: caseNo.trim(),
        year,
        fromCourt: row[columnMapping.fromCourt] || '',
        toCourt: row[columnMapping.toCourt] || '',
        side: sideRaw,
        nature: natureRaw,
        combinedCategory,
      };
    }).filter(i => i.caseNo && i.year);

  const aggregateData = (processed) => {
    const rd = {};
    processed.forEach(item => {
      let consoMain, sideKey, categoryKey;
      if (item.fromCourt && item.toCourt) {
        consoMain = `${item.fromCourt} TO ${item.toCourt}`;
        sideKey = item.side || 'General';
        categoryKey = [item.category, item.nature].filter(Boolean).join('-');
      } else {
        consoMain = [item.nature, item.side].filter(Boolean).join(' & ') || 'Uncategorized Cases';
        sideKey = 'General';
        categoryKey = item.category || 'Default Category';
      }
      if (!rd[consoMain]) rd[consoMain] = {};
      if (!rd[consoMain][sideKey]) rd[consoMain][sideKey] = {};
      if (!rd[consoMain][sideKey][categoryKey]) rd[consoMain][sideKey][categoryKey] = {};
      if (!rd[consoMain][sideKey][categoryKey][item.year])
        rd[consoMain][sideKey][categoryKey][item.year] = { count: 0, cases: [] };
      rd[consoMain][sideKey][categoryKey][item.year].count++;
      rd[consoMain][sideKey][categoryKey][item.year].cases.push(item.caseNo);
    });
    return rd;
  };

  const createTransferSummary = (processed) => {
    const s = {};
    processed.forEach(item => {
      if (item.fromCourt && item.toCourt) {
        if (!s[item.fromCourt]) s[item.fromCourt] = {};
        s[item.fromCourt][item.toCourt] = (s[item.fromCourt][item.toCourt] || 0) + 1;
      }
    });
    return s;
  };

  const createCategorySideSummary = (processed) => {
    const s = {}, categories = new Set(), sides = new Set();
    processed.forEach(item => {
      const cat = item.combinedCategory;
      const si = item.side || '(Unspecified)';
      categories.add(cat); sides.add(si);
      if (!s[cat]) s[cat] = {};
      s[cat][si] = (s[cat][si] || 0) + 1;
    });
    return { summaryData: s, categories: [...categories].sort(), sides: [...sides].sort() };
  };

  const canGenerate = data.length > 0 && columnMapping.caseNo &&
    ((columnMapping.fromCourt && columnMapping.toCourt) || columnMapping.nature || columnMapping.side);

  useEffect(() => {
    if (!canGenerate) { setReportPreviewData(null); return; }
    const processed = processData();
    setReportPreviewData({
      mainReport: aggregateData(processed),
      transferSummary: createTransferSummary(processed),
      categorySideSummary: createCategorySideSummary(processed),
      processedData: processed,
    });
  }, [data, columnMapping]);

  const handleDownload = async (generatorFn, key) => {
    setProcessing(key);
    try {
      const processed = processData();
      await generatorFn(aggregateData(processed), createTransferSummary(processed), processed);
      setStatus({ type: 'success', message: `${key.toUpperCase()} downloaded successfully!` });
    } catch (err) {
      setStatus({ type: 'error', message: `Error generating ${key}: ` + err.message });
    } finally {
      setProcessing(null);
    }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['CASE NO', 'FROM COURT', 'TO COURT', 'NATURE', 'SIDE'],

      ['SC/701/2022', 'PDJ', 'ADJ', 'IPC', 'Criminal'],
      ['SC/702/2022', 'PDJ', 'ADJ', 'IPC', 'Criminal'],
      ['SC/25/2023', 'PDJ', 'ADJ', 'IPC', 'Criminal'],
      ['SC/26/2024', 'PDJ', 'ADJ', 'IPC', 'Criminal'],

      ['RCA/25/2022', 'PDJ', 'ADJ', 'FATEL', 'Civil'],
      ['RCA/26/2022', 'PDJ', 'ADJ', 'FATEL', 'Civil'],
      ['RCA/12/2023', 'PDJ', 'ADJ', 'FATEL', 'Civil'],
      ['RCA/13/2023', 'PDJ', 'ADJ', 'FATEL', 'Civil'],

      ['RCS/133/2022', 'MSD', '3SD', 'OTHER', 'Civil'],
      ['RCS/134/2022', 'MSD', '3SD', 'OTHER', 'Civil'],

      ['SPCS/123/2023', 'MSD', '3SD', 'MONEY', 'Civil'],
      ['SPCS/124/2023', 'MSD', '3SD', 'MONEY', 'Civil'],
      ['SPCS/125/2023', 'MSD', '3SD', 'MONEY', 'Civil'],

      ['CC/112/2024', 'MSD', '3SD', 'IPC', 'Criminal'],
      ['CC/113/2024', 'MSD', '3SD', 'IPC', 'Criminal'],
      ['CC/101/2025', 'MSD', '3SD', 'IPC', 'Criminal'],

      ['CC/151/2024', 'MSD', '2SD', 'Negotiable Instrument', 'Criminal'],
      ['CC/152/2024', 'MSD', '3SD', 'Negotiable Instrument', 'Criminal'],
    ]);

    ws['!cols'] = [
      { wch: 22 },
      { wch: 15 },
      { wch: 15 },
      { wch: 28 },
      { wch: 15 },
    ];

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, 'Sample Data');

    XLSX.writeFile(wb, 'Case_Report_Template.xlsx');
  };

  const getCategoryTotal = (yearsData) =>
    Object.values(yearsData).reduce((sum, y) => sum + y.count, 0);

  const renderTwoColumnTable = (consoData) => {
    const sideKeys = Object.keys(consoData).sort();
    const showSideRow = !(sideKeys.length === 1 && sideKeys[0] === 'General');
    const rows = [];

    sideKeys.forEach(side => {
      const sideData = consoData[side];
      const sideTotal = Object.values(sideData).reduce(
        (sum, catData) => sum + getCategoryTotal(catData), 0
      );
      if (showSideRow) rows.push({ type: 'side', label: `${side} (${sideTotal} cases)`, total: sideTotal });

      Object.keys(sideData).sort().forEach(categoryKey => {
        const yearsData = sideData[categoryKey];
        const categoryTotal = getCategoryTotal(yearsData);
        rows.push({ type: 'category', label: `${categoryKey} (${categoryTotal} cases)` });
        Object.keys(yearsData).sort().forEach(year => {
          const yearData = yearsData[year];
          const caseNumbers = yearData.cases.sort((a, b) => Number(a) - Number(b)).join(', ');
          rows.push({ type: 'data', year: `${year} (${yearData.count})`, cases: caseNumbers });
        });
      });
    });

    return (
      <div className="modern-table-container">
        <table className="modern-data-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Case Numbers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              if (row.type === 'side') return (
                <tr key={`side-${idx}`} className="table-side-header">
                  <td colSpan="2">{row.label}</td>
                </tr>
              );
              if (row.type === 'category') return (
                <tr key={`cat-${idx}`} className="table-category-header">
                  <td colSpan="2">{row.label}</td>
                </tr>
              );
              return (
                <tr key={`data-${idx}`} className="table-data-row">
                  <td className="year-cell">{row.year}</td>
                  <td className="cases-cell">{row.cases}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const dlButtons = [
    { key: 'docx', label: 'Word', ext: '.docx', fn: generateDocxReport, icon: <File size={14} />, bg: '#2b579a' },
    { key: 'excel', label: 'Excel', ext: '.xlsx', fn: generateExcelReport, icon: <FileSpreadsheet size={14} />, bg: '#217346' },
    { key: 'pdf', label: 'PDF', ext: '.pdf', fn: generatePdfReport, icon: <FileText size={14} />, bg: '#c0392b' },
  ];

  const statusBg = { success: '#f0fff4', error: '#fff5f5', warning: '#fffbf0', info: '#f0f6ff' };
  const statusBorder = { success: '#19875430', error: '#dc354530', warning: '#ffc10730', info: '#0d6efd30' };
  const statusIconColor = { success: '#198754', error: '#dc3545', warning: '#e0a800', info: '#0d6efd' };

  return (
    <div className="app-container">
      {/* Header */}
      <div className="app-header">
        <div className="logo-area">
          <FileText size={20} />
          <span>Category Wise Report Generator</span>
        </div>
        <button onClick={handleDownloadTemplate} className="template-btn">
          <FileDown size={13} /> Sample Template
        </button>
      </div>

      {/* Main Content Area */}
      <div className="main-layout">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="upload-area">
            <label className="upload-label">
              <div className={`upload-box ${file ? 'has-file' : ''}`}>
                {file ? (
                  <>
                    <CheckCircle size={28} className="success-icon" />
                    <div className="file-name">{file.name}</div>
                    <div className="change-hint">Click to change</div>
                    <button onClick={(e) => { e.stopPropagation(); clearFile(); }} className="clear-file-btn">
                      <Trash2 size={14} /> Remove
                    </button>
                  </>
                ) : (
                  <>
                    <Upload size={28} className="upload-icon" />
                    <div className="upload-title">Upload Excel File</div>
                    <div className="upload-hint">.xlsx or .xls</div>
                  </>
                )}
                <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
              </div>
            </label>

            {status.message && (
              <div className={`status-message ${status.type}`}>
                {status.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                <span>{status.message}</span>
              </div>
            )}
          </div>

          {data.length > 0 && (
            <div className="mapping-section">
              <button onClick={() => setShowMapping(v => !v)} className="mapping-toggle">
                <span><Settings size={13} /> Column Mapping</span>
                {showMapping ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {showMapping && (
                <div className="mapping-options">
                  {requiredColumns.map(({ key, label }) => (
                    <div key={key} className="mapping-field">
                      <label>{label}</label>
                      <select
                        value={columnMapping[key] || ''}
                        onChange={e => setColumnMapping(prev => ({ ...prev, [key]: e.target.value }))}
                      >
                        <option value="">— Not Selected —</option>
                        {columns.map(col => <option key={col} value={col}>{col}</option>)}
                      </select>
                    </div>
                  ))}
                  <div className="mapping-hint">
                    <HelpCircle size={12} /> Map columns correctly for accurate reports
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="download-section">
            <div className="download-label">
              {canGenerate ? 'Download Report As' : 'Upload a file to download'}
            </div>
            {dlButtons.map(({ key, label, ext, fn, icon, bg }) => (
              <button
                key={key}
                onClick={() => canGenerate && handleDownload(fn, key)}
                disabled={!canGenerate || !!processing}
                className={`download-btn ${!canGenerate ? 'disabled' : ''} ${processing === key ? 'processing' : ''}`}
                style={{ background: !canGenerate ? '#cbd5e0' : processing === key ? '#94a3b8' : bg }}
              >
                {processing === key ? <Loader2 size={14} className="spin" /> : icon}
                <span>{processing === key ? 'Generating…' : label}</span>
                <span className="ext">{ext}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Preview Area */}
        <div ref={previewRef} className="preview-area">
          {!reportPreviewData && (
            <div className="empty-state">
              <Upload size={52} />
              <div className="empty-title">No report yet</div>
              <div className="empty-hint">Upload an Excel file on the left — preview appears here instantly.</div>
            </div>
          )}

          {reportPreviewData && (
            <>
              <div className="report-header">
                <h2>Cases Report</h2>
                <span className="total-cases">{reportPreviewData.processedData.length} total cases</span>
              </div>

              {Object.keys(reportPreviewData.mainReport).sort().map(consoMain => {
                const consoData = reportPreviewData.mainReport[consoMain];
                const totalCases = Object.values(consoData).reduce(
                  (sum, sideData) => sum + Object.values(sideData).reduce(
                    (s2, catData) => s2 + Object.values(catData).reduce((s3, y) => s3 + y.count, 0), 0), 0
                );
                return (
                  <div key={consoMain} className="report-card">
                    <div className="card-header">
                      <span>{consoMain}</span>
                      <span className="card-badge">{totalCases} cases</span>
                    </div>
                    <div className="card-content">
                      {renderTwoColumnTable(consoData)}
                    </div>
                  </div>
                );
              })}

              <AllSummaries reportPreviewData={reportPreviewData} />
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="app-footer">
        Designed & Developed by Parimal Hodar &nbsp;!&nbsp;
        <a href="mailto:parimalhodar.dev@gmail.com">parimalhodar.dev@gmail.com</a>
      </div>

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif;
          background: #f1f5f9;
        }

        .app-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        /* Header */
        .app-header {
          flex-shrink: 0;
          background: linear-gradient(135deg, #0f2b3d 0%, #1a3a4f 100%);
          color: white;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 60px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          z-index: 10;
        }

        .logo-area {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          font-size: 16px;
          letter-spacing: 0.3px;
        }

        .template-btn {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: white;
          padding: 6px 14px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        .template-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        /* Main Layout */
        .main-layout {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        /* Sidebar */
        .sidebar {
          width: 300px;
          min-width: 300px;
          background: white;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.02);
        }

        .upload-area {
          padding: 20px;
        }

        .upload-label {
          display: block;
          cursor: pointer;
        }

        .upload-box {
          border: 2px dashed #cbd5e1;
          border-radius: 16px;
          padding: 24px 16px;
          text-align: center;
          background: #fafcff;
          transition: all 0.25s ease;
        }

        .upload-box:hover {
          border-color: #1e3a5f;
          background: #f1f5f9;
          transform: scale(1.01);
        }

        .upload-box.has-file {
          border-color: #198754;
          background: #f0fff4;
        }

        .upload-icon {
          color: #94a3b8;
          margin-bottom: 8px;
        }

        .success-icon {
          color: #198754;
          margin-bottom: 8px;
        }

        .upload-title {
          font-weight: 600;
          font-size: 14px;
          color: #1e293b;
          margin-top: 8px;
        }

        .upload-hint {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .file-name {
          font-weight: 700;
          font-size: 13px;
          color: #1e3a5f;
          word-break: break-all;
          margin-bottom: 4px;
        }

        .change-hint {
          font-size: 11px;
          color: #6c757d;
          margin-top: 4px;
        }

        .clear-file-btn {
          margin-top: 10px;
          background: #fee2e2;
          border: none;
          border-radius: 20px;
          padding: 4px 10px;
          font-size: 11px;
          color: #dc2626;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
        }

        .clear-file-btn:hover {
          background: #fecaca;
        }

        .upload-box input {
          display: none;
        }

        .status-message {
          margin-top: 12px;
          padding: 8px 12px;
          border-radius: 10px;
          display: flex;
          gap: 8px;
          align-items: flex-start;
          font-size: 12px;
          line-height: 1.4;
        }

        .status-message.success {
          background: #f0fff4;
          border: 1px solid #86efac;
          color: #166534;
        }

        .status-message.error {
          background: #fff5f5;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .status-message.info {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e40af;
        }

        .mapping-section {
          border-top: 1px solid #eef2f6;
          padding: 16px 20px;
        }

        .mapping-toggle {
          width: 100%;
          background: none;
          border: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
          color: #1e3a5f;
          padding: 4px 0;
        }

        .mapping-options {
          margin-top: 16px;
        }

        .mapping-field {
          margin-bottom: 14px;
        }

        .mapping-field label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          color: #5b7a9a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .mapping-field select {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          font-size: 12px;
          background: white;
          color: #1e293b;
          outline: none;
          transition: all 0.2s;
        }

        .mapping-field select:focus {
          border-color: #1e3a5f;
          box-shadow: 0 0 0 2px rgba(30, 58, 95, 0.1);
        }

        .mapping-hint {
          margin-top: 12px;
          font-size: 10px;
          color: #7c8ea0;
          display: flex;
          align-items: center;
          gap: 4px;
          background: #f8fafc;
          padding: 8px;
          border-radius: 8px;
        }

        .download-section {
          border-top: 2px solid #eef2f6;
          padding: 20px;
          margin-top: auto;
          background: #fafcff;
        }

        .download-label {
          font-size: 11px;
          font-weight: 700;
          color: #5b7a9a;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 12px;
        }

        .download-btn {
          width: 100%;
          margin-bottom: 8px;
          padding: 10px 14px;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .download-btn:not(.disabled):hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        }

        .download-btn.disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .download-btn.processing {
          cursor: wait;
        }

        .ext {
          margin-left: auto;
          font-size: 10px;
          opacity: 0.8;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Preview Area */
        .preview-area {
          flex: 1;
          overflow-y: auto;
          padding: 28px 32px;
          background: #f1f5f9;
        }

        .empty-state {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #b9c8e0;
          text-align: center;
        }

        .empty-state svg {
          opacity: 0.4;
          margin-bottom: 16px;
        }

        .empty-title {
          font-size: 18px;
          font-weight: 700;
          color: #8ba3bc;
          margin-bottom: 8px;
        }

        .empty-hint {
          font-size: 13px;
          color: #a6bbd0;
        }

        .report-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .report-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          color: #0f2b3d;
          letter-spacing: -0.3px;
        }

        .total-cases {
          font-size: 13px;
          color: #5b7a9a;
          background: white;
          padding: 4px 12px;
          border-radius: 30px;
          font-weight: 500;
        }

        .report-card {
          margin-bottom: 28px;
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          transition: transform 0.2s, box-shadow 0.2s;
          border: 1px solid #e2edf7;
        }

        .report-card:hover {
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        }

        .card-header {
          background: linear-gradient(135deg, #1e3a5f 0%, #1f4a6e 100%);
          color: white;
          padding: 12px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 700;
          font-size: 14px;
        }

        .card-badge {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 40px;
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .card-content {
          padding: 8px 16px;
          overflow-x: auto;
        }

        /* Modern Data Tables */
        .modern-table-container {
          overflow-x: auto;
        }

        .modern-data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .modern-data-table th {
          background: #f8fafc;
          color: #1e293b;
          font-weight: 700;
          padding: 10px 12px;
          text-align: left;
          border-bottom: 2px solid #e2e8f0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .modern-data-table td {
          padding: 9px 12px;
          border-bottom: 1px solid #f0f2f5;
          vertical-align: top;
        }

        .table-side-header {
          background: #eef2ff;
          font-weight: 700;
          color: #1e3a5f;
        }

        .table-side-header td {
          font-size: 12px;
          padding: 8px 12px;
          background: #eef2ff;
          font-weight: 700;
        }

        .table-category-header {
          background: #f8fafc;
        }

        .table-category-header td {
          font-weight: 600;
          color: #2c3e66;
          padding: 8px 12px;
          border-left: 3px solid #2980b9;
        }

        .table-data-row:hover {
          background: #fafcff;
        }

        .year-cell {
          white-space: nowrap;
          font-weight: 500;
          color: #2c3e50;
        }

        .cases-cell {
          line-height: 1.5;
          color: #334155;
        }

        /* Footer */
        .app-footer {
          flex-shrink: 0;
          text-align: center;
          padding: 12px 20px;
          background: #ffffffdd;
          backdrop-filter: blur(8px);
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #4b5563;
          font-weight: 500;
          letter-spacing: 0.2px;
        }

        .app-footer a {
          color: #1e3a5f;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }

        .app-footer a:hover {
          color: #0f2b3d;
          text-decoration: underline;
        }

        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        ::-webkit-scrollbar-track {
          background: #e2e8f0;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #5b7a9a;
        }
      `}</style>
    </div>
  );
};

export default CaseTransferReportApp;