var foregroundModule = null;
var tried = false;

function getForegroundModule() {
  if (process.platform !== 'win32') {
    return null;
  }

  if (!tried) {
    tried = true;
    try {
      // Try prebuilt binaries first, fall back to local build
      try {
        foregroundModule = require('./binding');
      } catch (prebuildErr) {
        console.warn('Prebuilt binary not found, trying local build:', prebuildErr.message);
        foregroundModule = require('./build/Release/foreground');
      }
    } catch (err) {
      console.error('Failed to load native module:', err);
    }
  }

  return foregroundModule;
}

exports.allowSetForegroundWindow = function (pid) {
  var module = getForegroundModule();
  if (!module) {
    return false;
  }

  try {
    return module.allowSetForegroundWindow(pid);
  } catch (err) {
    console.error('allowSetForegroundWindow error:', err);
    return false;
  }
};

exports.setForegroundWindow = function (pid) {
  var module = getForegroundModule();
  if (!module) {
    return false;
  }

  try {
    // First try sending mocked keystroke to satisfy Windows requirements
    module.sendMockedKeystroke();
    // Then attempt to set foreground window
    return module.setForegroundWindow(pid);
  } catch (err) {
    console.error('setForegroundWindow error:', err);
    return false;
  }
};

exports.setForegroundWindowByHandle = function (handle) {
  var module = getForegroundModule();
  if (!module) {
    return false;
  }

  try {
    // First try sending mocked keystroke to satisfy Windows requirements
    module.sendMockedKeystroke();
    // Then attempt to set foreground window
    return module.setForegroundWindowByHandle(handle);
  } catch (err) {
    console.error('setForegroundWindowByHandle error:', err);
    return false;
  }
};

exports.getWindowHandleByPID = function (pid) {
  var module = getForegroundModule();
  if (!module) {
    return null;
  }

  try {
    return module.getWindowHandleByPID(pid);
  } catch (err) {
    console.error('getWindowHandleByPID error:', err);
    return null;
  }
};

exports.flashWindow = function (pid, count) {
  var module = getForegroundModule();
  if (!module) {
    return false;
  }

  try {
    return module.flashWindow(pid, count);
  } catch (err) {
    console.error('flashWindow error:', err);
    return false;
  }
};

exports.sendMockedKeystroke = function () {
  var module = getForegroundModule();
  if (!module) {
    return false;
  }

  try {
    return module.sendMockedKeystroke();
  } catch (err) {
    console.error('sendMockedKeystroke error:', err);
    return false;
  }
};

// Enhanced convenience method that tries multiple strategies
exports.forceForegroundWindow = function (pid) {
  var module = getForegroundModule();
  if (!module) {
    return false;
  }

  try {
    // Strategy 1: Send mocked keystroke first (helps with notification scenarios)
    module.sendMockedKeystroke();
    
    // Strategy 2: Allow set foreground window for the process
    module.allowSetForegroundWindow(pid);
    
    // Strategy 3: Try to set foreground window (uses multiple internal strategies)
    var result = module.setForegroundWindow(pid);
    
    // Strategy 4: If failed, try flashing the window to at least notify user
    if (!result) {
      module.flashWindow(pid, 3);
    }
    
    return result;
  } catch (err) {
    console.error('forceForegroundWindow error:', err);
    return false;
  }
};