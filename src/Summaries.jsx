// src/Summaries.jsx
// All summary tables: Transfer Summary, Category & Side Summary, Transfer From Summary

import React from 'react';

/* ─── shared mini-helpers ─────────────────────────────── */
const Th = ({ children, left }) => (
    <th style={{
        padding: '7px 11px',
        textAlign: left ? 'left' : 'center',
        fontWeight: 600,
        fontSize: 11,
        whiteSpace: 'nowrap',
    }}>{children}</th>
);

const Td = ({ children, left, bold, shade }) => (
    <td style={{
        padding: '6px 11px',
        textAlign: left ? 'left' : 'center',
        fontWeight: bold ? 700 : 400,
        background: shade ? '#f8fafc' : undefined,
        fontSize: 12,
    }}>{children}</td>
);

const Empty = () => <span style={{ color: '#d0d8e4' }}>—</span>;

const SectionHeader = ({ title }) => (
    <h2 style={{
        fontSize: 16, fontWeight: 800, color: '#1e3a5f',
        marginBottom: 14, marginTop: 0,
        paddingBottom: 8, borderBottom: '2px solid #dde3ea',
    }}>{title}</h2>
);

const Card = ({ children }) => (
    <div style={{
        background: '#fff', borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        border: '1px solid #dde3ea',
        overflowX: 'auto',
    }}>{children}</div>
);

const THEAD_BG = '#2980b9';
const TFOOT_BG = '#d6eaf8';
const FROM_BG = '#1a5276';   // darker blue for "from-court" sub-headers


/* ═══════════════════════════════════════════════════════
   1. TRANSFER SUMMARY  (from-court × to-court matrix)
══════════════════════════════════════════════════════ */
export const TransferSummary = ({ transferSummary, processedData }) => {
    const hasTransfer = processedData.some(p => p.fromCourt && p.toCourt);
    if (!hasTransfer) return null;

    const toCourts = [...new Set(processedData.map(p => p.toCourt).filter(Boolean))].sort();
    const fromCourts = Object.keys(transferSummary).sort();
    const grandTotal = processedData.filter(p => p.fromCourt && p.toCourt).length;

    return (
        <div style={{ marginBottom: 32 }}>
            <SectionHeader title="Transfer Summary" />
            <Card>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'center' }}>
                    <thead>
                        <tr style={{ background: THEAD_BG, color: '#fff' }}>
                            <Th left>FROM \ TO</Th>
                            {toCourts.map(tc => <Th key={tc}>{tc}</Th>)}
                            <Th>Total</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {fromCourts.map(from => {
                            let rowTotal = 0;
                            return (
                                <tr key={from} style={{ borderBottom: '1px solid #f0f2f5' }}>
                                    <Td left bold shade>{from}</Td>
                                    {toCourts.map(to => {
                                        const count = transferSummary[from]?.[to] || 0;
                                        rowTotal += count;
                                        return <Td key={to}>{count > 0 ? count : <Empty />}</Td>;
                                    })}
                                    <Td bold shade>{rowTotal}</Td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: TFOOT_BG, fontWeight: 700, fontSize: 12 }}>
                            <td style={{ padding: '6px 11px', textAlign: 'left' }}>Total</td>
                            {toCourts.map(to => {
                                const colTotal = fromCourts.reduce((s, f) => s + (transferSummary[f]?.[to] || 0), 0);
                                return <td key={to} style={{ padding: '6px 11px', textAlign: 'center' }}>{colTotal}</td>;
                            })}
                            <td style={{ padding: '6px 11px', textAlign: 'center' }}>{grandTotal}</td>
                        </tr>
                    </tfoot>
                </table>
            </Card>
        </div>
    );
};


/* ═══════════════════════════════════════════════════════
   2. CATEGORY & SIDE SUMMARY  (category × side matrix)
══════════════════════════════════════════════════════ */
export const CategorySideSummary = ({ categorySideSummary, processedData }) => {
    if (!categorySideSummary) return null;
    const { categories, sides, summaryData } = categorySideSummary;

    return (
        <div style={{ marginBottom: 32 }}>
            <SectionHeader title="Category & Side Summary" />
            <Card>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'center' }}>
                    <thead>
                        <tr style={{ background: THEAD_BG, color: '#fff' }}>
                            <Th left>CATEGORY \ SIDE</Th>
                            {sides.map(s => <Th key={s}>{s}</Th>)}
                            <Th>Total</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map(cat => {
                            let rowTotal = 0;
                            return (
                                <tr key={cat} style={{ borderBottom: '1px solid #f0f2f5' }}>
                                    <Td left bold shade>{cat}</Td>
                                    {sides.map(side => {
                                        const count = summaryData[cat]?.[side] || 0;
                                        rowTotal += count;
                                        return <Td key={side}>{count > 0 ? count : <Empty />}</Td>;
                                    })}
                                    <Td bold shade>{rowTotal}</Td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: TFOOT_BG, fontWeight: 700, fontSize: 12 }}>
                            <td style={{ padding: '6px 11px', textAlign: 'left' }}>Total</td>
                            {sides.map(side => {
                                const colTotal = categories.reduce((s, cat) => s + (summaryData[cat]?.[side] || 0), 0);
                                return <td key={side} style={{ padding: '6px 11px', textAlign: 'center' }}>{colTotal}</td>;
                            })}
                            <td style={{ padding: '6px 11px', textAlign: 'center' }}>{processedData.length}</td>
                        </tr>
                    </tfoot>
                </table>
            </Card>
        </div>
    );
};


