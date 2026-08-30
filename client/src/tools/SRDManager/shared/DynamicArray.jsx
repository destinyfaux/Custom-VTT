import React, { useState } from 'react';

/**
 * DynamicArray - A reusable component for editing arrays of strings.
 * Provides add/remove/reorder functionality.
 *
 * Props:
 *   items: string[]             - The array to edit
 *   onChange: (newArr) => void  - Callback with updated array
 *   label: string               - Field label
 *   placeholder?: string        - Placeholder for new item input
 */
export default function DynamicArray({ items = [], onChange, label, placeholder = 'Add item...' }) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setNewItem('');
  };

  const handleRemove = (index) => {
    const updated = [...items];
    updated.splice(index, 1);
    onChange(updated);
  };

  const handleEdit = (index, value) => {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const updated = [...items];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const moveDown = (index) => {
    if (index === items.length - 1) return;
    const updated = [...items];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  return (
    <div className="mb-4">
      {label && <label className="section-label">{label}</label>}
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 group">
            <input
              type="text"
              value={item}
              onChange={(e) => handleEdit(i, e.target.value)}
              className="form-input flex-1 text-sm py-1.5"
            />
            <button
              type="button"
              onClick={() => moveUp(i)}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white text-xs px-1 transition-opacity"
              title="Move up"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => moveDown(i)}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white text-xs px-1 transition-opacity"
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
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="form-input flex-1 text-sm py-1.5"
        />
        <button type="button" onClick={handleAdd} className="btn-secondary text-sm py-1.5 px-3">
          + Add
        </button>
      </div>
    </div>
  );
}
