var binding = null;
var tried = false;

/**
 * The native binding, or null where there is none: another platform, or
 * a build that is not there. Nothing is loaded before the first ask.
 */
exports.load = function () {
  if (process.platform !== 'darwin') {
    return null;
  }

  if (!tried) {
    tried = true;
    try {
      // Try prebuilt binaries first, fall back to local build
      try {
        binding = require('./binding');
      } catch (prebuildErr) {
        binding = require('./build/Release/process_reader.node');
      }
    } catch (err) {
      binding = null;
    }
  }

  return binding;
};
