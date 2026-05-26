import React, { useState, useRef } from 'react';
import api from '../services/api';
import { 
  FileSpreadsheet, 
  Archive, 
  UploadCloud, 
  CheckCircle, 
  AlertTriangle, 
  Trash2, 
  Loader2, 
  RefreshCw, 
  TrendingUp, 
  ListChecks, 
  ShieldAlert, 
  ArrowRight
} from 'lucide-react';

const BulkImport = () => {
  const [excelFile, setExcelFile] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const excelInputRef = useRef(null);
  const zipInputRef = useRef(null);

  // Simple CSV parser for client-side preview
  const parseCSV = (text) => {
    try {
      const lines = text.split('\n');
      if (lines.length === 0) return;

      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const parsed = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const columns = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const rowData = {};
        
        headers.forEach((header, index) => {
          rowData[header] = columns[index] || '';
        });
        parsed.push(rowData);
      }
      
      // Standardize properties
      const formatted = parsed.map((row) => {
        const normalized = {
          name: row['Student Name'] || row['Name'] || '',
          usn: (row['USN'] || row['Roll Number'] || row['Roll'] || '').toUpperCase(),
          dept: row['Department'] || row['Dept'] || '',
          semester: row['Semester'] || row['Sem'] || '',
          section: row['Section'] || row['Sec'] || 'A',
          photo: row['Photo'] || row['Passport Photo'] || row['Photo Name'] || row['Filename'] || row['Image'] || row['Passport Photo filename/path'] || ''
        };
        return normalized;
      });

      setPreviewRows(formatted.filter(r => r.name || r.usn));
    } catch (e) {
      console.error('Failed to parse preview CSV:', e);
    }
  };

  const handleExcelChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setExcelFile(file);
    setResults(null);
    setErrorMsg('');

    // If it's a CSV, parse it locally for live previewing
    if (file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        parseCSV(event.target.result);
      };
      reader.readAsText(file);
    } else {
      // Excel files will be previewed as ready for backend parsing
      setPreviewRows([]);
    }
  };

  const handleZipChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setZipFile(file);
    setResults(null);
    setErrorMsg('');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleExcelDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      excelInputRef.current.files = e.dataTransfer.files;
      handleExcelChange({ target: { files: e.dataTransfer.files } });
    } else {
      setErrorMsg('⚠️ Please upload a valid Excel (.xlsx, .xls) or CSV file');
    }
  };

  const handleZipDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      zipInputRef.current.files = e.dataTransfer.files;
      handleZipChange({ target: { files: e.dataTransfer.files } });
    } else {
      setErrorMsg('⚠️ Please upload a valid ZIP archive (.zip)');
    }
  };

  const removeExcel = () => {
    setExcelFile(null);
    setPreviewRows([]);
    excelInputRef.current.value = '';
  };

  const removeZip = () => {
    setZipFile(null);
    zipInputRef.current.value = '';
  };

  const triggerImport = async () => {
    if (!excelFile || !zipFile) {
      setErrorMsg('⚠️ Both the spreadsheet file and photos ZIP archive are required.');
      return;
    }

    setImporting(true);
    setProgress(0);
    setErrorMsg('');
    setSuccessMsg('');
    setResults(null);

    const formData = new FormData();
    formData.append('excel', excelFile);
    formData.append('zip', zipFile);

    try {
      const res = await api.students.bulkImport(formData, (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        // Cap upload progress at 95% until server completes facial embeddings calculations
        setProgress(Math.min(percentCompleted, 95));
      });

      if (res.data.success) {
        setProgress(100);
        setResults(res.data);
        setSuccessMsg(`🎉 Bulk import completed successfully! Enrolled ${res.data.summary.successCount} students.`);
        removeExcel();
        removeZip();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || '❌ Import process failed. Check file structures and verify MongoDB connections.');
    } finally {
      setImporting(false);
    }
  };

  // Find duplicates in client-side preview list to notify before import
  const getSpreadsheetDuplicates = () => {
    const usns = previewRows.map(r => r.usn);
    return previewRows.filter(r => usns.indexOf(r.usn) !== usns.lastIndexOf(r.usn));
  };

  const spreadsheetDuplicates = getSpreadsheetDuplicates();

  return (
    <div className="flex-1 p-6 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header Info */}
      <div className="border-b border-slate-200/50 dark:border-slate-800/50 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white flex items-center space-x-3">
          <FileSpreadsheet className="w-8 h-8 text-cyber-blue" />
          <span>Bulk Student Import Terminal</span>
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Automate enrollment for 1000+ students. Upload an Excel dataset and a ZIP archive of passport photos. The AI extracts face embeddings automatically.
        </p>
      </div>

      {/* Upload Dropzones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Excel Dropzone */}
        <div 
          onDragOver={handleDragOver}
          onDrop={handleExcelDrop}
          className={`cyber-card p-6 flex flex-col items-center justify-center border-2 border-dashed aspect-[16/9] transition-all duration-300 ${
            excelFile 
              ? 'border-emerald-500/40 bg-emerald-500/5 shadow-glow-green/5' 
              : 'border-slate-300 dark:border-cyber-border hover:border-cyber-blue/50 dark:hover:bg-slate-900/10'
          }`}
        >
          <input 
            type="file" 
            ref={excelInputRef}
            onChange={handleExcelChange}
            accept=".csv, .xlsx, .xls"
            className="hidden" 
          />
          
          {excelFile ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-450 border border-emerald-500/25">
                <FileSpreadsheet className="w-10 h-10 animate-bounce" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-xs">{excelFile.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{(excelFile.size / 1024).toFixed(1)} KB • READY</p>
              </div>
              <button 
                onClick={removeExcel}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold border border-rose-500/25 transition-all"
              >
                Remove File
              </button>
            </div>
          ) : (
            <div 
              onClick={() => excelInputRef.current.click()}
              className="flex flex-col items-center text-center cursor-pointer space-y-3 p-4 group"
            >
              <div className="p-4 rounded-full bg-cyber-blue/5 border border-cyber-blue/20 text-cyber-blue group-hover:scale-115 transition-transform duration-300">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-800 dark:text-white">Upload Spreadsheet</p>
                <p className="text-xs text-slate-400 mt-1">Drag & drop or click to choose Excel (.xlsx) or CSV</p>
              </div>
            </div>
          )}
        </div>

        {/* ZIP Dropzone */}
        <div 
          onDragOver={handleDragOver}
          onDrop={handleZipDrop}
          className={`cyber-card p-6 flex flex-col items-center justify-center border-2 border-dashed aspect-[16/9] transition-all duration-300 ${
            zipFile 
              ? 'border-emerald-500/40 bg-emerald-500/5 shadow-glow-green/5' 
              : 'border-slate-300 dark:border-cyber-border hover:border-cyber-blue/50 dark:hover:bg-slate-900/10'
          }`}
        >
          <input 
            type="file" 
            ref={zipInputRef}
            onChange={handleZipChange}
            accept=".zip"
            className="hidden" 
          />
          
          {zipFile ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-450 border border-emerald-500/25">
                <Archive className="w-10 h-10 animate-bounce" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-xs">{zipFile.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{(zipFile.size / (1024 * 1024)).toFixed(1)} MB • READY</p>
              </div>
              <button 
                onClick={removeZip}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold border border-rose-500/25 transition-all"
              >
                Remove Archive
              </button>
            </div>
          ) : (
            <div 
              onClick={() => zipInputRef.current.click()}
              className="flex flex-col items-center text-center cursor-pointer space-y-3 p-4 group"
            >
              <div className="p-4 rounded-full bg-cyber-blue/5 border border-cyber-blue/20 text-cyber-blue group-hover:scale-115 transition-transform duration-300">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-800 dark:text-white">Upload Photos ZIP</p>
                <p className="text-xs text-slate-400 mt-1">Drag & drop or click to choose ZIP containing JPEGs/PNGs</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Status messages */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-cyber-pink/10 border border-cyber-pink/20 text-cyber-pink text-xs font-semibold flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Live Upload Progress Indicator */}
      {importing && (
        <div className="cyber-card p-6 space-y-4">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-slate-400">
            <span className="flex items-center space-x-2 text-cyber-blue">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>AI Extraction Pipeline Running...</span>
            </span>
            <span className="text-cyber-blue font-extrabold">{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-800/50">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-cyber-blue to-cyan-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 italic">
            * Backend parses Excel records, extracts photos from ZIP, runs neural landmark detection, computes 128-float face embeddings, and maps databases. This may take up to 2-3 minutes for large batches. Keep window active.
          </p>
        </div>
      )}

      {/* Import Action Trigger */}
      {excelFile && zipFile && !importing && (
        <div className="flex justify-center">
          <button
            onClick={triggerImport}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-cyber-blue to-cyan-500 hover:from-cyan-500 hover:to-cyber-blue text-white font-bold tracking-wider uppercase text-xs shadow-lg hover:shadow-glow/30 flex items-center space-x-2 transition-all duration-200 scale-102 hover:scale-105 active:scale-95"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Process Bulk Registration</span>
          </button>
        </div>
      )}

      {/* Live Spreadsheet Preview (Only when CSV parsed client-side) */}
      {previewRows.length > 0 && !results && (
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-3">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center space-x-2">
              <ListChecks className="w-5 h-5 text-cyber-blue" />
              <span>Spreadsheet Dataset Preview ({previewRows.length} Rows)</span>
            </h3>
            {spreadsheetDuplicates.length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-cyber-pink/15 text-cyber-pink text-[10px] font-bold uppercase tracking-wider border border-cyber-pink/25 flex items-center space-x-1 animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Detected {spreadsheetDuplicates.length} Local Duplicate USNs</span>
              </span>
            )}
          </div>
          <div className="cyber-card overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 sticky top-0 z-10">
                    <th className="py-3 px-6">Name</th>
                    <th className="py-3 px-6">USN</th>
                    <th className="py-3 px-6">Dept</th>
                    <th className="py-3 px-6">Sem</th>
                    <th className="py-3 px-6">Sec</th>
                    <th className="py-3 px-6">Target Photo Filename</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-350">
                  {previewRows.map((row, idx) => {
                    const isDup = spreadsheetDuplicates.some(d => d.usn === row.usn);
                    return (
                      <tr 
                        key={idx} 
                        className={`hover:bg-slate-100/30 dark:hover:bg-slate-800/10 transition-all ${
                          isDup ? 'bg-cyber-pink/5 dark:bg-cyber-pink/5 text-cyber-pink/80' : ''
                        }`}
                      >
                        <td className="py-3 px-6 font-bold truncate max-w-xs">{row.name}</td>
                        <td className="py-3 px-6 uppercase font-semibold">
                          <span className="flex items-center space-x-1.5">
                            {isDup && <AlertTriangle className="w-3.5 h-3.5 text-cyber-pink animate-pulse" />}
                            <span>{row.usn}</span>
                          </span>
                        </td>
                        <td className="py-3 px-6 uppercase">{row.dept}</td>
                        <td className="py-3 px-6">Sem {row.semester}</td>
                        <td className="py-3 px-6 font-bold">{row.section}</td>
                        <td className="py-3 px-6 text-slate-400 italic truncate max-w-xs">{row.photo || `${row.usn}.jpg`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Results & Failures Summary Panel */}
      {results && (
        <div className="space-y-8 animate-fadeIn">
          {/* Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <div className="cyber-card p-6 bg-gradient-to-br from-cyber-blue/15 to-transparent border border-cyber-blue/30 text-cyber-blue">
              <span className="text-[10px] font-bold uppercase tracking-widest block opacity-70">Processed Rows</span>
              <h3 className="text-3xl font-extrabold mt-1">{results.summary.totalRows}</h3>
            </div>
            <div className="cyber-card p-6 bg-gradient-to-br from-emerald-500/15 to-transparent border border-emerald-500/30 text-emerald-400">
              <span className="text-[10px] font-bold uppercase tracking-widest block opacity-70">Successful Enrolls</span>
              <h3 className="text-3xl font-extrabold mt-1">{results.summary.successCount}</h3>
            </div>
            <div className="cyber-card p-6 bg-gradient-to-br from-cyber-pink/15 to-transparent border border-cyber-pink/30 text-cyber-pink">
              <span className="text-[10px] font-bold uppercase tracking-widest block opacity-70">Failed Records</span>
              <h3 className="text-3xl font-extrabold mt-1">{results.summary.failedCount}</h3>
            </div>
            <div className="cyber-card p-6 bg-gradient-to-br from-amber-500/15 to-transparent border border-amber-500/30 text-amber-500">
              <span className="text-[10px] font-bold uppercase tracking-widest block opacity-70">Database Duplicates</span>
              <h3 className="text-3xl font-extrabold mt-1">{results.summary.duplicatesCount}</h3>
            </div>
          </div>

          {/* Failed Records Detailed Grid */}
          {results.data.failures.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-200/50 dark:border-slate-800/50 pb-3">
                <ShieldAlert className="w-5 h-5 text-cyber-pink glow-text-pink" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wider">Failed Records Audit Ledger</h3>
              </div>
              <div className="cyber-card overflow-hidden border border-cyber-pink/20">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-cyber-pink/5 border-b border-cyber-pink/20 text-[10px] font-bold uppercase tracking-wider text-cyber-pink">
                        <th className="py-3 px-6">Row #</th>
                        <th className="py-3 px-6">USN</th>
                        <th className="py-3 px-6">Name</th>
                        <th className="py-3 px-6">Audit Failure Analysis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-350">
                      {results.data.failures.map((fail, idx) => (
                        <tr key={idx} className="hover:bg-cyber-pink/[0.02]">
                          <td className="py-3 px-6 font-bold">{fail.row}</td>
                          <td className="py-3 px-6 uppercase font-semibold">{fail.usn}</td>
                          <td className="py-3 px-6 truncate max-w-xs">{fail.name}</td>
                          <td className="py-3 px-6 font-medium text-cyber-pink">{fail.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BulkImport;
