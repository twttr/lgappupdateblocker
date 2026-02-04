var pkgInfo = require('./package.json');
var Service = require('webos-service');
var fs = require('fs');
var path = require('path');

function ensureDirectoryExistence(filePath) {
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

var service = new Service(pkgInfo.name);

var UPDATE_INFO_PATH = '/mnt/lg/cmn_data/var/palm/data/com.webos.appInstallService/updateInfo';

service.register('readUpdateInfo', function(message) {
    try {
        if (fs.existsSync(UPDATE_INFO_PATH)) {
            var content = fs.readFileSync(UPDATE_INFO_PATH, 'utf8');
            message.respond({
                returnValue: true,
                content: content
            });
        } else {
            message.respond({
                returnValue: true,
                content: ''
            });
        }
    } catch (error) {
        message.respond({
            returnValue: false,
            errorText: error.message
        });
    }
});

service.register('clearUpdateInfo', function(message) {
    try {
        if (fs.existsSync(UPDATE_INFO_PATH)) {
            fs.writeFileSync(UPDATE_INFO_PATH, '[]');
            message.respond({
                returnValue: true,
                message: 'Update info cleared successfully - hard restart your TV to apply changes (unplug it or use reboot over ssh)'
            });
        } else {
            message.respond({
                returnValue: true,
                message: 'Update info file does not exist'
            });
        }
    } catch (error) {
        message.respond({
            returnValue: false,
            errorText: error.message
        });
    }
});

var autostartScript = '#!/bin/sh\n' +
    '\n' +
    'output=$(luna-send -n 1 "luna://org.webosbrew.appupdateblocker.service/addUpdateDomains" \'{}\')\n' +
    '\n' +
    'if echo "$output" | grep -q \'status unknown\'; then\n' +
    '\t/var/lib/webosbrew/init.d/appupdateblocker &\n' +
    '\texit\n' +
    'fi\n' +
    '\n' +
    'if echo "$output" | grep -q \'errorText\'; then\n' +
    '\trm -f /var/lib/webosbrew/init.d/appupdateblocker\n' +
    'fi';

var PERSISTENT_SCRIPT_PATH = '/var/lib/webosbrew/init.d/appupdateblocker';

service.register('checkPersistentScript', function(message) {
    try {
        var exists = fs.existsSync(PERSISTENT_SCRIPT_PATH);
        message.respond({
            returnValue: true,
            exists: exists
        });
    } catch (error) {
        message.respond({
            returnValue: false,
            errorText: error.message
        });
    }
});

service.register('installPersistentScript', function(message) {
    try {
        if (fs.existsSync(PERSISTENT_SCRIPT_PATH)) {
            message.respond({
                returnValue: false,
                errorText: 'Persistent script already exists'
            });
            return;
        }

        ensureDirectoryExistence(PERSISTENT_SCRIPT_PATH);
        fs.writeFileSync(PERSISTENT_SCRIPT_PATH, autostartScript);
        fs.chmodSync(PERSISTENT_SCRIPT_PATH, '755');
        message.respond({
            returnValue: true,
            message: 'Persistent script installed successfully'
        });
    } catch (error) {
        message.respond({
            returnValue: false,
            errorText: error.message
        });
    }
});

service.register('removePersistentScript', function(message) {
    try {
        if (fs.existsSync(PERSISTENT_SCRIPT_PATH)) {
            fs.unlinkSync(PERSISTENT_SCRIPT_PATH);
            message.respond({
                returnValue: true,
                message: 'Persistent script removed successfully'
            });
        } else {
            message.respond({
                returnValue: true,
                message: 'Persistent script does not exist'
            });
        }
    } catch (error) {
        message.respond({
            returnValue: false,
            errorText: error.message
        });
    }
});

var HOSTS_FILE_PATH = '/etc/hosts';
var UPDATE_DOMAINS_FILE = path.join(__dirname, 'lg_update_domains.txt');

service.register('checkHostsStatus', function(message) {
    try {
        var hostsContent = fs.readFileSync(HOSTS_FILE_PATH, 'utf8');
        var lines = hostsContent.split('\n');
        var lgtvsdpCount = 0;
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].indexOf('0.0.0.0') === 0 && lines[i].indexOf('lgtvsdp.com') !== -1) {
                lgtvsdpCount++;
            }
        }

        message.respond({
            returnValue: true,
            blockedDomainsCount: lgtvsdpCount
        });
    } catch (error) {
        message.respond({
            returnValue: false,
            errorText: error.message
        });
    }
});

service.register('addUpdateDomains', function(message) {
    try {
        var fileContent = fs.readFileSync(UPDATE_DOMAINS_FILE, 'utf8');
        var updateDomains = fileContent.split('\n').filter(function(line) {
            return line.trim();
        }).map(function(domain) {
            return domain.trim();
        });

        var hostsContent = fs.readFileSync(HOSTS_FILE_PATH, 'utf8');

        var addedCount = 0;
        var hostsEntries = [];
        for (var i = 0; i < updateDomains.length; i++) {
            var domain = updateDomains[i];
            if (hostsContent.indexOf(domain) === -1) {
                addedCount++;
                hostsEntries.push('0.0.0.0 ' + domain);
            }
        }

        if (hostsEntries.length > 0) {
            if (hostsContent.charAt(hostsContent.length - 1) !== '\n') {
                hostsContent += '\n';
            }

            hostsContent += '\n# LG App Update Blocker - Update domains\n';
            hostsContent += hostsEntries.join('\n');
            hostsContent += '\n';

            fs.writeFileSync(HOSTS_FILE_PATH, hostsContent);
        }

        message.respond({
            returnValue: true,
            message: 'Added ' + addedCount + ' update domains to hosts file',
            addedCount: addedCount
        });
    } catch (error) {
        message.respond({
            returnValue: false,
            errorText: error.message
        });
    }
});

