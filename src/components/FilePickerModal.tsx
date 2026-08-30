import React, { useState, useEffect } from "react";
import { 
  Folder, 
  FolderPlus, 
  File, 
  Search, 
  ChevronRight, 
  ArrowUp, 
  HardDrive, 
  Check, 
  X, 
  RefreshCw, 
  Home, 
  Layers, 
  Database,
  Image as ImageIcon
} from "lucide-react";
import { FsBrowseResult, FsItem } from "../types/training";

interface FilePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selectedPath: string) => void;
  title?: string;
  initialPath?: string;
  selectMode?: "folder" | "file";
  fileFilterExts?: string[];
}

export const FilePickerModal: React.FC<FilePickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = "Select Folder",
  initialPath = "",
  selectMode = "folder",
  fileFilterExts = []
}) => {
  const [currentPath, setCurrentPath] = useState<string>(initialPath || ".");
  const [parentPath, setParentPath] = useState<string>("");
  const [items, setItems] = useState<FsItem[]>([]);
  const [shortcuts, setShortcuts] = useState<Array<{ name: string; path: string }>>([]);
  const [drives, setDrives] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedItemPath, setSelectedItemPath] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch directory listing
  const fetchDirectory = async (targetPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        path: targetPath,
        onlyDirs: selectMode === "folder" ? "false" : "false",
        filter: searchQuery,
        showHidden: "false"
      });

      const res = await fetch(`/api/fs/browse?${queryParams.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to read path: ${res.statusText}`);
      }

      const data: FsBrowseResult = await res.json();
      setCurrentPath(data.currentPath);
      setParentPath(data.parentPath || "");
      setItems(data.items || []);
      if (data.shortcuts) {
        setShortcuts(data.shortcuts);
      }
      // If choosing folder, default selected path is current folder
      if (selectMode === "folder") {
        setSelectedItemPath(data.currentPath);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load directory");
    } finally {
      setLoading(false);
    }
  };

  // Fetch drives on mount
  useEffect(() => {
    if (isOpen) {
      fetch("/api/fs/drives")
        .then(r => r.json())
        .then(d => {
          if (d.drives) setDrives(d.drives);
        })
        .catch(() => {});
      
      fetchDirectory(initialPath || ".");
    }
  }, [isOpen, initialPath]);

  // Handle search debounce
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchDirectory(currentPath);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleNavigate = (pathToGo: string) => {
    setSearchQuery("");
    fetchDirectory(pathToGo);
  };

  const handleItemClick = (item: FsItem) => {
    if (item.isDirectory) {
      if (selectMode === "folder") {
        setSelectedItemPath(item.path);
      }
    } else {
      if (selectMode === "file") {
        setSelectedItemPath(item.path);
      }
    }
  };

  const handleItemDoubleClick = (item: FsItem) => {
    if (item.isDirectory) {
      handleNavigate(item.path);
    } else if (selectMode === "file") {
      onSelect(item.path);
      onClose();
    }
  };

  const handleConfirm = () => {
    const finalPath = selectedItemPath || currentPath;
    if (finalPath) {
      onSelect(finalPath);
      onClose();
    }
  };

  const filteredItems = items.filter(item => {
    if (selectMode === "folder") return true;
    if (item.isDirectory) return true;
    if (fileFilterExts.length === 0) return true;
    return fileFilterExts.some(ext => item.name.toLowerCase().endsWith(ext.toLowerCase()));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-neutral-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {selectMode === "folder" ? <Folder className="w-5 h-5" /> : <File className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-100">{title}</h3>
              <p className="text-xs text-neutral-400">
                Browse local disk directories and select {selectMode === "folder" ? "target dataset/model directory" : "model weight file"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Path & Search Bar */}
        <div className="p-4 border-b border-neutral-800/80 bg-neutral-900/90 flex flex-col sm:flex-row gap-3">
          {/* Breadcrumb Path Display */}
          <div className="flex-1 flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 overflow-x-auto font-mono">
            <button 
              onClick={() => handleNavigate(parentPath || currentPath)}
              disabled={!parentPath || parentPath === currentPath}
              className="p-1 text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed rounded"
              title="Go to parent directory"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <span className="text-neutral-500">|</span>
            <span className="truncate">{currentPath}</span>
          </div>

          {/* Search Filter Input */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Filter items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Refresh Button */}
          <button 
            onClick={() => fetchDirectory(currentPath)}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition-colors flex items-center gap-1.5"
            title="Refresh folder contents"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Modal Body: Left Shortcuts Sidebar + Right File List */}
        <div className="flex-1 flex overflow-hidden min-h-[360px]">
          
          {/* Left Shortcuts */}
          <div className="w-56 border-r border-neutral-800/80 bg-neutral-950/40 p-3 flex flex-col gap-3 overflow-y-auto">
            <div>
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-2">Quick Locations</span>
              <div className="mt-1.5 flex flex-col gap-0.5">
                {shortcuts.map((sc) => (
                  <button
                    key={sc.name}
                    onClick={() => handleNavigate(sc.path)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-left truncate"
                  >
                    {sc.name.includes("Root") ? <HardDrive className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> :
                     sc.name.includes("Dataset") ? <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> :
                     sc.name.includes("Model") ? <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" /> :
                     <Home className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                    <span className="truncate">{sc.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Drives (Windows / Multi-drive) */}
            {drives.length > 0 && (
              <div className="pt-2 border-t border-neutral-800/60">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-2">Drives & Mounts</span>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {drives.map(drive => (
                    <button
                      key={drive}
                      onClick={() => handleNavigate(drive)}
                      className="flex items-center gap-1 px-2 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-xs text-neutral-300"
                    >
                      <HardDrive className="w-3 h-3 text-neutral-400" />
                      {drive}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right File/Folder Grid List */}
          <div className="flex-1 flex flex-col bg-neutral-900/50 p-4 overflow-y-auto">
            {error ? (
              <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300">
                <p className="font-semibold">Unable to browse directory:</p>
                <p className="mt-1 text-red-400">{error}</p>
                <button 
                  onClick={() => handleNavigate(".")} 
                  className="mt-3 px-3 py-1 bg-red-900/50 hover:bg-red-800/60 text-red-200 rounded text-xs"
                >
                  Return to Workspace Root
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-neutral-500">
                <FolderPlus className="w-10 h-10 stroke-[1.5] mb-2 opacity-40" />
                <p className="text-sm font-medium">No matching items found</p>
                <p className="text-xs text-neutral-500 mt-1">This directory is empty or all items were filtered out.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {filteredItems.map((item) => {
                  const isSelected = selectedItemPath === item.path;
                  const isImage = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".avif", ".gif"].includes(item.ext || "");

                  return (
                    <div
                      key={item.path}
                      onClick={() => handleItemClick(item)}
                      onDoubleClick={() => handleItemDoubleClick(item)}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer select-none text-xs ${
                        isSelected 
                          ? "bg-indigo-500/20 border-indigo-500 text-white font-medium" 
                          : "bg-neutral-950/40 border-neutral-800/80 hover:bg-neutral-800/60 hover:border-neutral-700 text-neutral-300"
                      }`}
                    >
                      <div className="shrink-0">
                        {item.isDirectory ? (
                          <Folder className={`w-4 h-4 ${isSelected ? "text-indigo-400" : "text-amber-400"}`} />
                        ) : isImage ? (
                          <ImageIcon className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <File className="w-4 h-4 text-neutral-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="truncate">{item.name}</p>
                        <p className="text-[10px] text-neutral-500">
                          {item.isDirectory ? "Folder" : `${item.size ? Math.round(item.size / 1024) + ' KB' : 'File'}`}
                        </p>
                      </div>

                      {item.isDirectory && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigate(item.path);
                          }}
                          className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white"
                          title="Open folder"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-neutral-400 w-full sm:w-auto truncate">
            <span className="font-semibold text-neutral-300">Selected:</span>
            <span className="font-mono text-neutral-200 truncate">{selectedItemPath || currentPath}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 transition-colors shadow-lg shadow-indigo-600/20"
            >
              <Check className="w-4 h-4" />
              <span>Select {selectMode === "folder" ? "Folder" : "File"}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
