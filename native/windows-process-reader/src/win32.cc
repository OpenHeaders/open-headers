// The process reader on Windows: one process by its pid, read with no
// process started for the read (the activity monitor plan §7, fork 3).
//
// A process is opened with the LIMITED query right and nothing more —
// never the right to read its memory. What is read of it, and nothing
// else: when it started, its CPU time, its memory counters and the BASE
// name of its executable. It never reads a command line or an
// environment, and an executable's path never leaves this file — only
// its last part.
//
// Times are handed over in the system's own units (100 ns): the
// conversion is the caller's, where it is pinned.

#include <node_api.h>

#define PSAPI_VERSION 2
#include <windows.h>
#include <psapi.h>

#include <cstddef>
#include <cstdint>
#include <vector>

namespace {

napi_value Null(napi_env env) {
  napi_value value;
  napi_get_null(env, &value);
  return value;
}

void SetNumber(napi_env env, napi_value object, const char* name, double number) {
  napi_value value;
  napi_create_double(env, number, &value);
  napi_set_named_property(env, object, name, value);
}

bool NumberArgument(napi_env env, napi_callback_info info, double* number) {
  size_t argc = 1;
  napi_value argv[1];
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok || argc < 1) return false;
  return napi_get_value_double(env, argv[0], number) == napi_ok;
}

// The newer, larger memory counters: the older layout, then the private
// working set — the figure the system's own monitor shows. Declared here
// so the build does not hang on the age of the SDK it meets.
struct MemoryCounters {
  DWORD cb;
  DWORD PageFaultCount;
  SIZE_T PeakWorkingSetSize;
  SIZE_T WorkingSetSize;
  SIZE_T QuotaPeakPagedPoolUsage;
  SIZE_T QuotaPagedPoolUsage;
  SIZE_T QuotaPeakNonPagedPoolUsage;
  SIZE_T QuotaNonPagedPoolUsage;
  SIZE_T PagefileUsage;
  SIZE_T PeakPagefileUsage;
  SIZE_T PrivateUsage;
  SIZE_T PrivateWorkingSetSize;
  ULONG64 SharedCommitUsage;
};

const DWORD kNewerSize = static_cast<DWORD>(sizeof(MemoryCounters));
const DWORD kOlderSize = static_cast<DWORD>(offsetof(MemoryCounters, PrivateWorkingSetSize));

// No process holds this much: a private working set still reading it
// after the call was never written by the system.
const SIZE_T kNotCounted = static_cast<SIZE_T>(-1);

bool ReadMemory(HANDLE process, DWORD size, MemoryCounters* counters) {
  *counters = MemoryCounters{};
  counters->cb = size;
  counters->PrivateWorkingSetSize = kNotCounted;
  return GetProcessMemoryInfo(process, reinterpret_cast<PROCESS_MEMORY_COUNTERS*>(counters), size) != FALSE;
}

uint64_t Ticks(const FILETIME& time) {
  return (static_cast<uint64_t>(time.dwHighDateTime) << 32) | static_cast<uint64_t>(time.dwLowDateTime);
}

// The executable's last part; null where the system would not say.
napi_value ExecutableName(napi_env env, HANDLE process) {
  std::vector<wchar_t> path(MAX_PATH);
  DWORD length = static_cast<DWORD>(path.size());
  if (!QueryFullProcessImageNameW(process, 0, path.data(), &length)) {
    if (GetLastError() != ERROR_INSUFFICIENT_BUFFER) return Null(env);
    // The longest path the system writes.
    path.resize(32768);
    length = static_cast<DWORD>(path.size());
    if (!QueryFullProcessImageNameW(process, 0, path.data(), &length)) return Null(env);
  }

  DWORD start = length;
  while (start > 0 && path[start - 1] != L'\\' && path[start - 1] != L'/') start -= 1;

  napi_value name;
  const char16_t* last = reinterpret_cast<const char16_t*>(path.data() + start);
  if (napi_create_string_utf16(env, last, static_cast<size_t>(length - start), &name) != napi_ok) return Null(env);
  return name;
}

napi_value ReadOpened(napi_env env, HANDLE process) {
  // A process that has exited can still be opened for as long as anyone holds a handle to it.
  DWORD exitCode = 0;
  if (!GetExitCodeProcess(process, &exitCode) || exitCode != STILL_ACTIVE) return Null(env);

  FILETIME created;
  FILETIME exited;
  FILETIME kernel;
  FILETIME user;
  if (!GetProcessTimes(process, &created, &exited, &kernel, &user)) return Null(env);

  // A Windows that does not count the private working set either refuses
  // the larger size or accepts it and writes the older fields alone.
  MemoryCounters counters;
  if (!ReadMemory(process, kNewerSize, &counters) && !ReadMemory(process, kOlderSize, &counters)) return Null(env);

  napi_value result;
  napi_create_object(env, &result);

  napi_value createdFileTime;
  napi_create_bigint_uint64(env, Ticks(created), &createdFileTime);
  napi_set_named_property(env, result, "createdFileTime", createdFileTime);

  SetNumber(env, result, "cpuTime", static_cast<double>(Ticks(kernel) + Ticks(user)));
  SetNumber(env, result, "workingSetBytes", static_cast<double>(counters.WorkingSetSize));
  if (counters.PrivateWorkingSetSize == kNotCounted) {
    napi_set_named_property(env, result, "privateWorkingSetBytes", Null(env));
  } else {
    SetNumber(env, result, "privateWorkingSetBytes", static_cast<double>(counters.PrivateWorkingSetSize));
  }
  napi_set_named_property(env, result, "executableName", ExecutableName(env, process));
  return result;
}

// read(pid) → { createdFileTime, cpuTime, workingSetBytes, privateWorkingSetBytes, executableName }
//   | null when no live process holds the pid, or the system refuses even the limited query.
napi_value Read(napi_env env, napi_callback_info info) {
  double pid;
  if (!NumberArgument(env, info, &pid) || !(pid >= 0.0 && pid <= 4294967295.0)) return Null(env);

  HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, static_cast<DWORD>(pid));
  if (process == nullptr) return Null(env);

  napi_value result = ReadOpened(env, process);
  CloseHandle(process);
  return result;
}

void Export(napi_env env, napi_value exports, const char* name, napi_callback callback) {
  napi_value function;
  napi_create_function(env, name, NAPI_AUTO_LENGTH, callback, nullptr, &function);
  napi_set_named_property(env, exports, name, function);
}

}  // namespace

NAPI_MODULE_INIT() {
  Export(env, exports, "read", Read);
  return exports;
}
