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

  it('keeps the report builder on value-first fields and real wizard navigation', () => {
    const source = read('apps/clinic-ops/src/pages/ReportEditorPage.jsx');

    assert.match(source, /const \[activeStep, setActiveStep\] = useState\(0\)/);
    assert.match(source, /const goNext = useCallback\(\(\) => goToStep\(activeStep \+ 1\)/);
    assert.match(source, /const goBack = useCallback\(\(\) => goToStep\(activeStep - 1\)/);
    assert.match(source, /filter\(hasFilledFilterValue\)/);
    assert.match(source, /normalizeReportLimit/);
    assert.match(source, /groupBy: \[\{ column: 'icd10_code'/);
    assert.match(source, /onChange=\{setName\}/);
    assert.doesNotMatch(source, /onChange=\{\(e\) => setName\(e\.target\.value\)\}/);
    assert.doesNotMatch(source, /disabled=\{saving \|\| !name\.trim\(\)\}/);
  });
});
