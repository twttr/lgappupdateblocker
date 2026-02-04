import "webostvjs/webOSTV";

var SERVICE_URI = "luna://org.webosbrew.appupdateblocker.service";

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

var debugLogEl = document.getElementById('debugLog');
var debugOverlay = document.getElementById('debugOverlay');
var debugToggleBtn = document.getElementById('debugToggle');
var debugClearBtn = document.getElementById('debugClear');

if (typeof __DEBUG__ !== 'undefined' && __DEBUG__) {
    debugOverlay.classList.add('visible');

    var originalConsoleLog = console.log.bind(console);
    var originalConsoleError = console.error.bind(console);
    var originalConsoleWarn = console.warn.bind(console);

    function getTimestamp() {
        var now = new Date();
        var ms = String(now.getMilliseconds());
        while (ms.length < 3) ms = '0' + ms;
        return now.toLocaleTimeString('en-US', { hour12: false }) + '.' + ms;
    }

    function addDebugEntry(message, type) {
        var entry = document.createElement('div');
        entry.className = 'log-entry ' + (type || 'log');
        entry.textContent = '[' + getTimestamp() + '] ' + message;
        debugLogEl.appendChild(entry);
        debugLogEl.scrollTop = debugLogEl.scrollHeight;
    }

    console.log = function() {
        var args = Array.prototype.slice.call(arguments);
        originalConsoleLog.apply(console, args);
        var msg = args.map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' ');
        addDebugEntry(msg, 'log');
    };

    console.error = function() {
        var args = Array.prototype.slice.call(arguments);
        originalConsoleError.apply(console, args);
        var msg = args.map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' ');
        addDebugEntry(msg, 'error');
    };

    console.warn = function() {
        var args = Array.prototype.slice.call(arguments);
        originalConsoleWarn.apply(console, args);
        var msg = args.map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' ');
        addDebugEntry(msg, 'warn');
    };

    debugToggleBtn.onclick = function() {
        if (debugOverlay.classList.contains('collapsed')) {
            debugOverlay.classList.remove('collapsed');
            debugToggleBtn.textContent = 'Hide';
        } else {
            debugOverlay.classList.add('collapsed');
            debugToggleBtn.textContent = 'Show';
        }
    };

    debugClearBtn.onclick = function() {
        debugLogEl.innerHTML = '';
        console.log('Debug log cleared');
    };

    console.log('Debug overlay initialized');
}

function serviceRequestWithTimeout(uri, method, params, onSuccess, onFailure, timeoutMs = 5000) {
    let responded = false;
    const timeoutId = setTimeout(() => {
        if (!responded) {
            responded = true;
            console.error('SERVICE TIMEOUT after ' + timeoutMs + 'ms: ' + method);
            console.error('This usually means the service is not running or not elevated');
            onFailure({ errorCode: -1, errorText: 'Request timed out - service may not be running' });
        }
    }, timeoutMs);

    webOS.service.request(uri, {
        method: method,
        parameters: params,
        onSuccess: function(res) {
            if (!responded) {
                responded = true;
                clearTimeout(timeoutId);
                onSuccess(res);
            }
        },
        onFailure: function(error) {
            if (!responded) {
                responded = true;
                clearTimeout(timeoutId);
                onFailure(error);
            }
        }
    });
}

const responseEl = document.getElementById('response');
const updateInfoEl = document.getElementById('updateInfoContent');
const refreshBtn = document.getElementById('refreshUpdateInfo');
const clearBtn = document.getElementById('clearUpdateInfo');
const hostsStatusEl = document.getElementById('hostsStatus');
const addDomainsBtn = document.getElementById('addUpdateDomains');
const removeDomainsBtn = document.getElementById('removeUpdateDomains');
const persistentStatusEl = document.getElementById('persistentScriptStatus');
const installPersistentBtn = document.getElementById('installPersistentScript');
const removePersistentBtn = document.getElementById('removePersistentScript');
const sshKeysContentEl = document.getElementById('sshKeysContent');
const refreshSSHKeysBtn = document.getElementById('refreshSSHKeys');
const clearSSHKeysBtn = document.getElementById('clearSSHKeys');
const sshKeyInput = document.getElementById('sshKeyInput');
const addSSHKeyBtn = document.getElementById('addSSHKey');
let serviceElevated = false;

