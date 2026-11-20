// The process reader on macOS: the system's process library, read with
// no process started for the read (the activity monitor plan §7, fork 3).
//
// What it reads of a process, and nothing else: its parent, its start,
// its controlling terminal, the BASE name of its executable, its CPU
// time and its memory. It never reads a command line or an environment,
// and an executable's path never leaves this file — only its last part.
//
// Times are handed over in the kernel's own units, with the timebase to
// convert them: the conversion is the caller's, where it is pinned.
//
// The packager rebuilds every native module on every platform it builds
// for: off macOS this file is an empty module, which nothing loads.

#include <node_api.h>

#if defined(__APPLE__)

#include <libproc.h>
#include <mach/mach_time.h>
#include <sys/param.h>
#include <sys/proc_info.h>
#include <sys/resource.h>
#include <sys/sysctl.h>
#include <sys/types.h>

#include <cstdint>
#include <cstring>
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

// The pids one of the system's listings holds — by parent, or by terminal.
// The listing is sized by asking first; a few slots more cover a process
// that starts between the two calls.
napi_value ListPids(napi_env env, uint32_t type, uint32_t typeinfo) {
  napi_value pids;
  napi_create_array(env, &pids);
  const int needed = proc_listpids(type, typeinfo, nullptr, 0);
  if (needed <= 0) return pids;
  std::vector<int> buffer(static_cast<size_t>(needed) / sizeof(int) + 16);
  const int written = proc_listpids(type, typeinfo, buffer.data(), static_cast<int>(buffer.size() * sizeof(int)));
  uint32_t index = 0;
  for (int slot = 0; slot < written / static_cast<int>(sizeof(int)); slot += 1) {
    if (buffer[slot] <= 0) continue;
    napi_value pid;
    napi_create_int32(env, buffer[slot], &pid);
    napi_set_element(env, pids, index, pid);
    index += 1;
  }
  return pids;
}

// timebase() → { numer, denom }: a count of the kernel's units × numer / denom is nanoseconds.
napi_value Timebase(napi_env env, napi_callback_info) {
  mach_timebase_info_data_t timebase;
  mach_timebase_info(&timebase);
  napi_value result;
  napi_create_object(env, &result);
  SetNumber(env, result, "numer", timebase.numer);
  SetNumber(env, result, "denom", timebase.denom);
  return result;
}

// info(pid) → { parentPid, startedAtMs, executableName, terminal } | null when no process holds the pid.
napi_value Info(napi_env env, napi_callback_info info) {
  double pid;
  if (!NumberArgument(env, info, &pid)) return Null(env);

  // The kernel's process table entry, which it answers for every process —
  // the process library's own record is refused for another user's.
  int name[4] = {CTL_KERN, KERN_PROC, KERN_PROC_PID, static_cast<int>(pid)};
  struct kinfo_proc entry;
  size_t size = sizeof(entry);
  if (sysctl(name, 4, &entry, &size, nullptr, 0) != 0 || size < sizeof(entry)) return Null(env);

  const struct timeval started = entry.kp_proc.p_starttime;
  const dev_t terminal = entry.kp_eproc.e_tdev;

  napi_value result;
  napi_create_object(env, &result);
  SetNumber(env, result, "parentPid", entry.kp_eproc.e_ppid);
  SetNumber(env, result, "startedAtMs",
            static_cast<double>(started.tv_sec) * 1000.0 + static_cast<double>(started.tv_usec / 1000));
  SetNumber(env, result, "terminal", terminal == NODEV ? -1.0 : static_cast<double>(static_cast<uint32_t>(terminal)));

  // The executable's last part; where the path is refused, the name the
  // kernel took from it when the process was started.
  char path[PROC_PIDPATHINFO_MAXSIZE];
  napi_value executable;
  if (proc_pidpath(static_cast<int>(pid), path, sizeof(path)) > 0) {
    const char* slash = std::strrchr(path, '/');
    napi_create_string_utf8(env, slash == nullptr ? path : slash + 1, NAPI_AUTO_LENGTH, &executable);
  } else if (entry.kp_proc.p_comm[0] != '\0') {
    napi_create_string_utf8(env, entry.kp_proc.p_comm, strnlen(entry.kp_proc.p_comm, MAXCOMLEN), &executable);
  } else {
    executable = Null(env);
  }
  napi_set_named_property(env, result, "executableName", executable);
  return result;
}

// usage(pid) → the process's times and memory | null when the kernel refuses — another user's process.
napi_value Usage(napi_env env, napi_callback_info info) {
  double pid;
  if (!NumberArgument(env, info, &pid)) return Null(env);

  struct rusage_info_v2 usage;
  if (proc_pid_rusage(static_cast<int>(pid), RUSAGE_INFO_V2, reinterpret_cast<rusage_info_t*>(&usage)) != 0) {
    return Null(env);
  }

  napi_value result;
  napi_create_object(env, &result);
  SetNumber(env, result, "userTime", static_cast<double>(usage.ri_user_time));
  SetNumber(env, result, "systemTime", static_cast<double>(usage.ri_system_time));
  SetNumber(env, result, "exitedChildrenUserTime", static_cast<double>(usage.ri_child_user_time));
  SetNumber(env, result, "exitedChildrenSystemTime", static_cast<double>(usage.ri_child_system_time));
  SetNumber(env, result, "footprintBytes", static_cast<double>(usage.ri_phys_footprint));
  SetNumber(env, result, "residentBytes", static_cast<double>(usage.ri_resident_size));
  return result;
}

// childPids(pid) → the pids whose parent is pid.
napi_value ChildPids(napi_env env, napi_callback_info info) {
  double pid;
  if (!NumberArgument(env, info, &pid)) return ListPids(env, PROC_PPID_ONLY, 0);
  return ListPids(env, PROC_PPID_ONLY, static_cast<uint32_t>(pid));
}

// terminalPids(terminal) → the pids on the controlling terminal with that device number.
napi_value TerminalPids(napi_env env, napi_callback_info info) {
  double terminal;
  napi_value none;
  napi_create_array(env, &none);
  if (!NumberArgument(env, info, &terminal) || terminal < 0) return none;
  return ListPids(env, PROC_TTY_ONLY, static_cast<uint32_t>(terminal));
}

void Export(napi_env env, napi_value exports, const char* name, napi_callback callback) {
  napi_value function;
  napi_create_function(env, name, NAPI_AUTO_LENGTH, callback, nullptr, &function);
  napi_set_named_property(env, exports, name, function);
}

}  // namespace

NAPI_MODULE_INIT() {
  Export(env, exports, "timebase", Timebase);
  Export(env, exports, "info", Info);
  Export(env, exports, "usage", Usage);
  Export(env, exports, "childPids", ChildPids);
  Export(env, exports, "terminalPids", TerminalPids);
  return exports;
}

#else

NAPI_MODULE_INIT() {
  return exports;
}

#endif
