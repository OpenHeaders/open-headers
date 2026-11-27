// A Windows package's own update, asked of Windows' package manager with
// the percentage it reports heard on the way.
//
// Two asks, and nothing else: STAGE the package at a link for this user,
// its registration left for later while the app runs — and REGISTER what
// was staged, the app started again by Windows once its process has gone.
// Both are the calls the runtime's own package updater makes, with its
// options; that updater tells nobody how far a fetch is, and installs
// only what it staged itself.
//
// The package's family name is read from this process's own identity and
// is never an argument: the addon registers the package it runs in, or
// nothing.
//
// Windows is asked on a thread of the addon's own, so the caller's thread
// is never held and nothing rests on how its host set that thread up.
// What Windows reports there crosses to the script's thread through a
// thread-safe function. Nothing is cancelled: an operation asked of
// Windows is Windows' own to finish.
//
// A refusal is told in Windows' own words: the operation's code, then the
// text of its result.
//
// The packager rebuilds every native module on every platform it builds
// for: off Windows this file is an empty module, which nothing loads.

#include <node_api.h>

#if defined(_WIN32)

#include <windows.h>
#include <appmodel.h>
#include <roapi.h>
#include <winstring.h>

#include <windows.foundation.h>
#include <windows.management.deployment.h>
#include <wrl/client.h>
#include <wrl/event.h>

#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cwchar>
#include <memory>
#include <string>
#include <utility>

namespace {

using ABI::Windows::Foundation::AsyncStatus;
using ABI::Windows::Foundation::IAsyncInfo;
using ABI::Windows::Foundation::IUriRuntimeClass;
using ABI::Windows::Foundation::IUriRuntimeClassFactory;
using ABI::Windows::Management::Deployment::DeploymentOptions_ForceApplicationShutdown;
using ABI::Windows::Management::Deployment::DeploymentProgress;
using ABI::Windows::Management::Deployment::DeploymentResult;
using ABI::Windows::Management::Deployment::IAddPackageOptions;
using ABI::Windows::Management::Deployment::IDeploymentResult;
using ABI::Windows::Management::Deployment::IPackageManager;
using ABI::Windows::Management::Deployment::IPackageManager5;
using ABI::Windows::Management::Deployment::IPackageManager9;
using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

using DeploymentOperation = ABI::Windows::Foundation::IAsyncOperationWithProgress<DeploymentResult*, DeploymentProgress>;
using ProgressHandler = ABI::Windows::Foundation::IAsyncOperationProgressHandler<DeploymentResult*, DeploymentProgress>;
using CompletedHandler =
    ABI::Windows::Foundation::IAsyncOperationWithProgressCompletedHandler<DeploymentResult*, DeploymentProgress>;

// One ask of Windows, shared by the thread that makes it and the handlers
// Windows calls: it lives for as long as any of them holds it.
struct Ask {
  // Empty for a registration.
  std::wstring link;

  // Guards `toScript`: every word crosses under it, and it is closed under it.
  SRWLOCK gate = SRWLOCK_INIT;
  // Null once nothing more may be told: the last word was said, or the
  // script's side is gone.
  napi_threadsafe_function toScript = nullptr;

  // Set by Windows when the operation is over.
  HANDLE over = nullptr;
  AsyncStatus endedAs = AsyncStatus::Started;

