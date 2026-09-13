import React, { useState } from 'react';

/**
 * ObjectMapper - A reusable component for editing objects with known key patterns.
 * Used for ability_score_increase, effects, etc.
 * Renders a row for each key with a value input.
 *
 * Props:
 *   data: object                 - The object to edit (e.g., { STR: 2, CON: 1 })
 *   onChange: (newObj) => void   - Callback with updated object
 *   label: string                - Field label
 *   keyOptions?: string[]        - Predefined key options (e.g., ['STR','DEX','CON','INT','WIS','CHA'])
 *   valuePlaceholder?: string    - Placeholder for value input
 *   valueType?: 'number' | 'string'  - Type of value (defaults to number)
 */
export default function ObjectMapper({
  data = {},
  onChange,
  label,
  keyOptions,
  valuePlaceholder = 'Value',
  valueType = 'number',
}) {
  const [customKey, setCustomKey] = useState('');

  const handleAdd = (key) => {
    if (!key || key.trim() === '') return;
    const k = key.trim();
    if (data.hasOwnProperty(k)) return; // no duplicates
    const newObj = { ...data, [k]: valueType === 'number' ? 0 : '' };
    onChange(newObj);
    setCustomKey('');
  };

  const handleRemove = (key) => {
    const { [key]: _, ...rest } = data;
    onChange(rest);
  };

  const handleValueChange = (key, value) => {
    const newObj = { ...data, [key]: valueType === 'number' ? (value === '' ? 0 : Number(value)) : value };
    onChange(newObj);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd(customKey);
    }
  };

  const entries = Object.entries(data);

  return (
    <div className="mb-4">
      {label && <label className="section-label">{label}</label>}
      {entries.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {entries.map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-sm font-mono text-srd-300 min-w-[60px]">{key}</span>
              <input
                type={valueType === 'number' ? 'number' : 'text'}
                value={val ?? ''}
                onChange={(e) => handleValueChange(key, e.target.value)}
                placeholder={valuePlaceholder}
                className="form-input flex-1 text-sm py-1.5"
              />
              <button
                type="button"
                onClick={() => handleRemove(key)}
                className="text-red-400 hover:text-red-300 text-sm font-bold px-1"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new key */}
      <div className="flex gap-2">
        {keyOptions ? (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) handleAdd(e.target.value);
            }}
            className="form-select flex-1 text-sm py-1.5"
          >
            <option value="">+ Add key...</option>
            {keyOptions
              .filter((k) => !data.hasOwnProperty(k))
              .map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
          </select>
        ) : (
          <>
            <input
              type="text"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Key name..."
              className="form-input flex-1 text-sm py-1.5"
            />
            <button
              type="button"
              onClick={() => handleAdd(customKey)}
              className="btn-secondary text-sm py-1.5 px-3"
            >
              + Add
            </button>
          </>
        )}
      </div>
    </div>
  );
}
