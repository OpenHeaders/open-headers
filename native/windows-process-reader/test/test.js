var assert = require('assert');
var path = require('path');
var reader = require('../index');

console.log('Testing windows-process-reader module...\n');

var binding = reader.load();

if (process.platform !== 'win32') {
  assert.equal(binding, null);
  console.log('Platform: ' + process.platform + ' — no binding here, as expected\n');
} else {
  assert.ok(binding, 'the binding is built');

  // The system's file time counts 100 ns units from 1601; ms since epoch count from 1970.
  var EPOCH_FILE_TIME = 116444736000000000n;

  console.log('Test 1: This process...');
  var self = binding.read(process.pid);
  assert.ok(self, 'this process is read');
  assert.equal(self.executableName, path.basename(process.execPath));
  var startedAtMs = Number((self.createdFileTime - EPOCH_FILE_TIME) / 10000n);
  assert.ok(Math.abs(startedAtMs - (Date.now() - process.uptime() * 1000)) < 2000);
  var runtime = process.cpuUsage();
  assert.ok(Math.abs(self.cpuTime / 1e7 - (runtime.user + runtime.system) / 1e6) < 0.25);
  assert.ok(self.workingSetBytes > 1024 * 1024);
  console.log('✓ Passed\n');

  console.log('Test 2: The private working set, where this Windows counts it...');
  if (self.privateWorkingSetBytes === null) {
    console.log('✓ Not counted on this Windows — the working set stands in\n');
  } else {
    assert.ok(self.privateWorkingSetBytes > 0);
    assert.ok(self.privateWorkingSetBytes <= self.workingSetBytes);
    console.log(
      '✓ Passed (' + self.privateWorkingSetBytes + ' private of ' + self.workingSetBytes + ' bytes held)\n',
    );
  }

  console.log('Test 3: A pid no process holds...');
  assert.equal(binding.read(0), null);
  assert.equal(binding.read(4294967294), null);
  assert.equal(binding.read(-1), null);
  assert.equal(binding.read(), null);
  console.log('✓ Passed\n');

  console.log('All tests passed.');
}
