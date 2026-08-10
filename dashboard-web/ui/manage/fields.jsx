'use client';

import { useState } from 'react';

export function TextField({ label, value, onChange, placeholder = '', type = 'text', hint }) {
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      <input
        className="input"
        type={type}
        value={value || ''}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
      />
      {hint ? <span className="form-hint">{hint}</span> : null}
    </label>
  );
}

export function TextAreaField({ label, value, onChange, placeholder = '', rows = 4, hint }) {
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      <textarea
        className="input"
        rows={rows}
        value={value || ''}
        spellCheck={false}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
      />
      {hint ? <span className="form-hint">{hint}</span> : null}
    </label>
  );
}

// One item per line. Good for longer phrases (strengths, achievements) where
// chips would be awkward. Empty lines are dropped on change.
export function LinesField({ label, values = [], onChange, placeholder = '', rows, hint }) {
  return (
    <label className="form-field">
      {label ? <span className="form-label">{label}</span> : null}
      <textarea
        className="input"
        rows={rows || Math.max(3, values.length + 1)}
        value={values.join('\n')}
        spellCheck={false}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value.split('\n').map(line => line.trimStart()))}
        onBlur={event =>
          onChange(
            event.target.value
              .split('\n')
              .map(line => line.trim())
              .filter(Boolean)
          )
        }
      />
      {hint ? <span className="form-hint">{hint}</span> : null}
    </label>
  );
}

// Chip-style list editor: type + Enter (or comma) to add, click × to remove,
// paste comma-separated values to bulk-add.
export function TagListField({ label, values = [], onChange, placeholder = 'Type and press Enter', hint }) {
  const [draft, setDraft] = useState('');

  function addTokens(text) {
    const tokens = text
      .split(',')
      .map(token => token.trim())
      .filter(Boolean);
    if (!tokens.length) return;
    const next = [...values];
    for (const token of tokens) {
      if (!next.includes(token)) next.push(token);
    }
    onChange(next);
  }

  function commitDraft() {
    if (draft.trim()) {
      addTokens(draft);
      setDraft('');
    }
  }

  function remove(index) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <div className="form-field">
      {label ? <span className="form-label">{label}</span> : null}
      <div className="tag-input">
        {values.map((tag, index) => (
          <span className="tag" key={`${tag}-${index}`}>
            {tag}
            <button type="button" className="tag-x" onClick={() => remove(index)} aria-label={`Remove ${tag}`}>
              ×
            </button>
          </span>
        ))}
        <input
          className="tag-entry"
          value={draft}
          placeholder={placeholder}
          onChange={event => {
            const text = event.target.value;
            if (text.includes(',')) {
              addTokens(text);
              setDraft('');
            } else {
              setDraft(text);
            }
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitDraft();
            } else if (event.key === 'Backspace' && !draft && values.length) {
              remove(values.length - 1);
            }
          }}
          onBlur={commitDraft}
        />
      </div>
      {hint ? <span className="form-hint">{hint}</span> : null}
    </div>
  );
}

// Generic repeatable section: renders each item with a remove button and an
// "add" button at the end. `renderItem(item, update, index)` returns the fields.
export function RepeatableList({ items = [], onChange, renderItem, addLabel = 'Add', emptyLabel, newItem }) {
  function update(index, nextItem) {
    onChange(items.map((item, i) => (i === index ? nextItem : item)));
  }

  function remove(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add() {
    onChange([...items, typeof newItem === 'function' ? newItem() : { ...newItem }]);
  }

  return (
    <div className="repeatable">
      {items.length === 0 && emptyLabel ? <div className="muted">{emptyLabel}</div> : null}
      {items.map((item, index) => (
        <div className="repeatable-item" key={index}>
          <div className="repeatable-controls">
            <button type="button" className="icon-btn" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
              ↑
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => move(index, 1)}
              disabled={index === items.length - 1}
              aria-label="Move down"
            >
              ↓
            </button>
            <button type="button" className="icon-btn danger" onClick={() => remove(index)} aria-label="Remove">
              ×
            </button>
          </div>
          {renderItem(item, next => update(index, next), index)}
        </div>
      ))}
      <button type="button" className="btn" onClick={add}>
        {addLabel}
      </button>
    </div>
  );
}
