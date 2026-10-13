import { useEffect, useRef, useState } from 'react';
import { MAX_COMMAND_LENGTH } from '@shared/protocol.js';
import './CommandBar.css';

interface CommandBarProps {
  /** Runs a command. Resolves with an error message, or null if it was applied. */
  onSubmit: (command: string) => Promise<string | null> | string | null;
  onUndo: () => void;
  canUndo: boolean;
}

const HINTS = [
  ['Swap', 'R1 <> R2'],
  ['Scale', 'R1 = R1/3'],
  ['Add', 'R1 = R1 - 2R2'],
  ['Fractions', 'R2 = R2 + (3/2)R1']
] as const;

export function CommandBar({ onSubmit, onUndo, canUndo }: CommandBarProps) {
  const [command, setCommand] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = command.trim();
    if (!text) return;

    const problem = await onSubmit(text);
    if (problem) {
      setError(problem);
    } else {
      setCommand('');
      setError('');
    }
    inputRef.current?.focus();
  };

  const handleUndo = () => {
    setError('');
    onUndo();
    inputRef.current?.focus();
  };

  return (
    <div className="command-bar">
      <form onSubmit={handleSubmit} className="command-form">
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => {
            setCommand(e.target.value);
            setError('');
          }}
          placeholder="e.g. R2 = R2 - 3R1"
          className={`command-input ${error ? 'invalid' : ''}`}
          maxLength={MAX_COMMAND_LENGTH}
          aria-label="Row operation"
          aria-invalid={!!error}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button type="submit" className="btn btn-primary" disabled={!command.trim()}>
          Apply
        </button>
        <button type="button" onClick={handleUndo} className="btn btn-secondary" disabled={!canUndo}>
          Undo
        </button>
      </form>
      <div className="command-error" role="alert">{error}</div>
      <div className="command-hints">
        {HINTS.map(([label, example]) => (
          <span key={label}>
            {label}: <code>{example}</code>
          </span>
        ))}
      </div>
    </div>
  );
}