function showMessage(message, isError = false) {
    responseEl.className = isError ? 'response error' : 'response';
    responseEl.innerText = message;
    responseEl.style.display = 'block';
    setTimeout(() => {
        responseEl.style.display = 'none';
    }, 5000);
}

function formatUpdateInfo(content) {
    if (!content) return '<p>No blocked apps</p>';
    
    try {
        const data = JSON.parse(content);
        if (!Array.isArray(data) || data.length === 0) {
            return '<p>No blocked apps</p>';
        }
        
        // Apps are blocked - create a formatted list
        const appIds = data.map(app => app.id).filter(id => id);
        const listItems = appIds.map(id => `<li>${escapeHtml(id)}</li>`).join('');
        
        const html = '<div class="blocked-apps-warning">Apps blocked until update:</div>' +
                    '<ul style="margin-top: 10px; padding-left: 20px;">' + listItems + '</ul>';
        return html;
    } catch (e) {
        return '<p>Error parsing blocked apps data</p>';
    }
}

function enableButtons() {
    refreshBtn.disabled = false;
    clearBtn.disabled = false;
    addDomainsBtn.disabled = false;
    removeDomainsBtn.disabled = false;
    installPersistentBtn.disabled = false;
    removePersistentBtn.disabled = false;
    refreshSSHKeysBtn.disabled = false;
    clearSSHKeysBtn.disabled = false;
    sshKeyInput.disabled = false;
    addSSHKeyBtn.disabled = false;
    serviceElevated = true;
}

function checkHostsStatus() {
    console.log('Calling checkHostsStatus...');
    serviceRequestWithTimeout(
        SERVICE_URI,
        "checkHostsStatus",
        {},
        function (res) {
            console.log('checkHostsStatus SUCCESS:', res);
            if (res.blockedDomainsCount > 0) {
                hostsStatusEl.innerText = `${res.blockedDomainsCount} update domains are currently blocked`;
                hostsStatusEl.style.color = 'var(--success-color)';
                if (serviceElevated) {
                    addDomainsBtn.disabled = true;
                    removeDomainsBtn.disabled = false;
                }
            } else {
                hostsStatusEl.innerText = 'No update domains are currently blocked';
                hostsStatusEl.style.color = 'var(--error-color)';
                if (serviceElevated) {
                    addDomainsBtn.disabled = false;
                    removeDomainsBtn.disabled = true;
                }
            }
        },
        function (error) {
            console.error('checkHostsStatus FAILED:', error);
            hostsStatusEl.innerText = 'Failed to check hosts file status';
            hostsStatusEl.style.color = 'var(--error-color)';
        }
    );
}

function checkPersistentScript() {
    console.log('Calling checkPersistentScript...');
    serviceRequestWithTimeout(
        SERVICE_URI,
        "checkPersistentScript",
        {},
        function (res) {
            console.log('checkPersistentScript SUCCESS:', res);
            if (res.exists) {
                persistentStatusEl.innerText = 'Persistent script is installed';
                persistentStatusEl.style.color = 'var(--success-color)';
                if (serviceElevated) {
                    installPersistentBtn.disabled = true;
                    removePersistentBtn.disabled = false;
                }
            } else {
                persistentStatusEl.innerText = 'Persistent script is not installed';
                persistentStatusEl.style.color = 'var(--error-color)';
                if (serviceElevated) {
                    installPersistentBtn.disabled = false;
                    removePersistentBtn.disabled = true;
                }
            }
        },
        function (error) {
            console.error('checkPersistentScript FAILED:', error);
            persistentStatusEl.innerText = 'Failed to check persistent script status';
            persistentStatusEl.style.color = 'var(--error-color)';
        }
    );
}

