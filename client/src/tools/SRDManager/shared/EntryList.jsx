import React, { useState, useMemo } from 'react';

/**
 * EntryList - A searchable, clickable list of entries for a category.
 * Used in the sidebar for races, classes, backgrounds, etc.
 *
 * Props:
 *   entries: { [key: string]: any }  - Object map of entries
 *   selectedKey: string | null       - Currently selected entry key
 *   onSelect: (key) => void          - Callback when an entry is clicked
 *   label: string                    - Category label (e.g., "Races")
 *   onAdd: () => void                - Callback for "Add New" button
 *   onDelete: (key) => void          - Callback for deleting an entry
 *   displayField?: string            - Optional field to show instead of key (default: key)
 */
export default function EntryList({
  entries = {},
  selectedKey,
  onSelect,
  label,
  onAdd,
  onDelete,
  displayField,
}) {
  const [search, setSearch] = useState('');

  const filteredKeys = useMemo(() => {
    const keys = Object.keys(entries);
    if (!search.trim()) return keys.sort();
    const lower = search.toLowerCase();
    return keys
      .filter((k) => {
        const display = displayField && entries[k]?.[displayField] ? entries[k][displayField] : k;
        return display.toLowerCase().includes(lower);
      })
      .sort();
  }, [entries, search, displayField]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-srd-300 uppercase tracking-wide">{label}</h3>
        <button type="button" onClick={onAdd} className="btn-gold text-xs py-1 px-2.5">
          + Add New
        </button>
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${label.toLowerCase()}...`}
        className="form-input text-sm py-1.5 mb-2"
      />
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {filteredKeys.length === 0 && (
          <div className="text-gray-500 text-sm italic text-center py-4">
            {search ? 'No matches found' : `No ${label.toLowerCase()} yet`}
          </div>
        )}
        {filteredKeys.map((key) => (
          <div
            key={key}
            className={`flex items-center group cursor-pointer rounded px-2.5 py-1.5 transition-colors ${
              selectedKey === key
                ? 'bg-srd-800 border border-srd-500'
                : 'bg-gray-800 border border-transparent hover:border-gray-600'
            }`}
            onClick={() => onSelect(key)}
          >
            <span className="text-sm flex-1 truncate">
              {displayField && entries[key]?.[displayField] ? entries[key][displayField] : key}
            </span>
            {entries[key]?.source && (
              <span className="text-[10px] text-gray-500 mr-2 font-mono">{entries[key].source}</span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete "${key}"? This cannot be undone.`)) {
                  onDelete(key);
                }
              }}
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity ml-1"
              title="Delete"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="text-xs text-gray-500 mt-2 text-center">
        {filteredKeys.length} of {Object.keys(entries).length} entries
      </div>
    </div>
  );
}
