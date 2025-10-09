import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import './styles.css';

interface JsonEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  title?: string;
}

export default function JsonEditorModal({
  isOpen,
  onClose,
  value,
  onChange,
  title = 'Edit JSON',
}: JsonEditorModalProps) {
  const [editorValue, setEditorValue] = useState(JSON.stringify(value, null, 2));
  const [hasChanges, setHasChanges] = useState(false);
  const [jsonError, setJsonError] = useState<string>('');

  // Sync with prop value when modal opens
  useEffect(() => {
    if (isOpen) {
      setEditorValue(JSON.stringify(value, null, 2));
      setHasChanges(false);
      setJsonError('');
    }
  }, [isOpen, value]);

  const handleEditorChange = (newValue: string = '') => {
    setEditorValue(newValue);
    setHasChanges(true);
    try {
      JSON.parse(newValue);
      setJsonError('');
    } catch (error) {
      setJsonError('Invalid JSON format');
    }
  };

  const handleSave = () => {
    if (!jsonError) {
      try {
        const parsed = JSON.parse(editorValue) as Record<string, unknown>;
        onChange(parsed);
        setHasChanges(false);
        onClose();
      } catch (error) {
        setJsonError('Invalid JSON format');
      }
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    onClose();
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(editorValue) as Record<string, unknown>;
      const formatted = JSON.stringify(parsed, null, 2);
      setEditorValue(formatted);
      setJsonError('');
    } catch (error) {
      setJsonError('Invalid JSON format');
    }
  };

  const resetToEmpty = () => {
    setEditorValue('{}');
    setHasChanges(true);
    setJsonError('');
  };

  if (!isOpen) return null;

  return (
    <div className="json-modal-overlay" onClick={handleCancel}>
      <div className="json-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="json-modal-header">
          <h3>{title}</h3>
          <button className="json-modal-close" onClick={handleCancel} title="Close">
            ×
          </button>
        </div>

        <div className="json-modal-content">
          <div className="json-modal-toolbar">
            <div className="json-modal-toolbar-left">
              <button
                onClick={formatJson}
                disabled={!!jsonError}
                className="json-modal-button secondary"
                title="Format JSON"
              >
                Format
              </button>
              <button onClick={resetToEmpty} className="json-modal-button secondary" title="Reset to empty object">
                Reset
              </button>
            </div>
            <div className="json-modal-toolbar-right">
              {jsonError && <span className="json-modal-error">{jsonError}</span>}
            </div>
          </div>

          <div className={`json-modal-editor ${jsonError ? 'has-error' : ''}`}>
            <Editor
              height="500px"
              defaultLanguage="json"
              value={editorValue}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: true },
                fontSize: 16,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                insertSpaces: true,
                formatOnPaste: true,
                formatOnType: true,
                wordWrap: 'on',
                theme: 'vs-light',
                folding: true,
                bracketPairColorization: { enabled: true },
                suggest: {
                  showSnippets: true,
                },
              }}
            />
          </div>
        </div>

        <div className="json-modal-footer">
          <div className="json-modal-status">
            {hasChanges && <span className="json-modal-changes">• Unsaved changes</span>}
          </div>
          <div className="json-modal-actions">
            <button onClick={handleCancel} className="json-modal-button secondary">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!!jsonError} className="json-modal-button primary">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
