import React, { useState } from 'react';

/**
 * NamedEntryArray - A reusable component for editing arrays of { name, description } objects.
 * Used for monster traits, actions, legendary_actions, reactions, lair_actions.
 * Provides add/remove/edit functionality with collapsible entries.
 *
 * Props:
 *   items: Array<{ name: string, description: string }>  - The array to edit
 *   onChange: (newArr) => void                            - Callback with updated array
 *   label: string                                         - Field label (e.g., "Traits", "Actions")
 *   addLabel?: string                                     - Label for add button (default: "+ Add Entry")
 *   extraFields?: Array<{ key: string, label: string, type: string, default: any }>
 *                                                         - Optional extra fields per entry (e.g., cost for legendary actions)
 */
export default function NamedEntryArray({
  items = [],
  onChange,
  label,
  addLabel = '+ Add Entry',
  extraFields = [],
}) {
  const [expandedIdx, setExpandedIdx] = useState(null);

  const handleAdd = () => {
    const newItem = { name: '', description: '' };
    extraFields.forEach((f) => {
      newItem[f.key] = f.default;
    });
    onChange([...items, newItem]);
    setExpandedIdx(items.length);
  };

  const handleRemove = (index) => {
    const updated = [...items];
    updated.splice(index, 1);
    onChange(updated);
    if (expandedIdx === index) setExpandedIdx(null);
    else if (expandedIdx !== null && expandedIdx > index) setExpandedIdx(expandedIdx - 1);
  };

  const handleFieldChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const updated = [...items];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
    if (expandedIdx === index) setExpandedIdx(index - 1);
    else if (expandedIdx === index - 1) setExpandedIdx(index);
  };

  const moveDown = (index) => {
    if (index === items.length - 1) return;
    const updated = [...items];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
    if (expandedIdx === index) setExpandedIdx(index + 1);
    else if (expandedIdx === index + 1) setExpandedIdx(index);
  };

  const toggleExpand = (index) => {
    setExpandedIdx(expandedIdx === index ? null : index);
  };

  return (
    <div className="mb-4">
      {label && <label className="section-label">{label}</label>}
      <div className="space-y-2">
        {items.map((item, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div
              key={i}
              className={`bg-gray-750 border rounded transition-colors ${
                isExpanded ? 'border-srd-500' : 'border-gray-600'
              }`}
            >
              {/* Header row - always visible */}
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
                onClick={() => toggleExpand(i)}
              >
                <span className="text-gray-400 text-xs">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span className="text-sm font-semibold text-dnd-gold flex-1 truncate">
                  {item.name || '(unnamed)'}
                </span>
                {item.description && !isExpanded && (
                  <span className="text-xs text-gray-500 truncate max-w-[300px]">
                    {item.description.substring(0, 80)}{item.description.length > 80 ? '...' : ''}
                  </span>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100"
                     onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => moveUp(i)}
                    className="text-gray-400 hover:text-white text-xs px-1"
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(i)}
                    className="text-gray-400 hover:text-white text-xs px-1"
                    title="Move down"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    className="text-red-400 hover:text-red-300 text-sm font-bold px-1"
                    title="Remove"
                  >
                    x
                  </button>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-gray-600">
                  <div className="field-group pt-2">
                    <label className="text-xs text-gray-400 font-medium">Name</label>
                    <input
                      type="text"
                      value={item.name ?? ''}
                      onChange={(e) => handleFieldChange(i, 'name', e.target.value)}
                      className="form-input text-sm py-1.5"
                      placeholder="Feature name..."
                    />
                  </div>
                  <div className="field-group">
                    <label className="text-xs text-gray-400 font-medium">Description</label>
                    <textarea
                      value={item.description ?? ''}
                      onChange={(e) => handleFieldChange(i, 'description', e.target.value)}
                      className="form-input text-sm"
                      rows={3}
                      placeholder="Full description..."
                    />
                  </div>
                  {extraFields.map((f) => (
                    <div key={f.key} className="field-group">
                      <label className="text-xs text-gray-400 font-medium">{f.label}</label>
                      {f.type === 'number' ? (
                        <input
                          type="number"
                          value={item[f.key] ?? f.default}
                          onChange={(e) => handleFieldChange(i, f.key, Number(e.target.value) || f.default)}
                          className="form-input text-sm py-1.5"
                          min={0}
                        />
                      ) : (
                        <input
                          type="text"
                          value={item[f.key] ?? f.default}
                          onChange={(e) => handleFieldChange(i, f.key, e.target.value)}
                          className="form-input text-sm py-1.5"
                          placeholder={f.label}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={handleAdd} className="btn-secondary text-sm py-1.5 px-3 mt-2">
        {addLabel}
      </button>
    </div>
  );
}