function loadSSHKeys() {
    console.log('Calling listSSHKeys...');
    serviceRequestWithTimeout(
        SERVICE_URI,
        "listSSHKeys",
        {},
        function (res) {
            console.log('listSSHKeys SUCCESS:', res);
            if (res.count === 0) {
                sshKeysContentEl.innerHTML = '<p>No SSH keys found</p>';
                if (serviceElevated) {
                    clearSSHKeysBtn.disabled = true;
                }
            } else {
                const keysList = res.keys.map(key =>
                    `<li><strong>${escapeHtml(key.type)}</strong>: ${escapeHtml(key.key)} <em>(${escapeHtml(key.comment)})</em></li>`
                ).join('');
                sshKeysContentEl.innerHTML = `<p>Found ${res.count} SSH key(s):</p><ul style="margin: 10px 0; padding-left: 20px;">${keysList}</ul>`;
                if (serviceElevated) {
                    clearSSHKeysBtn.disabled = false;
                }
            }
        },
        function (error) {
            console.error('listSSHKeys FAILED:', error);
            sshKeysContentEl.innerHTML = '<p>Failed to load SSH keys: ' + error.errorText + '</p>';
        }
    );
}

function loadUpdateInfo() {
    console.log('Calling readUpdateInfo...');
    serviceRequestWithTimeout(
        SERVICE_URI,
        "readUpdateInfo",
        {},
        function (res) {
            console.log('readUpdateInfo SUCCESS:', res);
            updateInfoEl.innerHTML = formatUpdateInfo(res.content);
            if (serviceElevated && res.content) {
                try {
                    const data = JSON.parse(res.content);
                    clearBtn.disabled = !data || data.length === 0;
                } catch (e) {
                    clearBtn.disabled = true;
                }
            }
        },
        function (error) {
            console.error('readUpdateInfo FAILED:', error);
            updateInfoEl.innerHTML = "<p>Failed to read blocked apps status: " + error.errorText + "</p>";
        }
    );
}

console.log("App starting - checking for root...");
console.log("Calling luna://org.webosbrew.hbchannel.service/getConfiguration");
webOS.service.request("luna://org.webosbrew.hbchannel.service", {
    method: "getConfiguration",
    parameters: {},
    onSuccess: function (config) {
        console.log("getConfiguration SUCCESS:", config);
        if (config.root) {
            console.log("Homebrew channel has root=true, attempting to elevate service...");
            console.log("Calling luna://org.webosbrew.hbchannel.service/exec");
            webOS.service.request("luna://org.webosbrew.hbchannel.service", {
                method: "exec",
                parameters: {"command": "/media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service/elevate-service org.webosbrew.appupdateblocker.service"},
                onSuccess: function (response) {
                    console.log("exec (elevate-service) SUCCESS:", response);
                    console.log("Service is now elevated - enabling buttons");
                    showMessage("Service elevated successfully");
                    enableButtons();
                    loadUpdateInfo();
                    checkHostsStatus();
                    checkPersistentScript();
                    loadSSHKeys();
                },
                onFailure: function (error) {
                    console.error("exec (elevate-service) FAILED!");
                    console.error("Error code:", error.errorCode);
                    console.error("Error text:", error.errorText);
                    showMessage("Failed to elevate service: " + error.errorText, true);
                    return;
                }
            });
        } else {
            console.warn("config.root is false or undefined!");
            console.warn("Homebrew channel must have root enabled!");
            showMessage("Homebrew channel must have root!", true);
        }
    },
    onFailure: function (error) {
        console.error("getConfiguration FAILED!");
        console.error("Error code:", error.errorCode);
        console.error("Error text:", error.errorText);
        console.error("Make sure: 1) Homebrew Channel is installed, 2) TV is rooted, 3) Root status shows 'ok' in HB Channel settings");
        showMessage("Failed to check for root: " + error.errorText, true);
        return;
    }
});


document.getElementById('refreshUpdateInfo').onclick = function() {
    updateInfoEl.innerHTML = '<p>Loading...</p>';
    loadUpdateInfo();
}

