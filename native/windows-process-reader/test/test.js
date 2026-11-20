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

  console.log('Test 4: The snapshot of the process table...');
  var table = binding.snapshot();
  var own = table.filter(function (entry) {
    return entry.pid === process.pid;
  });
  assert.equal(own.length, 1);
  assert.equal(own[0].name.toLowerCase(), path.basename(process.execPath).toLowerCase());
  assert.equal(own[0].parentPid, process.ppid);
  console.log('✓ Passed (' + table.length + ' processes)\n');

  console.log('Test 5: A job around a child, and what the child starts...');
  var spawn = require('child_process').spawn;
  var STAYS = 'setTimeout(function () {}, 30000)';

  var job = binding.createJob();
  assert.ok(job, 'a job is made');
  assert.deepEqual(binding.jobPids(job), []);
  assert.equal(binding.jobCpuTime(job), 0);
  assert.equal(binding.assignToJob(job, 4294967294), false);
  assert.equal(binding.assignToJob({}, process.pid), false);
  assert.equal(binding.jobPids({}), null);
  assert.equal(binding.jobCpuTime({}), null);

  // The child starts a child of its own, tells its pid, and both stay.
  var starter = spawn(
    process.execPath,
    ['-e', "console.log(require('child_process').spawn(process.execPath, ['-e', '" + STAYS + "']).pid); " + STAYS],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  );
  assert.equal(binding.assignToJob(job, starter.pid), true);
  assert.deepEqual(binding.jobPids(job), [starter.pid]);

  starter.stdout.once('data', function (chunk) {
    var grandchild = Number(String(chunk).trim());
    assert.ok(binding.jobPids(job).indexOf(grandchild) !== -1, 'what the child started after is in the job');

    // The time of a process that ran in the job and ended stays in the job's time.
    var before = binding.jobCpuTime(job);
    var burner = spawn(process.execPath, ['-e', 'var t = Date.now(); while (Date.now() - t < 400) {}'], {
      stdio: 'ignore',
    });
    assert.equal(binding.assignToJob(job, burner.pid), true);
    burner.on('exit', function () {
      assert.ok(binding.jobCpuTime(job) - before > 1e6, 'the time of a process that ended is kept');
      assert.equal(binding.jobPids(job).indexOf(burner.pid), -1);

      // Closing a job ends nothing, and a closed job answers nothing.
      binding.closeJob(job);
      binding.closeJob(job);
      assert.equal(binding.jobPids(job), null);
      assert.equal(binding.jobCpuTime(job), null);
      assert.equal(binding.assignToJob(job, starter.pid), false);
      assert.ok(binding.read(starter.pid), 'the child outlives the job');
      assert.ok(binding.read(grandchild), 'and so does what it started');

      process.kill(grandchild);
      starter.kill();
      console.log('✓ Passed\n');
      console.log('All tests passed.');
    });
  });
}
