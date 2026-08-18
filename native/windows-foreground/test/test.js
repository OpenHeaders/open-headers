var foreground = require('../index');
var assert = require('assert');

console.log('Testing open-headers-windows-foreground module...\n');

if (process.platform === 'win32') {
  console.log('Platform: Windows\n');
  
  // Test 1: allowSetForegroundWindow with own process
  console.log('Test 1: Granting foreground permission to own process...')
  var result = foreground.allowSetForegroundWindow(process.pid);
  assert.equal(result, true);
  console.log('✓ Passed\n');

  // Test 2: allowSetForegroundWindow for all processes
  console.log('Test 2: Granting foreground permission to all processes...')
  result = foreground.allowSetForegroundWindow();
  assert.equal(result, true);
  console.log('✓ Passed\n');
  
  // Test 3: sendMockedKeystroke
  console.log('Test 3: Sending mocked keystroke...')
  result = foreground.sendMockedKeystroke();
  assert.equal(result, true);
  console.log('✓ Passed\n');
  
  // Test 4: getWindowHandleByPID
  console.log('Test 4: Getting window handle for current process...')
  var handle = foreground.getWindowHandleByPID(process.pid);
  // Handle might be null if no visible window, which is OK for console process
  console.log('Handle:', handle);
  console.log('✓ Passed\n');
  
  // Test 5: setForegroundWindow (may fail for console process)
  console.log('Test 5: Attempting to set foreground window for current process...')
  result = foreground.setForegroundWindow(process.pid);
  console.log('Result:', result);
  console.log('✓ Passed (result may vary based on window state)\n');
  
  // Test 6: flashWindow (may not be visible for console process)
  console.log('Test 6: Attempting to flash window for current process...')
  result = foreground.flashWindow(process.pid, 2);
  console.log('Result:', result);
  console.log('✓ Passed (result may vary based on window state)\n');
  
  // Test 7: forceForegroundWindow - the enhanced method
  console.log('Test 7: Testing enhanced forceForegroundWindow method...')
  result = foreground.forceForegroundWindow(process.pid);
  console.log('Result:', result);
  console.log('✓ Passed (result may vary based on window state)\n');
  
  // Test 8: Invalid PID handling
  console.log('Test 8: Testing invalid PID handling...')
  result = foreground.setForegroundWindow(999999);
  assert.equal(result, false);
  console.log('✓ Passed\n');
  
} else {
  console.log('Platform: Non-Windows\n');
  
  // On non-Windows systems, all functions should return false/null
  console.log('Test 1: allowSetForegroundWindow should return false...')
  var result = foreground.allowSetForegroundWindow(process.pid);
  assert.equal(result, false);
  console.log('✓ Passed\n');

  console.log('Test 2: allowSetForegroundWindow without args should return false...')
  result = foreground.allowSetForegroundWindow();
  assert.equal(result, false);
  console.log('✓ Passed\n');
  
  console.log('Test 3: sendMockedKeystroke should return false...')
  result = foreground.sendMockedKeystroke();
  assert.equal(result, false);
  console.log('✓ Passed\n');
  
  console.log('Test 4: getWindowHandleByPID should return null...')
  var handle = foreground.getWindowHandleByPID(process.pid);
  assert.equal(handle, null);
  console.log('✓ Passed\n');
  
  console.log('Test 5: setForegroundWindow should return false...')
  result = foreground.setForegroundWindow(process.pid);
  assert.equal(result, false);
  console.log('✓ Passed\n');
  
  console.log('Test 6: flashWindow should return false...')
  result = foreground.flashWindow(process.pid, 2);
  assert.equal(result, false);
  console.log('✓ Passed\n');
  
  console.log('Test 7: forceForegroundWindow should return false...')
  result = foreground.forceForegroundWindow(process.pid);
  assert.equal(result, false);
  console.log('✓ Passed\n');
}

console.log('========================================');
console.log('All tests completed successfully! ✓');
console.log('========================================');