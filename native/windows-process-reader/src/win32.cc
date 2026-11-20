// The process reader on Windows (the activity monitor plan §7, fork 3):
// one process by its pid, the documented snapshot of the process table,
// and a job object closed around a process we started — each read with
// no process started for the read.
//
// A process is opened with the LIMITED query right and nothing more —
// never the right to read its memory. What is read of it, and nothing
// else: when it started, its CPU time, its memory counters and the BASE
// name of its executable. It never reads a command line or an
// environment, and an executable's path never leaves this file — only
// its last part.
//
// A job here watches and never rules: it sets no limit but the one that
// lets a program leave it, and it is never kill-on-close — closing it
// ends nothing. Putting a process in one asks the system for the two
// rights that call needs and uses neither for anything else.
//
// Times are handed over in the system's own units (100 ns): the
// conversion is the caller's, where it is pinned.
//
// The packager rebuilds every native module on every platform it builds
// for: off Windows this file is an empty module, which nothing loads.

#include <node_api.h>

#if defined(_WIN32)

#define PSAPI_VERSION 2
#include <windows.h>
#include <psapi.h>
#include <tlhelp32.h>

#include <cstddef>
#include <cstdint>
#include <cwchar>
#include <vector>

namespace {

napi_value Null(napi_env env) {
  napi_value value;
  napi_get_null(env, &value);
  return value;
}

napi_value BooleanOf(napi_env env, bool value) {
  napi_value result;
  napi_get_boolean(env, value, &result);
  return result;
}

void SetNumber(napi_env env, napi_value object, const char* name, double number) {
  napi_value value;
  napi_create_double(env, number, &value);
  napi_set_named_property(env, object, name, value);
}

// How many of the call's arguments were written to `argv`, of at most `capacity`.
size_t Arguments(napi_env env, napi_callback_info info, napi_value* argv, size_t capacity) {
  size_t argc = capacity;
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok) return 0;
  return argc < capacity ? argc : capacity;
}

bool PidOf(napi_env env, napi_value value, DWORD* pid) {
  double number;
  if (napi_get_value_double(env, value, &number) != napi_ok) return false;
  if (!(number >= 0.0 && number <= 4294967295.0)) return false;
  *pid = static_cast<DWORD>(number);
  return true;
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
  napi_value argv[1];
  DWORD pid;
  if (Arguments(env, info, argv, 1) < 1 || !PidOf(env, argv[0], &pid)) return Null(env);

  HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (process == nullptr) return Null(env);

  napi_value result = ReadOpened(env, process);
  CloseHandle(process);
  return result;
}

// snapshot() → [{ pid, parentPid, name }] — the documented snapshot of the
// process table: the only documented way to a parent id. The name is the
// executable's base name as the system keeps it; no process is opened.
// Empty where the system would not give one.
napi_value Snapshot(napi_env env, napi_callback_info) {
  napi_value entries;
  napi_create_array(env, &entries);

  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) return entries;

  PROCESSENTRY32W entry;
  entry.dwSize = static_cast<DWORD>(sizeof(entry));
  uint32_t index = 0;
  for (BOOL more = Process32FirstW(snapshot, &entry); more; more = Process32NextW(snapshot, &entry)) {
    napi_value row;
    napi_create_object(env, &row);
    SetNumber(env, row, "pid", static_cast<double>(entry.th32ProcessID));
    SetNumber(env, row, "parentPid", static_cast<double>(entry.th32ParentProcessID));

    napi_value name;
    const char16_t* text = reinterpret_cast<const char16_t*>(entry.szExeFile);
    if (napi_create_string_utf16(env, text, wcsnlen(entry.szExeFile, MAX_PATH), &name) != napi_ok) name = Null(env);
    napi_set_named_property(env, row, "name", name);

    napi_set_element(env, entries, index, row);
    index += 1;
  }
  CloseHandle(snapshot);
  return entries;
}

// A job this addon made. The handle is null once it has been closed.
struct Job {
  HANDLE handle;
};

// Marks a job's handle as this addon's own, so no other value is ever read as one.
const napi_type_tag kJobTag = {0x6f68616d6a6f6231ULL, 0x77696e70726f6331ULL};

void FinalizeJob(napi_env, void* data, void*) {
  Job* job = static_cast<Job*>(data);
  // Never kill-on-close: letting go of a job nobody closed ends nothing.
  if (job->handle != nullptr) CloseHandle(job->handle);
  delete job;
}

// The open job behind a value handed back by createJob; null for anything else, and once it is closed.
Job* JobOf(napi_env env, napi_value value) {
  bool tagged = false;
  if (napi_check_object_type_tag(env, value, &kJobTag, &tagged) != napi_ok || !tagged) return nullptr;
  void* data = nullptr;
  if (napi_get_value_external(env, value, &data) != napi_ok || data == nullptr) return nullptr;
  Job* job = static_cast<Job*>(data);
  return job->handle == nullptr ? nullptr : job;
}