  ~Ask() {
    if (over != nullptr) CloseHandle(over);
  }
};

// What one ask leaves on the script's thread: the promise to settle.
struct Pending {
  napi_deferred deferred = nullptr;
  std::shared_ptr<Ask> ask;
};

// One thing heard on the ask's thread, carried to the script's.
struct Heard {
  bool over = false;
  uint32_t percent = 0;
  // Empty when Windows completed the operation.
  std::string problem;
};

std::string Utf8(const wchar_t* text, size_t length) {
  if (length == 0) return std::string();
  int bytes = WideCharToMultiByte(CP_UTF8, 0, text, static_cast<int>(length), nullptr, 0, nullptr, nullptr);
  if (bytes <= 0) return std::string();
  std::string converted(static_cast<size_t>(bytes), '\0');
  WideCharToMultiByte(CP_UTF8, 0, text, static_cast<int>(length), converted.data(), bytes, nullptr, nullptr);
  return converted;
}

// A code as Windows writes it, then the words that go with it.
std::string Said(HRESULT code, const std::string& words) {
  char head[16];
  snprintf(head, sizeof(head), "0x%08lX", static_cast<unsigned long>(code));
  return words.empty() ? std::string(head) : std::string(head) + " " + words;
}

std::string Trimmed(const std::string& text) {
  const char* blanks = " \t\r\n";
  size_t first = text.find_first_not_of(blanks);
  if (first == std::string::npos) return std::string();
  return text.substr(first, text.find_last_not_of(blanks) - first + 1);
}

// Hands one thing heard to the script's thread, unless nothing more may
// be told. A function that answers it is closing is never used again.
void Tell(Ask* ask, Heard* heard) {
  AcquireSRWLockExclusive(&ask->gate);
  napi_status status = napi_closing;
  if (ask->toScript != nullptr) {
    status = napi_call_threadsafe_function(ask->toScript, heard, napi_tsfn_nonblocking);
    if (status == napi_closing) ask->toScript = nullptr;
  }
  ReleaseSRWLockExclusive(&ask->gate);
  if (status != napi_ok) delete heard;
}

HRESULT Activate(const wchar_t* className, IInspectable** instance) {
  HSTRING name = nullptr;
  HRESULT made = WindowsCreateString(className, static_cast<UINT32>(wcslen(className)), &name);
  if (FAILED(made)) return made;
  HRESULT activated = RoActivateInstance(name, instance);
  WindowsDeleteString(name);
  return activated;
}

HRESULT PackageManager(ComPtr<IPackageManager>* manager) {
  ComPtr<IInspectable> instance;
  HRESULT activated = Activate(RuntimeClass_Windows_Management_Deployment_PackageManager, &instance);
  return FAILED(activated) ? activated : instance.As(manager);
}

HRESULT UriOf(const std::wstring& link, ComPtr<IUriRuntimeClass>* uri) {
  HSTRING className = nullptr;
  const wchar_t* runtimeClass = RuntimeClass_Windows_Foundation_Uri;
  HRESULT named = WindowsCreateString(runtimeClass, static_cast<UINT32>(wcslen(runtimeClass)), &className);
  if (FAILED(named)) return named;
  ComPtr<IUriRuntimeClassFactory> factory;
  HRESULT found = RoGetActivationFactory(className, IID_PPV_ARGS(&factory));
  WindowsDeleteString(className);
  if (FAILED(found)) return found;

  HSTRING text = nullptr;
  HRESULT copied = WindowsCreateString(link.c_str(), static_cast<UINT32>(link.size()), &text);
  if (FAILED(copied)) return copied;
  HRESULT created = factory->CreateUri(text, uri->GetAddressOf());
  WindowsDeleteString(text);
  return created;
}

// Waits for an operation Windows has started, passing its percentages on
// when asked to. Empty when Windows completed it; Windows' words when it
// did not.
std::string Await(const std::shared_ptr<Ask>& ask, DeploymentOperation* operation, bool reports) {
  if (reports) {
    // Without this handler the operation still runs: the bar stays where it is.
    operation->put_Progress(Callback<ProgressHandler>([ask](DeploymentOperation*, DeploymentProgress progress) {
                              Heard* heard = new Heard();
                              heard->percent = progress.percentage;
                              Tell(ask.get(), heard);
                              return S_OK;
                            }).Get());
  }
  HRESULT listening = operation->put_Completed(Callback<CompletedHandler>([ask](DeploymentOperation*, AsyncStatus status) {
                                                 ask->endedAs = status;
                                                 SetEvent(ask->over);
                                                 return S_OK;
                                               }).Get());
  if (FAILED(listening)) return Said(listening, "Windows would not say when the operation is over");
  WaitForSingleObject(ask->over, INFINITE);
  if (ask->endedAs == AsyncStatus::Completed) return std::string();

  HRESULT code = E_FAIL;
  ComPtr<IAsyncInfo> info;
  if (SUCCEEDED(operation->QueryInterface(IID_PPV_ARGS(&info)))) info->get_ErrorCode(&code);

  std::string words;
  ComPtr<IDeploymentResult> result;
  if (SUCCEEDED(operation->GetResults(&result)) && result) {
    HSTRING text = nullptr;
    if (SUCCEEDED(result->get_ErrorText(&text))) {
      UINT32 length = 0;
      const wchar_t* raw = WindowsGetStringRawBuffer(text, &length);
      words = Trimmed(Utf8(raw, length));
      WindowsDeleteString(text);
    }
  }
  if (words.empty() && ask->endedAs == AsyncStatus::Canceled) words = "Windows cancelled the operation";
  return Said(code, words);
}

// The add the runtime's updater asks for: the package at the link, for
// this user, its registration deferred while the package is in use.
std::string Stage(const std::shared_ptr<Ask>& ask) {
  ComPtr<IPackageManager> manager;
  HRESULT opened = PackageManager(&manager);
  if (FAILED(opened)) return Said(opened, "Windows' package manager could not be opened");
  ComPtr<IPackageManager9> adder;
  HRESULT known = manager.As(&adder);
  if (FAILED(known)) return Said(known, "this Windows cannot add a package from a link");

  ComPtr<IUriRuntimeClass> uri;
  HRESULT parsed = UriOf(ask->link, &uri);
  if (FAILED(parsed)) return Said(parsed, "Windows could not read the package's link");

  ComPtr<IInspectable> instance;
  ComPtr<IAddPackageOptions> options;
  HRESULT made = Activate(RuntimeClass_Windows_Management_Deployment_AddPackageOptions, &instance);
  if (SUCCEEDED(made)) made = instance.As(&options);
  if (SUCCEEDED(made)) made = options->put_DeferRegistrationWhenPackagesAreInUse(true);
  if (FAILED(made)) return Said(made, "Windows' options for adding a package could not be set");

  ComPtr<DeploymentOperation> operation;
  HRESULT asked = adder->AddPackageByUriAsync(uri.Get(), options.Get(), &operation);
  if (FAILED(asked) || !operation) return Said(FAILED(asked) ? asked : E_FAIL, "Windows did not take the package's link");
  return Await(ask, operation.Get(), true);
}

// The registration the runtime's updater asks for: this process's own
// package by its family name, its processes closed by Windows — and the
// app started again by Windows afterwards.
std::string Register(const std::shared_ptr<Ask>& ask) {
  UINT32 length = 0;
  LONG sized = GetCurrentPackageFamilyName(&length, nullptr);
  if (sized == APPMODEL_ERROR_NO_PACKAGE) return "this process has no package identity";
  if (sized != ERROR_INSUFFICIENT_BUFFER || length == 0) {
    return Said(HRESULT_FROM_WIN32(static_cast<DWORD>(sized)), "the package's family name could not be read");
  }
  // The length counts the terminator.
  std::wstring family(length, L'\0');
  LONG read = GetCurrentPackageFamilyName(&length, family.data());
  if (read != ERROR_SUCCESS || length == 0) {
    return Said(HRESULT_FROM_WIN32(static_cast<DWORD>(read)), "the package's family name could not be read");
  }

  ComPtr<IPackageManager> manager;
  HRESULT opened = PackageManager(&manager);
  if (FAILED(opened)) return Said(opened, "Windows' package manager could not be opened");
  ComPtr<IPackageManager5> registrar;
  HRESULT known = manager.As(&registrar);
  if (FAILED(known)) return Said(known, "this Windows cannot register a package by its family name");

  // After an update only: not after a crash, a hang or a restart of the
  // machine. A refusal here leaves the update itself whole, so it is not a
  // stop: the new version is then there at the next start by hand.
  RegisterApplicationRestart(nullptr, RESTART_NO_CRASH | RESTART_NO_HANG | RESTART_NO_REBOOT);

  HSTRING name = nullptr;
  HRESULT copied = WindowsCreateString(family.c_str(), length - 1, &name);
  if (FAILED(copied)) return Said(copied, "the package's family name could not be handed to Windows");
  ComPtr<DeploymentOperation> operation;
  HRESULT asked = registrar->RegisterPackageByFamilyNameAndOptionalPackagesAsync(
      name, nullptr, DeploymentOptions_ForceApplicationShutdown, nullptr, nullptr, &operation);
  WindowsDeleteString(name);
  if (FAILED(asked) || !operation) return Said(FAILED(asked) ? asked : E_FAIL, "Windows did not take the registration");
  return Await(ask, operation.Get(), false);
}

// The ask's own thread. It takes the ask from the heap, where the script's thread left it.
DWORD WINAPI Work(void* parameter) {
  std::shared_ptr<Ask>* handed = static_cast<std::shared_ptr<Ask>*>(parameter);
  std::shared_ptr<Ask> ask = *handed;
  delete handed;

  Heard* last = new Heard();
  last->over = true;
  HRESULT started = RoInitialize(RO_INIT_MULTITHREADED);
  if (FAILED(started)) {
    last->problem = Said(started, "Windows' runtime would not start on the update's thread");
  } else {
    last->problem = ask->link.empty() ? Register(ask) : Stage(ask);
    RoUninitialize();
  }

  // The last word, and the function let go — both under the gate, so no
  // report follows it and the script's side cannot go between the two.
  AcquireSRWLockExclusive(&ask->gate);
  napi_threadsafe_function toScript = ask->toScript;
  ask->toScript = nullptr;
  napi_status status = napi_closing;
  if (toScript != nullptr) {
    status = napi_call_threadsafe_function(toScript, last, napi_tsfn_nonblocking);
    if (status != napi_closing) napi_release_threadsafe_function(toScript, napi_tsfn_release);
  }
  ReleaseSRWLockExclusive(&ask->gate);
  if (status != napi_ok) delete last;
  return 0;
}

// On the script's thread: a percentage goes to the caller's function, the
// last word settles the promise. With no environment the script's side is
// being taken down and nothing can be told.
void OnScriptThread(napi_env env, napi_value onPercent, void* context, void* data) {
  Pending* pending = static_cast<Pending*>(context);
  Heard* heard = static_cast<Heard*>(data);
  if (env != nullptr && !heard->over && onPercent != nullptr) {
    napi_value undefined;
    napi_value percent;
    napi_get_undefined(env, &undefined);
    napi_create_uint32(env, heard->percent, &percent);
    napi_call_function(env, undefined, onPercent, 1, &percent, nullptr);
  } else if (env != nullptr && heard->over && pending->deferred != nullptr) {
    if (heard->problem.empty()) {
      napi_value undefined;
      napi_get_undefined(env, &undefined);
      napi_resolve_deferred(env, pending->deferred, undefined);
    } else {
      napi_value message;
      napi_value error;
      napi_create_string_utf8(env, heard->problem.c_str(), heard->problem.size(), &message);
      napi_create_error(env, nullptr, message, &error);
      napi_reject_deferred(env, pending->deferred, error);
    }
    pending->deferred = nullptr;
  }
  delete heard;
}

// The function is going — at the last word, or with the script's side
// while Windows still works. From here the ask's thread tells nobody.
void OnFunctionGone(napi_env, void* data, void*) {
  Pending* pending = static_cast<Pending*>(data);
  AcquireSRWLockExclusive(&pending->ask->gate);
  pending->ask->toScript = nullptr;
  ReleaseSRWLockExclusive(&pending->ask->gate);
  delete pending;
}

napi_value RejectedNow(napi_env env, napi_deferred deferred, napi_value promise, const char* words) {
  napi_value message;
  napi_value error;
  napi_create_string_utf8(env, words, NAPI_AUTO_LENGTH, &message);
  napi_create_error(env, nullptr, message, &error);
  napi_reject_deferred(env, deferred, error);
  return promise;
}

// Starts one ask on a thread of its own and hands back its promise.
napi_value Begin(napi_env env, std::wstring link, napi_value onPercent, const char* resourceName) {
  napi_deferred deferred;
  napi_value promise;
  if (napi_create_promise(env, &deferred, &promise) != napi_ok) return nullptr;

  std::shared_ptr<Ask> ask = std::make_shared<Ask>();
  ask->link = std::move(link);
  ask->over = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (ask->over == nullptr) return RejectedNow(env, deferred, promise, "Windows would not make the update's event");

  Pending* pending = new Pending();
  pending->deferred = deferred;
  pending->ask = ask;

  napi_value name;
  napi_create_string_utf8(env, resourceName, NAPI_AUTO_LENGTH, &name);
  if (napi_create_threadsafe_function(env, onPercent, nullptr, name, 0, 1, pending, OnFunctionGone, pending,
                                      OnScriptThread, &ask->toScript) != napi_ok) {
    ask->toScript = nullptr;
    delete pending;
    return RejectedNow(env, deferred, promise, "the update's way back to the script could not be made");
  }

  std::shared_ptr<Ask>* handed = new std::shared_ptr<Ask>(ask);
  HANDLE thread = CreateThread(nullptr, 0, Work, handed, 0, nullptr);
  if (thread == nullptr) {
    delete handed;
    // Letting the function go frees what is pending, so the promise is settled first.
    pending->deferred = nullptr;
    napi_release_threadsafe_function(ask->toScript, napi_tsfn_abort);
    return RejectedNow(env, deferred, promise, "Windows would not start the update's thread");
  }
  CloseHandle(thread);
  return promise;
}

// stage(link, onPercent) → a promise: resolved once Windows has staged the
// package at the link, rejected with Windows' words when it has not.
// `onPercent` hears every percentage Windows reports, 0 to 100, as it comes.
napi_value StageCall(napi_env env, napi_callback_info info) {
  napi_value argv[2];
  size_t argc = 2;
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok) return nullptr;

