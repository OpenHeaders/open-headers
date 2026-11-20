var assert = require('assert');
var path = require('path');
var reader = require('../index');

console.log('Testing process-reader module...\n');

var binding = reader.load();

if (process.platform !== 'darwin') {
  assert.equal(binding, null);
  console.log('Platform: ' + process.platform + ' — no binding here, as expected\n');
} else {
  assert.ok(binding, 'the binding is built');

  console.log('Test 1: The timebase...');
  var timebase = binding.timebase();
  assert.ok(timebase.numer > 0 && timebase.denom > 0);
  console.log('✓ Passed (' + timebase.numer + '/' + timebase.denom + ')\n');

  console.log('Test 2: This process...');
  var info = binding.info(process.pid);
  assert.equal(info.parentPid, process.ppid);
  assert.equal(info.executableName, path.basename(process.execPath));
  assert.ok(Math.abs(info.startedAtMs - (Date.now() - process.uptime() * 1000)) < 2000);
  var usage = binding.usage(process.pid);
  assert.ok(usage.userTime > 0);
  assert.ok(usage.footprintBytes > 0);
  console.log('✓ Passed\n');

  console.log('Test 3: This process among its parent’s children...');
  assert.ok(binding.childPids(process.ppid).indexOf(process.pid) !== -1);
  console.log('✓ Passed\n');

  console.log('Test 4: A pid no process holds...');
  assert.equal(binding.info(999999), null);
  assert.equal(binding.usage(999999), null);
  assert.deepEqual(binding.childPids(999999), []);
  assert.deepEqual(binding.terminalPids(-1), []);
  console.log('✓ Passed\n');

  console.log('All tests passed.');
}
