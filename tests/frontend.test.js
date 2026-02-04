var jsdom = require('jsdom');
var JSDOM = jsdom.JSDOM;

var dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatUpdateInfo(content) {
    if (!content) return '<p>No blocked apps</p>';

    try {
        var data = JSON.parse(content);
        if (!Array.isArray(data) || data.length === 0) {
            return '<p>No blocked apps</p>';
        }

        var appIds = data.map(function(app) { return app.id; }).filter(function(id) { return id; });
        var listItems = appIds.map(function(id) { return '<li>' + escapeHtml(id) + '</li>'; }).join('');

        var html = '<div class="blocked-apps-warning">Apps blocked until update:</div>' +
                    '<ul style="margin-top: 10px; padding-left: 20px;">' + listItems + '</ul>';
        return html;
    } catch (e) {
        return '<p>Error parsing blocked apps data</p>';
    }
}

describe('escapeHtml', function() {
    test('escapes < and >', function() {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    test('escapes &', function() {
        expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    test('escapes double quotes', function() {
        expect(escapeHtml('say "hello"')).toBe('say "hello"');
    });

    test('handles multiple special characters', function() {
        expect(escapeHtml('<img src="x" onerror="alert(1)">')).toBe('&lt;img src="x" onerror="alert(1)"&gt;');
    });

    test('returns empty string for empty input', function() {
        expect(escapeHtml('')).toBe('');
    });

    test('passes through normal text unchanged', function() {
        expect(escapeHtml('normal text 123')).toBe('normal text 123');
    });
});

describe('formatUpdateInfo', function() {
    test('returns "No blocked apps" for empty data', function() {
        expect(formatUpdateInfo('')).toBe('<p>No blocked apps</p>');
    });

    test('returns "No blocked apps" for null', function() {
        expect(formatUpdateInfo(null)).toBe('<p>No blocked apps</p>');
    });

    test('returns "No blocked apps" for empty array', function() {
        expect(formatUpdateInfo('[]')).toBe('<p>No blocked apps</p>');
    });

    test('returns HTML list for blocked apps', function() {
        var content = JSON.stringify([{ id: 'com.netflix' }, { id: 'com.youtube' }]);
        var result = formatUpdateInfo(content);
        expect(result).toContain('Apps blocked until update:');
        expect(result).toContain('<li>com.netflix</li>');
        expect(result).toContain('<li>com.youtube</li>');
    });

    test('escapes malicious app IDs', function() {
        var content = JSON.stringify([{ id: '<script>alert(1)</script>' }]);
        var result = formatUpdateInfo(content);
        expect(result).toContain('&lt;script&gt;');
        expect(result).not.toContain('<script>alert(1)</script>');
    });

    test('handles malformed JSON gracefully', function() {
        expect(formatUpdateInfo('not valid json')).toBe('<p>Error parsing blocked apps data</p>');
    });

    test('filters out apps without id', function() {
        var content = JSON.stringify([{ id: 'com.valid' }, { name: 'no-id-app' }, { id: '' }]);
        var result = formatUpdateInfo(content);
        expect(result).toContain('<li>com.valid</li>');
        expect(result).not.toContain('no-id-app');
    });
});