/* ═══════════════════════════════════════════════════════
   3. TRANSFER FROM SUMMARY
      For EACH "from-court" → one table: CATEGORY × TO-COURTS
══════════════════════════════════════════════════════ */

/**
 * Build the data structure needed for TransferFromSummary.
 * Returns: { [fromCourt]: { categories: string[], toCourts: string[], data: { [cat]: { [toCourt]: number } } } }
 */
export const buildTransferFromSummary = (processedData) => {
    const result = {};

    processedData.forEach(item => {
        if (!item.fromCourt || !item.toCourt) return;
        const from = item.fromCourt;
        const to = item.toCourt;
        const cat = item.combinedCategory || item.category || '(Unspecified)';

        if (!result[from]) result[from] = {};
        if (!result[from][cat]) result[from][cat] = {};
        result[from][cat][to] = (result[from][cat][to] || 0) + 1;
    });

    // Convert to the shape the component needs
    const shaped = {};
    Object.keys(result).sort().forEach(from => {
        const catMap = result[from];
        const cats = Object.keys(catMap).sort();
        const toCourts = [...new Set(cats.flatMap(c => Object.keys(catMap[c])))].sort();
        shaped[from] = { categories: cats, toCourts, data: catMap };
    });
    return shaped;
};

export const TransferFromSummary = ({ processedData }) => {
    const hasTransfer = processedData.some(p => p.fromCourt && p.toCourt);
    if (!hasTransfer) return null;

    const fromSummary = buildTransferFromSummary(processedData);
    const fromCourts = Object.keys(fromSummary).sort();

    if (!fromCourts.length) return null;

    return (
        <div style={{ marginBottom: 32 }}>
            <SectionHeader title="Transfer From Summary (Category × Transfer-To Courts)" />

            {fromCourts.map(from => {
                const { categories, toCourts, data } = fromSummary[from];
                const fromTotal = categories.reduce(
                    (s, cat) => s + toCourts.reduce((s2, to) => s2 + (data[cat]?.[to] || 0), 0), 0
                );

                return (
                    <div key={from} style={{ marginBottom: 20 }}>
                        {/* From-court label */}
                        <div style={{
                            background: FROM_BG, color: '#fff',
                            padding: '7px 14px', borderRadius: '8px 8px 0 0',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>From Court: {from}</span>
                            <span style={{
                                background: 'rgba(255,255,255,0.18)', borderRadius: 20,
                                padding: '2px 10px', fontSize: 11,
                            }}>{fromTotal} cases</span>
                        </div>

                        <Card>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'center' }}>
                                <thead>
                                    <tr style={{ background: THEAD_BG, color: '#fff' }}>
                                        <Th left>CATEGORY \ TO COURT</Th>
                                        {toCourts.map(tc => <Th key={tc}>{tc}</Th>)}
                                        <Th>Total</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categories.map(cat => {
                                        let rowTotal = 0;
                                        return (
                                            <tr key={cat} style={{ borderBottom: '1px solid #f0f2f5' }}>
                                                <Td left bold shade>{cat}</Td>
                                                {toCourts.map(to => {
                                                    const count = data[cat]?.[to] || 0;
                                                    rowTotal += count;
                                                    return <Td key={to}>{count > 0 ? count : <Empty />}</Td>;
                                                })}
                                                <Td bold shade>{rowTotal}</Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: TFOOT_BG, fontWeight: 700, fontSize: 12 }}>
                                        <td style={{ padding: '6px 11px', textAlign: 'left' }}>Total</td>
                                        {toCourts.map(to => {
                                            const colTotal = categories.reduce((s, cat) => s + (data[cat]?.[to] || 0), 0);
                                            return (
                                                <td key={to} style={{ padding: '6px 11px', textAlign: 'center' }}>{colTotal}</td>
                                            );
                                        })}
                                        <td style={{ padding: '6px 11px', textAlign: 'center' }}>{fromTotal}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </Card>
                    </div>
                );
            })}
        </div>
    );
};


/* ═══════════════════════════════════════════════════════
   DEFAULT EXPORT — all 3 summaries together
   Drop <AllSummaries reportPreviewData={reportPreviewData} />
   anywhere you want all three rendered in order.
══════════════════════════════════════════════════════ */
const AllSummaries = ({ reportPreviewData }) => {
    if (!reportPreviewData) return null;
    const { transferSummary, categorySideSummary, processedData } = reportPreviewData;

    return (
        <div>
            <TransferSummary
                transferSummary={transferSummary}
                processedData={processedData}
            />
            <CategorySideSummary
                categorySideSummary={categorySideSummary}
                processedData={processedData}
            />
            <TransferFromSummary
                processedData={processedData}
            />
        </div>
    );
};

export default AllSummaries;