document.getElementById('clearUpdateInfo').onclick = function() {
    console.log('Calling clearUpdateInfo...');
    serviceRequestWithTimeout(
        SERVICE_URI,
        "clearUpdateInfo",
        {},
        function (res) {
            console.log('clearUpdateInfo SUCCESS:', res);
            showMessage(res.message);
            loadUpdateInfo();
        },
        function (error) {
            console.error('clearUpdateInfo FAILED:', error);
            showMessage("Failed to remove forced update apps: " + error.errorText, true);
        }
    );
}

document.getElementById('addUpdateDomains').onclick = function() {
    console.log('Calling addUpdateDomains...');
    serviceRequestWithTimeout(
        SERVICE_URI,
        "addUpdateDomains",
        {},
        function (res) {
            console.log('addUpdateDomains SUCCESS:', res);
            showMessage(res.message);
            checkHostsStatus();
        },
        function (error) {
            console.error('addUpdateDomains FAILED:', error);
            showMessage("Failed to add update domains: " + error.errorText, true);
        }
    );
}

document.getElementById('removeUpdateDomains').onclick = function() {
    console.log('Calling removeUpdateDomains...');
    serviceRequestWithTimeout(
        SERVICE_URI,
        "removeUpdateDomains",
        {},
        function (res) {
            console.log('removeUpdateDomains SUCCESS:', res);
            showMessage(res.message);
            checkHostsStatus();
        },
        function (error) {
            console.error('removeUpdateDomains FAILED:', error);
            showMessage("Failed to remove update domains: " + error.errorText, true);
        }
    );
}

document.getElementById('installPersistentScript').onclick = function() {
    console.log('Calling installPersistentScript...');
    serviceRequestWithTimeout(
        SERVICE_URI,
        "installPersistentScript",
        {},
        function (res) {
            console.log('installPersistentScript SUCCESS:', res);
            showMessage(res.message);
            checkPersistentScript();
        },
        function (error) {
            console.error('installPersistentScript FAILED:', error);
            showMessage("Failed to install persistent script: " + error.errorText, true);
        }
    );
}

document.getElementById('removePersistentScript').onclick = function() {
    console.log('Calling removePersistentScript...');
    serviceRequestWithTimeout(
        SERVICE_URI,
        "removePersistentScript",
        {},
        function (res) {
            console.log('removePersistentScript SUCCESS:', res);
            showMessage(res.message);
            checkPersistentScript();
        },
        function (error) {
            console.error('removePersistentScript FAILED:', error);
            showMessage("Failed to remove persistent script: " + error.errorText, true);
        }
    );
}

document.getElementById('refreshSSHKeys').onclick = function() {
    sshKeysContentEl.innerHTML = '<p>Loading...</p>';
    loadSSHKeys();
}

document.getElementById('clearSSHKeys').onclick = function() {
    if (confirm('Are you sure you want to clear all SSH keys? This will remove root SSH access.')) {
        console.log('Calling clearSSHKeys...');
        serviceRequestWithTimeout(
            SERVICE_URI,
            "clearSSHKeys",
            {},
            function (res) {
                console.log('clearSSHKeys SUCCESS:', res);
                showMessage(res.message);
                loadSSHKeys();
            },
            function (error) {
                console.error('clearSSHKeys FAILED:', error);
                showMessage("Failed to clear SSH keys: " + error.errorText, true);
            }
        );
    }
}

document.getElementById('addSSHKey').onclick = function() {
    const sshKey = sshKeyInput.value.trim();

    if (!sshKey) {
        console.warn('addSSHKey: No key provided');
        showMessage("Please enter an SSH key", true);
        return;
    }

    console.log('Calling addSSHKey...');
    serviceRequestWithTimeout(
        SERVICE_URI,
        "addSSHKey",
        { key: sshKey },
        function (res) {
            console.log('addSSHKey SUCCESS:', res);
            showMessage(res.message);
            sshKeyInput.value = '';
            loadSSHKeys();
        },
        function (error) {
            console.error('addSSHKey FAILED:', error);
            showMessage("Failed to add SSH key: " + error.errorText, true);
        }
    );
}