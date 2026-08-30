import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  File, 
  HardDrive, 
  ChevronRight, 
  ArrowUp, 
  Check, 
  X, 
  RefreshCw, 
  Search,
  FolderPlus
} from 'lucide-react';

interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size_mb?: number;
  extension?: string;
}

interface FileBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selectedPath: string) => void;
  initialPath?: string;
  title?: string;
  mode?: 'folder' | 'file';
  allowedExtensions?: string[]; // e.g. ['.safetensors', '.pt', '.json']
}

export const FileBrowserModal: React.FC<FileBrowserModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath = '',
  title = 'Browse Local Host Machine',
  mode = 'folder',
  allowedExtensions
}) => {
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [folders, setFolders] = useState<FileItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [drives, setDrives] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemPath, setSelectedItemPath] = useState<string>(initialPath);

  // Fetch Drive Letters (Windows C:\, G:\, etc.)
  const fetchDrives = async () => {
    try {
      const res = await fetch('/api/fs/drives');
      if (res.ok) {
        const data = await res.json();
        setDrives(data.drives || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Browse specific directory
  const browsePath = async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fs/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: target,
          directories_only: mode === 'folder',
          allowed_extensions: allowedExtensions
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to read directory.');
      }

      const data = await res.json();
      setCurrentPath(data.current_path);
      setParentPath(data.parent_path);
      setFolders(data.folders || []);
      setFiles(data.files || []);
      setSelectedItemPath(data.current_path);
    } catch (err: any) {
      setError(err.message || 'Error opening folder.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDrives();
      browsePath(initialPath || '');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleConfirm = () => {
    onSelect(selectedItemPath || currentPath);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-neutral-100">{title}</h2>
              <p className="text-xs text-neutral-400">Select a local {mode} from host filesystem</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drives & Quick Bar */}
        <div className="px-6 py-2.5 bg-neutral-950 border-b border-neutral-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5" /> Drives:
          </span>
          {drives.map((d) => (
            <button
              key={d}
              onClick={() => browsePath(d)}
              className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-all ${
                currentPath.startsWith(d)
                  ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Path Breadcrumb Navigation */}
        <div className="px-6 py-3 bg-neutral-900/90 border-b border-neutral-800 flex items-center gap-2 text-xs">
          <button
            onClick={() => parentPath && browsePath(parentPath)}
            disabled={!parentPath}
            className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-40 disabled:hover:bg-neutral-800 transition-colors"
            title="Go up one folder"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          <input
            type="text"
            value={currentPath}
            onChange={(e) => setCurrentPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && browsePath(currentPath)}
            className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-1.5 font-mono text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
          />

          <button
            onClick={() => browsePath(currentPath)}
            className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-2 bg-neutral-900/50 border-b border-neutral-800/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Filter current folder..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-700"
            />
          </div>
        </div>

        {/* Directory Explorer List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-neutral-950/40 min-h-[260px]">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Subfolders */}
          {filteredFolders.map((item) => (
            <div
              key={item.path}
              onDoubleClick={() => browsePath(item.path)}
              onClick={() => setSelectedItemPath(item.path)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                selectedItemPath === item.path
                  ? 'bg-indigo-600/30 border border-indigo-500/50 text-white'
                  : 'hover:bg-neutral-800/70 text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate font-medium">{item.name}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
            </div>
          ))}

          {/* Files (if in file mode) */}
          {mode === 'file' && filteredFiles.map((file) => (
            <div
              key={file.path}
              onClick={() => setSelectedItemPath(file.path)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                selectedItemPath === file.path
                  ? 'bg-indigo-600/30 border border-indigo-500/50 text-white'
                  : 'hover:bg-neutral-800/70 text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <File className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate">{file.name}</span>
              </div>
              {file.size_mb && (
                <span className="text-[10px] font-mono text-neutral-500">{file.size_mb} MB</span>
              )}
            </div>
          ))}

          {!loading && filteredFolders.length === 0 && filteredFiles.length === 0 && !error && (
            <div className="text-center py-10 text-xs text-neutral-500 font-mono">
              Empty folder
            </div>
          )}
        </div>

        {/* Footer Selection Controls */}
        <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between gap-4">
          <div className="truncate text-xs text-neutral-400 font-mono flex-1">
            <span className="text-neutral-500">Selected: </span>
            <span className="text-indigo-300">{selectedItemPath || currentPath}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              Select {mode === 'folder' ? 'Folder' : 'File'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};