service.register('removeUpdateDomains', function(message) {
    try {
        var hostsContent = fs.readFileSync(HOSTS_FILE_PATH, 'utf8');

        var lines = hostsContent.split('\n');
        var filteredLines = lines.filter(function(line) {
            if (line.indexOf('lgtvsdp.com') !== -1) {
                return false;
            }
            if (line === '# LG App Update Blocker - Update domains') {
                return false;
            }
            return true;
        });
        var removedCount = lines.length - filteredLines.length;

        fs.writeFileSync(HOSTS_FILE_PATH, filteredLines.join('\n'));

        message.respond({
            returnValue: true,
            message: 'Removed ' + removedCount + ' update domains from hosts file',
            removedCount: removedCount
        });
    } catch (error) {
        message.respond({
            returnValue: false,
            errorText: error.message
        });
    }
});

var SSH_KEYS_PATH = '/home/root/.ssh/authorized_keys';

service.register('listSSHKeys', function(message) {
    try {
        if (!fs.existsSync('/home/root/.ssh')) {
            message.respond({
                returnValue: true,
                keys: [],
                count: 0,
                message: 'No SSH directory found'
            });
            return;
        }

        if (!fs.existsSync(SSH_KEYS_PATH)) {
            message.respond({
                returnValue: true,
                keys: [],
                count: 0,
                message: 'No authorized_keys file found'
            });
            return;
        }

        var content = fs.readFileSync(SSH_KEYS_PATH, 'utf8');
        var allLines = content.split('\n');
        var lines = allLines.filter(function(line) {
            var trimmed = line.trim();
            return trimmed && trimmed.charAt(0) !== '#';
        });

        var keys = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var parts = line.trim().split(' ');
            if (parts.length >= 2) {
                keys.push({
                    type: parts[0],
                    key: parts[1].substring(0, 20) + '...',
                    comment: parts[2] || 'no comment'
                });
            }
        }

        message.respond({
            returnValue: true,
            keys: keys,
            count: keys.length
        });
    } catch (error) {
        message.respond({
            returnValue: false,
            errorText: error.message
        });
    }
});

service.register('clearSSHKeys', function(message) {
    try {
        if (!fs.existsSync('/home/root/.ssh')) {
            message.respond({
                returnValue: true,
                message: 'No SSH directory found, nothing to clear'
            });
            return;
        }

        if (!fs.existsSync(SSH_KEYS_PATH)) {
            message.respond({
                returnValue: true,
                message: 'No authorized_keys file found, nothing to clear'
            });
            return;
        }

        fs.writeFileSync(SSH_KEYS_PATH, '');

        message.respond({
            returnValue: true,
            message: 'SSH keys cleared successfully'
        });
    } catch (error) {
        message.respond({
            returnValue: false,
            errorText: error.message
        });
    }
});

service.register('addSSHKey', function(message) {
    try {
        var sshKey = message.payload.key;

        if (!sshKey || sshKey.trim() === '') {
            message.respond({
                returnValue: false,
                errorText: 'SSH key cannot be empty'
            });
            return;
        }

        var keyParts = sshKey.trim().split(' ');
        var validTypes = ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ssh-dss'];
        var isValidType = false;
        for (var i = 0; i < validTypes.length; i++) {
            if (validTypes[i] === keyParts[0]) {
                isValidType = true;
                break;
            }
        }

        if (keyParts.length < 2 || !isValidType) {
            message.respond({
                returnValue: false,
                errorText: 'Invalid SSH key format. Key should start with ssh-rsa, ssh-ed25519, etc.'
            });
            return;
        }

        var sshDir = '/home/root/.ssh';
        if (!fs.existsSync(sshDir)) {
            fs.mkdirSync(sshDir);
            fs.chmodSync(sshDir, '700');
        }

        var existingKeys = '';
        if (fs.existsSync(SSH_KEYS_PATH)) {
            existingKeys = fs.readFileSync(SSH_KEYS_PATH, 'utf8');
        }

        if (existingKeys.indexOf(keyParts[1]) !== -1) {
            message.respond({
                returnValue: false,
                errorText: 'This SSH key already exists'
            });
            return;
        }

        var newKey = sshKey.trim() + '\n';
        fs.appendFileSync(SSH_KEYS_PATH, newKey);

        fs.chmodSync(SSH_KEYS_PATH, '600');

        message.respond({
            returnValue: true,
            message: 'SSH key added successfully'
        });
    } catch (error) {
        message.respond({
            returnValue: false,
            errorText: error.message
        });
    }
});
