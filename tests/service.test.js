
function countBlockedDomains(hostsContent) {
    var lines = hostsContent.split('\n');
    var count = 0;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('0.0.0.0') === 0 && lines[i].indexOf('lgtvsdp.com') !== -1) {
            count++;
        }
    }
    return count;
}

function filterHostsForRemoval(hostsContent) {
    var lines = hostsContent.split('\n');
    return lines.filter(function(line) {
        if (line.indexOf('lgtvsdp.com') !== -1) {
            return false;
        }
        if (line === '# LG App Update Blocker - Update domains') {
            return false;
        }
        return true;
    });
}

function parseSSHKey(line) {
    var parts = line.trim().split(' ');
    if (parts.length >= 2) {
        return {
            type: parts[0],
            key: parts[1].substring(0, 20) + '...',
            comment: parts[2] || 'no comment'
        };
    }
    return null;
}

function validateSSHKey(sshKey) {
    if (!sshKey || sshKey.trim() === '') {
        return { valid: false, error: 'SSH key cannot be empty' };
    }

    var keyParts = sshKey.trim().split(' ');
    var validTypes = ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ssh-dss'];
    var isValidType = validTypes.indexOf(keyParts[0]) !== -1;

    if (keyParts.length < 2 || !isValidType) {
        return { valid: false, error: 'Invalid SSH key format. Key should start with ssh-rsa, ssh-ed25519, etc.' };
    }

    return { valid: true, keyParts: keyParts };
}

describe('checkHostsStatus', function() {
    test('correctly counts blocked domains excluding comments', function() {
        var hostsContent =
            '127.0.0.1 localhost\n' +
            '# LG App Update Blocker - Update domains\n' +
            '# This is a comment mentioning lgtvsdp.com\n' +
            '0.0.0.0 snu.lgtvsdp.com\n' +
            '0.0.0.0 us.lgtvsdp.com\n' +
            '0.0.0.0 eu.lgtvsdp.com';

        var count = countBlockedDomains(hostsContent);
        expect(count).toBe(3);
    });

    test('returns 0 when no blocked domains exist', function() {
        var hostsContent =
            '127.0.0.1 localhost\n' +
            '::1 localhost';

        var count = countBlockedDomains(hostsContent);
        expect(count).toBe(0);
    });

    test('does not count lines that contain lgtvsdp.com but do not start with 0.0.0.0', function() {
        var hostsContent =
            '# lgtvsdp.com is an LG domain\n' +
            '127.0.0.1 lgtvsdp.com\n' +
            '0.0.0.0 snu.lgtvsdp.com';

        var count = countBlockedDomains(hostsContent);
        expect(count).toBe(1);
    });
});

describe('removeUpdateDomains', function() {
    test('removes all entries including comment header', function() {
        var hostsContent =
            '127.0.0.1 localhost\n' +
            '# LG App Update Blocker - Update domains\n' +
            '0.0.0.0 snu.lgtvsdp.com\n' +
            '0.0.0.0 us.lgtvsdp.com';

        var filtered = filterHostsForRemoval(hostsContent);
        expect(filtered).toEqual(['127.0.0.1 localhost']);
    });

    test('keeps unrelated entries', function() {
        var hostsContent =
            '127.0.0.1 localhost\n' +
            '0.0.0.0 ads.example.com\n' +
            '# LG App Update Blocker - Update domains\n' +
            '0.0.0.0 snu.lgtvsdp.com';

        var filtered = filterHostsForRemoval(hostsContent);
        expect(filtered).toEqual(['127.0.0.1 localhost', '0.0.0.0 ads.example.com']);
    });
});

describe('addSSHKey validation', function() {
    test('validates correct ssh-rsa key', function() {
        var result = validateSSHKey('ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ user@example');
        expect(result.valid).toBe(true);
        expect(result.keyParts[0]).toBe('ssh-rsa');
    });

    test('validates correct ssh-ed25519 key', function() {
        var result = validateSSHKey('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI user@example');
        expect(result.valid).toBe(true);
    });

    test('rejects empty key', function() {
        var result = validateSSHKey('');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('SSH key cannot be empty');
    });

    test('rejects key with invalid type', function() {
        var result = validateSSHKey('invalid-type AAAAB3NzaC1yc2E user@example');
        expect(result.valid).toBe(false);
    });

    test('rejects key with missing key data', function() {
        var result = validateSSHKey('ssh-rsa');
        expect(result.valid).toBe(false);
    });
});

describe('listSSHKeys parsing', function() {
    test('parses keys correctly', function() {
        var line = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC123456789 user@example.com';
        var parsed = parseSSHKey(line);
        expect(parsed.type).toBe('ssh-rsa');
        expect(parsed.key).toBe('AAAAB3NzaC1yc2EAAAAD...');
        expect(parsed.comment).toBe('user@example.com');
    });

    test('handles key without comment', function() {
        var line = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC123456789';
        var parsed = parseSSHKey(line);
        expect(parsed.comment).toBe('no comment');
    });

    test('returns null for invalid line', function() {
        var line = 'invalid';
        var parsed = parseSSHKey(line);
        expect(parsed).toBeNull();
    });
});