  napi_valuetype linkType = napi_undefined;
  napi_valuetype functionType = napi_undefined;
  if (argc >= 1) napi_typeof(env, argv[0], &linkType);
  if (argc >= 2) napi_typeof(env, argv[1], &functionType);
  size_t length = 0;
  if (linkType == napi_string) napi_get_value_string_utf16(env, argv[0], nullptr, 0, &length);
  if (linkType != napi_string || functionType != napi_function || length == 0) {
    napi_deferred deferred;
    napi_value promise;
    if (napi_create_promise(env, &deferred, &promise) != napi_ok) return nullptr;
    return RejectedNow(env, deferred, promise, "stage takes a package's link and a function that hears the percentage");
  }

  std::wstring link(length, L'\0');
  napi_get_value_string_utf16(env, argv[0], reinterpret_cast<char16_t*>(link.data()), length + 1, &length);
  return Begin(env, std::move(link), argv[1], "openheaders:package-update:stage");
}

// register() → a promise that settles when Windows' registration is over:
// resolved when Windows completed it, rejected with Windows' words when it
// did not. Windows closes the package's processes for it, so in the app
// this is asked last — and the app is not there to hear the answer.
napi_value RegisterCall(napi_env env, napi_callback_info) {
  return Begin(env, std::wstring(), nullptr, "openheaders:package-update:register");
}

void Export(napi_env env, napi_value exports, const char* name, napi_callback callback) {
  napi_value function;
  napi_create_function(env, name, NAPI_AUTO_LENGTH, callback, nullptr, &function);
  napi_set_named_property(env, exports, name, function);
}

}  // namespace

NAPI_MODULE_INIT() {
  Export(env, exports, "stage", StageCall);
  Export(env, exports, "register", RegisterCall);
  return exports;
}

#else

NAPI_MODULE_INIT() {
  return exports;
}

#endif
