import React, { useState, useEffect } from 'react';
import {
  FileQuestion,
  FileWarning,
  Trash2,
  FolderInput,
  Scan,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
  FileText,
  Database,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Wand2,
  Check,
  FolderArchive,
  X,
  ExternalLink,
  Info,
  Maximize2
} from 'lucide-react';
import { OrphanedFileItem, OrphanedReason, OrphanedScanResult, DatasetFolder } from '../types/training';

interface OrphanedFilesManagerProps {
  folders: DatasetFolder[];
  cachePath: string;
  onRescanDataset?: () => void;
  onOpenBrowser?: (field: string, mode?: 'folder' | 'file') => void;
}

export const OrphanedFilesManager: React.FC<OrphanedFilesManagerProps> = ({
  folders,
  cachePath,
  onRescanDataset,
  onOpenBrowser
}) => {
  const [scanResult, setScanResult] = useState<OrphanedScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterReason, setFilterReason] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quarantinePath, setQuarantinePath] = useState('./dataset/quarantine');
  const [showQuarantineModal, setShowQuarantineModal] = useState(false);
  const [inspectItem, setInspectItem] = useState<OrphanedFileItem | null>(null);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Scan orphaned files on mount or folder changes
  useEffect(() => {
    handleScanOrphaned();
  }, [folders.length, cachePath]);

  const handleScanOrphaned = async () => {
    setIsScanning(true);
    setNotificationMsg(null);
    try {
      const activeFolders = folders.filter(f => f.enabled);
      const res = await fetch('/api/datasets/orphaned/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folders: activeFolders,
          cache_manifest_path: cachePath.replace('.pt', '_manifest.json')
        })
      });
      const data: OrphanedScanResult = await res.json();
      setScanResult(data);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to scan orphaned files:', err);
      setNotificationMsg({ type: 'error', text: 'Failed to scan dataset directory for orphaned files.' });
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleSelectAll = (filteredItems: OrphanedFileItem[]) => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Delete selected files
  const handleDeleteSelected = async (pathsToDelete?: string[]) => {
    const paths = pathsToDelete || (scanResult?.items || [])
      .filter(i => selectedIds.has(i.id))
      .map(i => i.path);

    if (!paths || paths.length === 0) return;

    if (!window.confirm(`Are you sure you want to permanently remove ${paths.length} file(s) from disk? This cannot be undone.`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/datasets/orphaned/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths })
      });
      const data = await res.json();
      setNotificationMsg({ type: 'success', text: data.message || `Deleted ${data.deleted_count} orphaned files.` });
      
      // Rescan both orphaned list and general dataset
      await handleScanOrphaned();
      if (onRescanDataset) onRescanDataset();
    } catch (err) {
      console.error('Error deleting files:', err);
      setNotificationMsg({ type: 'error', text: 'Error encountered while removing files from disk.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Move files to Quarantine directory
  const handleMoveToQuarantine = async (pathsToMove?: string[], destinationDir?: string) => {
    const paths = pathsToMove || (scanResult?.items || [])
      .filter(i => selectedIds.has(i.id))
      .map(i => i.path);

    if (!paths || paths.length === 0) return;

    const dest = destinationDir || quarantinePath;
    setActionLoading(true);
    try {
      const res = await fetch('/api/datasets/orphaned/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paths,
          target_dir: dest
        })
      });
      const data = await res.json();
      setNotificationMsg({
        type: 'success',
        text: `Relocated ${data.moved_count} file(s) to quarantine folder: ${data.target_dir}`
      });
      setShowQuarantineModal(false);

      // Refresh
      await handleScanOrphaned();
      if (onRescanDataset) onRescanDataset();
    } catch (err) {
      console.error('Error moving files:', err);
      setNotificationMsg({ type: 'error', text: 'Failed to move files to quarantine folder.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Quick autofill missing captions for all uncaptioned items
  const handleAutofillMissingCaptions = async (folderPaths?: string[]) => {
    setActionLoading(true);
    try {
      const targetFolders = folderPaths || folders.map(f => f.path);
      const res = await fetch('/api/datasets/autofill-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_paths: targetFolders })
      });
      const data = await res.json();
      setNotificationMsg({
        type: 'success',
        text: `Created ${data.created_caption_files} missing .txt prompt files! Images are now paired for training.`
      });

      await handleScanOrphaned();
      if (onRescanDataset) onRescanDataset();
    } catch (err) {
      console.error('Failed to autofill captions:', err);
      setNotificationMsg({ type: 'error', text: 'Error generating captions.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter and search items
  const filteredItems = (scanResult?.items || []).filter(item => {
    if (filterReason !== 'all' && item.reason !== filterReason) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.folder.toLowerCase().includes(q) ||
        item.reason_label.toLowerCase().includes(q) ||
        item.format.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getReasonBadge = (reason: OrphanedReason) => {
    switch (reason) {
      case 'missing_caption':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <FileText className="w-3 h-3 text-amber-400" />
            Missing Caption (.txt)
          </span>
        );
      case 'uncached':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950/70 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
            <Database className="w-3 h-3 text-indigo-400" />
            Uncached (NotIn DB)
          </span>
        );
      case 'missing_image':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
            <ImageIcon className="w-3 h-3 text-cyan-400" />
            Orphaned Caption (No Image)
          </span>
        );
      case 'dangling_cache':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950/70 text-purple-300 border border-purple-500/30 flex items-center gap-1">
            <Layers className="w-3 h-3 text-purple-400" />
            Dangling Cache Tensor
          </span>
        );
      case 'zero_byte':
      case 'corrupt_format':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/70 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            Zero-Byte / Corrupt
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
            Excluded
          </span>
        );
    }
  };

  return (
    <div id="orphaned-files-manager-section" className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
      {/* Header & Overview */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
              Orphaned & Excluded Files Inspector
            </h3>
            <span className="bg-amber-950/50 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded border border-amber-500/30">
              Training Loop Guard
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Compares dataset folder files against the active cache database (<span className="font-mono text-neutral-300">{scanResult?.active_cache_database_path || cachePath}</span>) to detect uncaptioned images, dangling tensors, or uncached files missing from the training loop.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleScanOrphaned}
            disabled={isScanning || actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 shadow transition-colors disabled:opacity-50"
          >
            <Scan className={`w-3.5 h-3.5 text-indigo-400 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning Folders vs Cache...' : 'Rescan Orphaned Files'}</span>
          </button>

          {scanResult && scanResult.missing_caption_count > 0 && (
            <button
              type="button"
              onClick={() => handleAutofillMissingCaptions()}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors disabled:opacity-50"
              title="Generate .txt caption prompt files for all uncaptioned images"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Autofill Captions ({scanResult.missing_caption_count})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowQuarantineModal(true)}
            disabled={selectedIds.size === 0 || actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 disabled:opacity-40 transition-colors"
          >
            <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
            <span>Move Selected ({selectedIds.size}) to Quarantine...</span>
          </button>

          <button
            type="button"
            onClick={() => handleDeleteSelected()}
            disabled={selectedIds.size === 0 || actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 disabled:opacity-40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete Selected ({selectedIds.size})</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notificationMsg && (
        <div
          className={`p-3 rounded-lg flex items-center justify-between text-xs transition-all ${
            notificationMsg.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-200'
              : 'bg-rose-950/40 border border-rose-500/30 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notificationMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notificationMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotificationMsg(null)}
            className="text-neutral-400 hover:text-white text-xs px-2 py-0.5 rounded bg-neutral-800/60"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div 
          onClick={() => setFilterReason('all')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            filterReason === 'all' ? 'bg-neutral-800/90 border-indigo-500 shadow-sm' : 'bg-neutral-950 border-neutral-800/80 hover:border-neutral-700'
          }`}
        >
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">Total Excluded</span>
          <span className="text-lg font-mono font-bold text-neutral-100 mt-0.5 block">
            {scanResult?.total_orphaned ?? 0}
          </span>
          <span className="text-[10px] font-mono text-neutral-500">{scanResult?.total_orphaned_size_mb ?? 0} MB footprint</span>
        </div>

        <div 
          onClick={() => setFilterReason('missing_caption')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            filterReason === 'missing_caption' ? 'bg-amber-950/40 border-amber-500' : 'bg-neutral-950 border-neutral-800/80 hover:border-neutral-700'
          }`}
        >
          <span className="text-[10px] text-amber-400 uppercase tracking-wider block font-semibold">Missing Caption</span>
          <span className="text-lg font-mono font-bold text-amber-300 mt-0.5 block">
            {scanResult?.missing_caption_count ?? 0}
          </span>
          <span className="text-[10px] text-amber-500/80">No .txt prompt pair</span>
        </div>

        <div 
          onClick={() => setFilterReason('uncached')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            filterReason === 'uncached' ? 'bg-indigo-950/40 border-indigo-500' : 'bg-neutral-950 border-neutral-800/80 hover:border-neutral-700'
          }`}
        >
          <span className="text-[10px] text-indigo-400 uppercase tracking-wider block font-semibold">Uncached in DB</span>
          <span className="text-lg font-mono font-bold text-indigo-300 mt-0.5 block">
            {scanResult?.uncached_count ?? 0}
          </span>
          <span className="text-[10px] text-indigo-500/80">Not in latents cache</span>
        </div>

        <div 
          onClick={() => setFilterReason('missing_image')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            filterReason === 'missing_image' ? 'bg-cyan-950/40 border-cyan-500' : 'bg-neutral-950 border-neutral-800/80 hover:border-neutral-700'
          }`}
        >
          <span className="text-[10px] text-cyan-400 uppercase tracking-wider block font-semibold">Orphan Captions</span>
          <span className="text-lg font-mono font-bold text-cyan-300 mt-0.5 block">
            {scanResult?.missing_image_count ?? 0}
          </span>
          <span className="text-[10px] text-cyan-500/80">Missing source image</span>
        </div>

        <div 
          onClick={() => setFilterReason('dangling_cache')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            filterReason === 'dangling_cache' ? 'bg-purple-950/40 border-purple-500' : 'bg-neutral-950 border-neutral-800/80 hover:border-neutral-700'
          }`}
        >
          <span className="text-[10px] text-purple-400 uppercase tracking-wider block font-semibold">Dangling Latents</span>
          <span className="text-lg font-mono font-bold text-purple-300 mt-0.5 block">
            {scanResult?.dangling_cache_count ?? 0}
          </span>
          <span className="text-[10px] text-purple-500/80">Deleted source images</span>
        </div>

        <div 
          onClick={() => setFilterReason('zero_byte')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            filterReason === 'zero_byte' ? 'bg-rose-950/40 border-rose-500' : 'bg-neutral-950 border-neutral-800/80 hover:border-neutral-700'
          }`}
        >
          <span className="text-[10px] text-rose-400 uppercase tracking-wider block font-semibold">Corrupt / Empty</span>
          <span className="text-lg font-mono font-bold text-rose-300 mt-0.5 block">
            {scanResult?.corrupted_count ?? 0}
          </span>
          <span className="text-[10px] text-rose-500/80">0-byte broken headers</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <span className="text-neutral-500 text-xs flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filter Category:
          </span>
          {[
            { key: 'all', label: `All (${scanResult?.total_orphaned ?? 0})` },
            { key: 'missing_caption', label: `Missing Caption (${scanResult?.missing_caption_count ?? 0})` },
            { key: 'uncached', label: `Uncached in DB (${scanResult?.uncached_count ?? 0})` },
            { key: 'missing_image', label: `Orphaned Captions (${scanResult?.missing_image_count ?? 0})` },
            { key: 'dangling_cache', label: `Dangling Latents (${scanResult?.dangling_cache_count ?? 0})` },
            { key: 'zero_byte', label: `Corrupt (${scanResult?.corrupted_count ?? 0})` }
          ].map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterReason(f.key)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                filterReason === f.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-400 border border-neutral-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search Query */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search filename or path..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-neutral-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Files Table */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
        <div className="p-2.5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between text-xs text-neutral-400 font-medium">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
              onChange={() => handleToggleSelectAll(filteredItems)}
              className="rounded border-neutral-700 bg-neutral-800 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
            />
            <span>
              {selectedIds.size > 0 ? (
                <strong className="text-indigo-400">{selectedIds.size} file(s) selected</strong>
              ) : (
                `Select All (${filteredItems.length} showing)`
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
            <span>Active Cache Target: {scanResult?.active_cache_entries_count || 0} paired items</span>
          </div>
        </div>

        {filteredItems.length > 0 ? (
          <div className="divide-y divide-neutral-900 max-h-[460px] overflow-y-auto">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-neutral-900/50 transition-colors ${
                  selectedIds.has(item.id) ? 'bg-indigo-950/20' : ''
                }`}
              >
                {/* Left: Checkbox + Thumbnail + Filename & Path */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => handleToggleSelect(item.id)}
                    className="rounded border-neutral-700 bg-neutral-800 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer shrink-0"
                  />

                  {/* Thumbnail or Icon */}
                  <div className="w-12 h-12 rounded bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center relative">
                    {item.type === 'image' && item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : item.type === 'caption' ? (
                      <FileText className="w-6 h-6 text-cyan-400" />
                    ) : item.type === 'tensor' ? (
                      <Layers className="w-6 h-6 text-purple-400" />
                    ) : (
                      <FileQuestion className="w-6 h-6 text-neutral-500" />
                    )}
                    <span className="absolute bottom-0 right-0 bg-black/80 text-[8px] font-mono text-neutral-300 px-1 py-0.2 rounded-tl">
                      {item.format}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-neutral-200 select-all truncate">
                        {item.name}
                      </span>
                      {getReasonBadge(item.reason)}
                      <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                        {item.size_mb > 0 ? `${item.size_mb} MB` : '0 KB'}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-400 truncate" title={item.reason_description}>
                      {item.reason_description}
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono truncate">
                      <span>Folder: {item.folder}</span>
                      {item.last_modified && <span>· Modified: {new Date(item.last_modified).toLocaleTimeString()}</span>}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  {item.reason === 'missing_caption' && (
                    <button
                      type="button"
                      onClick={() => handleAutofillMissingCaptions([item.folder])}
                      disabled={actionLoading}
                      className="px-2 py-1 text-[11px] rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors flex items-center gap-1"
                      title="Create matching .txt caption"
                    >
                      <Wand2 className="w-3 h-3 text-amber-400" />
                      <span>Autofill .txt</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIds(new Set([item.id]));
                      setShowQuarantineModal(true);
                    }}
                    disabled={actionLoading}
                    className="p-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/80 transition-colors"
                    title="Move to quarantine / archive folder"
                  >
                    <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteSelected([item.path])}
                    disabled={actionLoading}
                    className="p-1.5 rounded bg-neutral-900 hover:bg-rose-950 text-neutral-400 hover:text-rose-400 border border-neutral-700/80 hover:border-rose-500/40 transition-colors"
                    title="Permanently delete from disk"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectItem(item)}
                    className="p-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-indigo-300 border border-neutral-700/80 transition-colors"
                    title="Inspect file details"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-neutral-400 flex flex-col items-center justify-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-1" />
            <span className="font-semibold text-neutral-200">No Orphaned or Excluded Files Detected</span>
            <p className="text-neutral-500 max-w-md">
              All image files in the active dataset folders are properly paired with captions and synchronized with the active training cache database.
            </p>
          </div>
        )}
      </div>

      {/* Move to Quarantine Modal */}
      {showQuarantineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4 text-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-amber-400" />
                Relocate to Quarantine Directory
              </h3>
              <button
                type="button"
                onClick={() => setShowQuarantineModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Moving <strong className="text-amber-300">{selectedIds.size} file(s)</strong> out of the active dataset directory isolates them from training batches while keeping raw data safe on disk.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 block">
                Destination Quarantine Directory Path:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quarantinePath}
                  onChange={e => setQuarantinePath(e.target.value)}
                  className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-100 font-mono focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => onOpenBrowser ? onOpenBrowser('quarantine_destination', 'folder') : undefined}
                  className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg whitespace-nowrap"
                >
                  Browse...
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowQuarantineModal(false)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleMoveToQuarantine()}
                disabled={actionLoading || !quarantinePath.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow transition-colors disabled:opacity-50"
              >
                <FolderInput className="w-3.5 h-3.5" />
                <span>Confirm Move ({selectedIds.size})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Item Modal */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-xl w-full p-5 shadow-2xl space-y-4 text-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400" />
                Orphaned File Diagnostics
              </h3>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {inspectItem.type === 'image' && inspectItem.image_url ? (
                <img
                  src={inspectItem.image_url}
                  alt={inspectItem.name}
                  className="w-full sm:w-48 h-48 object-cover rounded-lg border border-neutral-800 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full sm:w-48 h-48 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center shrink-0">
                  {inspectItem.type === 'caption' ? (
                    <FileText className="w-12 h-12 text-cyan-400" />
                  ) : inspectItem.type === 'tensor' ? (
                    <Layers className="w-12 h-12 text-purple-400" />
                  ) : (
                    <FileQuestion className="w-12 h-12 text-neutral-500" />
                  )}
                </div>
              )}

              <div className="flex-1 space-y-2 text-xs">
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Filename & Type:</span>
                  <p className="font-mono text-neutral-100 text-sm select-all">{inspectItem.name}</p>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Exclusion Diagnostic:</span>
                  <div className="mt-1">{getReasonBadge(inspectItem.reason)}</div>
                  <p className="text-neutral-300 mt-1 text-[11px] leading-relaxed bg-neutral-950 p-2 rounded border border-neutral-800/80">
                    {inspectItem.reason_description}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Physical File Path:</span>
                  <p className="font-mono text-neutral-400 text-[11px] truncate select-all">{inspectItem.path}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-neutral-500">File Size:</span>
                    <p className="font-mono text-neutral-200">{inspectItem.size_mb} MB</p>
                  </div>
                  <div>
                    <span className="text-neutral-500">Active In Cache DB:</span>
                    <p className="font-mono text-neutral-200">{inspectItem.cached_in_db ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  const p = inspectItem.path;
                  setInspectItem(null);
                  handleDeleteSelected([p]);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/40"
              >
                Delete File
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = inspectItem.id;
                  setSelectedIds(new Set([id]));
                  setInspectItem(null);
                  setShowQuarantineModal(true);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white"
              >
                Move to Quarantine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
