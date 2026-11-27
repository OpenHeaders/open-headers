var assert = require('assert');
var update = require('../index');

console.log('Testing windows-package-update module...\n');

var binding = update.load();

if (process.platform !== 'win32') {
  assert.equal(binding, null);
  console.log('Platform: ' + process.platform + ' — no binding here, as expected\n');
} else {
  assert.ok(binding, 'the binding is built');

  // Nothing here asks Windows to add or register a package: every ask
  // below is one Windows, or the addon before it, turns down. That holds
  // for a run from OUTSIDE a package, which is where this file is run:
  // inside one, the last test would be a real registration.
  function refused(promise, pattern, label) {
    assert.ok(promise instanceof Promise, label + ': a promise is handed back');
    return promise.then(
      function () {
        assert.fail(label + ': it was not refused');
      },
      function (err) {
        assert.ok(err instanceof Error, label + ': the refusal is an error');
        assert.match(err.message, pattern, label);
      },
    );
  }

  var TAKES = /^stage takes a package's link and a function that hears the percentage$/;
  var heard = [];
  function hear(percent) {
    heard.push(percent);
  }

  Promise.resolve()
    .then(function () {
      console.log('Test 1: The two asks, and nothing else...');
      assert.deepEqual(Object.keys(binding).sort(), ['register', 'stage']);
      console.log('✓ Passed\n');
    })
    .then(function () {
      console.log('Test 2: A stage with no link, or nobody to hear it...');
      return Promise.all([
        refused(binding.stage(), TAKES, 'no arguments'),
        refused(binding.stage('', hear), TAKES, 'an empty link'),
        refused(binding.stage(42, hear), TAKES, 'a link that is not text'),
        refused(binding.stage('https://updates.openheaders.io/a.msix'), TAKES, 'no function'),
        refused(binding.stage('https://updates.openheaders.io/a.msix', 'hear'), TAKES, 'a function that is not one'),
      ]);
    })
    .then(function () {
      console.log('✓ Passed\n');
      console.log('Test 3: A link Windows cannot read...');
      // Refused where Windows reads the link, before its package manager is asked for anything.
      return refused(
        binding.stage('not a link', hear),
        /^0x[0-9A-F]{8} Windows could not read the package's link$/,
        'a link that is not one',
      );
    })
    .then(function () {
      assert.deepEqual(heard, [], 'no percentage for a stage that never began');
      console.log('✓ Passed\n');
      console.log('Test 4: A registration from a process with no package identity...');
      return refused(binding.register(), /^this process has no package identity$/, 'outside a package');
    })
    .then(function () {
      console.log('✓ Passed\n');
      console.log('All tests passed.');
    })
    .catch(function (err) {
      console.error(err);
      process.exit(1);
    });
}
