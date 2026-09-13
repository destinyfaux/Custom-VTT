import React, { useState } from 'react';

/**
 * DynamicKeyValues - A component for editing objects where BOTH keys and values are dynamic.
 * Used for feat effects where keys like "proficiencies_add", "advantage_on_saves" are freeform.
 * Values can be strings, numbers, arrays of strings, or nested objects.
 *
 * Props:
 *   data: object                 - The object to edit
 *   onChange: (newObj) => void   - Callback with updated object
 *   label: string                - Field label
 */
export default function DynamicKeyValues({ data = {}, onChange, label }) {
  const [newKey, setNewKey] = useState('');

  const handleAdd = () => {
    const trimmed = newKey.trim();
    if (!trimmed || data.hasOwnProperty(trimmed)) return;
    onChange({ ...data, [trimmed]: '' });
    setNewKey('');
  };

  const handleRemove = (key) => {
    const { [key]: _, ...rest } = data;
    onChange(rest);
  };

  const handleValueChange = (key, value) => {
    onChange({ ...data, [key]: value });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const entries = Object.entries(data);

  // Render a value editor based on the type of value
  const renderValueEditor = (key, value) => {
    if (value === null || value === undefined) {
      return (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-gray-500 text-sm italic">null</span>
          <button
            type="button"
            onClick={() => handleValueChange(key, '')}
            className="text-xs text-srd-400 hover:text-srd-300"
          >
            Set as string
          </button>
          <button
            type="button"
            onClick={() => handleValueChange(key, [])}
            className="text-xs text-srd-400 hover:text-srd-300"
          >
            Set as array
          </button>
          <button
            type="button"
            onClick={() => handleValueChange(key, {})}
            className="text-xs text-srd-400 hover:text-srd-300"
          >
            Set as object
          </button>
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div className="flex-1">
          <div className="space-y-1">
            {value.map((item, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newArr = [...value];
                    newArr[i] = e.target.value;
                    handleValueChange(key, newArr);
                  }}
                  className="form-input text-sm py-1 flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newArr = [...value];
                    newArr.splice(i, 1);
                    handleValueChange(key, newArr);
                  }}
                  className="text-red-400 hover:text-red-300 text-sm px-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => handleValueChange(key, [...value, ''])}
            className="text-xs text-srd-400 hover:text-srd-300 mt-1"
          >
            + Add item
          </button>
        </div>
      );
    }

    if (typeof value === 'object') {
      return (
        <div className="flex-1">
          <textarea
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleValueChange(key, parsed);
              } catch {
                // Invalid JSON - don't update, let user fix
              }
            }}
            rows={3}
            className="form-input text-sm font-mono"
            placeholder="JSON object..."
          />
        </div>
      );
    }

    // String or number
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleValueChange(key, e.target.value)}
        className="form-input flex-1 text-sm py-1.5"
        placeholder="Value..."
      />
    );
  };

  return (
    <div className="mb-4">
      {label && <label className="section-label">{label}</label>}
      {entries.length > 0 && (
        <div className="space-y-3 mb-3">
          {entries.map(([key, value]) => (
            <div key={key} className="bg-gray-750 border border-gray-600 rounded p-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-mono text-dnd-gold font-semibold flex-shrink-0">{key}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(key)}
                  className="text-red-400 hover:text-red-300 text-sm font-bold ml-auto"
                  title="Remove this key"
                >
                  × Remove
                </button>
              </div>
              {renderValueEditor(key, value)}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New key name..."
          className="form-input flex-1 text-sm py-1.5"
        />
        <button type="button" onClick={handleAdd} className="btn-secondary text-sm py-1.5 px-3">
          + Add Key
        </button>
      </div>
    </div>
  );
}