// createJob() → a job | null. Its one limit lets a program that asks to
// leave it go, as it would in any other terminal; it is never
// kill-on-close.
napi_value CreateJob(napi_env env, napi_callback_info) {
  HANDLE handle = CreateJobObjectW(nullptr, nullptr);
  if (handle == nullptr) return Null(env);

  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits = {};
  limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_BREAKAWAY_OK;
  if (!SetInformationJobObject(handle, JobObjectExtendedLimitInformation, &limits, static_cast<DWORD>(sizeof(limits)))) {
    CloseHandle(handle);
    return Null(env);
  }

  Job* job = new Job{handle};
  napi_value external;
  if (napi_create_external(env, job, FinalizeJob, nullptr, &external) != napi_ok) {
    CloseHandle(handle);
    delete job;
    return Null(env);
  }
  if (napi_type_tag_object(env, external, &kJobTag) != napi_ok) return Null(env);
  return external;
}

// assignToJob(job, pid) → whether the process is now in the job. What it
// starts from then on is in the job too; what it started before is not.
napi_value AssignToJob(napi_env env, napi_callback_info info) {
  napi_value argv[2];
  DWORD pid;
  if (Arguments(env, info, argv, 2) < 2 || !PidOf(env, argv[1], &pid)) return BooleanOf(env, false);
  Job* job = JobOf(env, argv[0]);
  if (job == nullptr) return BooleanOf(env, false);

  // The two rights the call asks of the process's handle; neither is used for anything else.
  HANDLE process = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, FALSE, pid);
  if (process == nullptr) return BooleanOf(env, false);

  BOOL assigned = AssignProcessToJobObject(job->handle, process);
  CloseHandle(process);
  return BooleanOf(env, assigned != FALSE);
}

// jobPids(job) → the pids alive in the job | null where the system would not say.
napi_value JobPids(napi_env env, napi_callback_info info) {
  napi_value argv[1];
  if (Arguments(env, info, argv, 1) < 1) return Null(env);
  Job* job = JobOf(env, argv[0]);
  if (job == nullptr) return Null(env);

  // The list's head is two counts — the size of one pid slot on a 64-bit
  // system, of two on a 32-bit one; the pids follow it.
  const size_t kHeadSlots = 2;
  size_t capacity = 64;
  for (int attempt = 0; attempt < 8; attempt += 1) {
    std::vector<ULONG_PTR> buffer(kHeadSlots + capacity);
    JOBOBJECT_BASIC_PROCESS_ID_LIST* list = reinterpret_cast<JOBOBJECT_BASIC_PROCESS_ID_LIST*>(buffer.data());
    DWORD bytes = static_cast<DWORD>(buffer.size() * sizeof(ULONG_PTR));
    if (QueryInformationJobObject(job->handle, JobObjectBasicProcessIdList, list, bytes, nullptr)) {
      napi_value pids;
      napi_create_array(env, &pids);
      for (DWORD index = 0; index < list->NumberOfProcessIdsInList; index += 1) {
        napi_value pid;
        napi_create_double(env, static_cast<double>(list->ProcessIdList[index]), &pid);
        napi_set_element(env, pids, index, pid);
      }
      return pids;
    }
    if (GetLastError() != ERROR_MORE_DATA) return Null(env);
    // The job grew past the buffer: the head still says how many it holds.
    size_t held = static_cast<size_t>(list->NumberOfAssignedProcesses);
    capacity = (held > capacity ? held : capacity) * 2;
  }
  return Null(env);
}

// jobCpuTime(job) → the CPU time, user and kernel, in 100 ns units, of
// every process that has run in the job — those that have ended
// included | null where the system would not say.
napi_value JobCpuTime(napi_env env, napi_callback_info info) {
  napi_value argv[1];
  if (Arguments(env, info, argv, 1) < 1) return Null(env);
  Job* job = JobOf(env, argv[0]);
  if (job == nullptr) return Null(env);

  JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting;
  DWORD bytes = static_cast<DWORD>(sizeof(accounting));
  if (!QueryInformationJobObject(job->handle, JobObjectBasicAccountingInformation, &accounting, bytes, nullptr)) {
    return Null(env);
  }

  napi_value ticks;
  napi_create_double(env, static_cast<double>(accounting.TotalUserTime.QuadPart + accounting.TotalKernelTime.QuadPart), &ticks);
  return ticks;
}

// closeJob(job) — lets go of the job. Ends nothing; a second call is nothing.
napi_value CloseJob(napi_env env, napi_callback_info info) {
  napi_value argv[1];
  if (Arguments(env, info, argv, 1) >= 1) {
    Job* job = JobOf(env, argv[0]);
    if (job != nullptr) {
      CloseHandle(job->handle);
      job->handle = nullptr;
    }
  }
  napi_value undefined;
  napi_get_undefined(env, &undefined);
  return undefined;
}

void Export(napi_env env, napi_value exports, const char* name, napi_callback callback) {
  napi_value function;
  napi_create_function(env, name, NAPI_AUTO_LENGTH, callback, nullptr, &function);
  napi_set_named_property(env, exports, name, function);
}

}  // namespace

NAPI_MODULE_INIT() {
  Export(env, exports, "read", Read);
  Export(env, exports, "snapshot", Snapshot);
  Export(env, exports, "createJob", CreateJob);
  Export(env, exports, "assignToJob", AssignToJob);
  Export(env, exports, "jobPids", JobPids);
  Export(env, exports, "jobCpuTime", JobCpuTime);
  Export(env, exports, "closeJob", CloseJob);
  return exports;
}

#else

NAPI_MODULE_INIT() {
  return exports;
}

#endif
