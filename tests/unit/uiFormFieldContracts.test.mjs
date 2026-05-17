import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('FormField event contract', () => {
  it('emits value first and event second for simple state setters', () => {
    const source = read('packages/ui/components/ui/FormField.jsx');

    assert.match(source, /const emitChange = \(event\) => \{/);
    assert.match(source, /onChange\?\.\(event\.target\.value, event\)/);
    assert.doesNotMatch(source, /onChange=\{onChange\}/);
  });

  it('keeps document generation compatible with event-shaped field updates', () => {
    const source = read('apps/clinic-ops/src/pages/DocumentGeneratePage.jsx');

    assert.match(source, /const handleFieldChange = useCallback\(\(valueOrEvent, event\) => \{/);
    assert.match(source, /const sourceEvent = event \|\| valueOrEvent/);
    assert.match(source, /const value = event \? valueOrEvent : sourceEvent\.target\.value/);
  });
});
