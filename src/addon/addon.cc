#include <napi.h>
#ifdef _WIN32
#include <uv.h>
#include <Windows.h>
#include <winternl.h>
#include <sstream>

using namespace std;

template <class T>
string toString(T t, ios_base& (*f)(ios_base&)) {
   ostringstream oss;
   oss << f << t;
   return oss.str();
}

NTSTATUS WINAPI NtQueryInformationFile(
   HANDLE                 FileHandle,
   PIO_STATUS_BLOCK       IoStatusBlock,
   PVOID                  FileInformation,
   ULONG                  Length,
   FILE_INFORMATION_CLASS FileInformationClass
);

typedef struct _FILE_ACCESS_INFORMATION {
   ACCESS_MASK AccessFlags;
} FILE_ACCESS_INFORMATION, * PFILE_ACCESS_INFORMATION;

decltype(&NtQueryInformationFile) QueryInformationFile = NULL;

Napi::Value GetFdAccessMask(const Napi::CallbackInfo& info) {
   Napi::Env env = info.Env();

   if (QueryInformationFile == NULL) {
      Napi::TypeError::New(env,
         "This module has failed to import the NtQueryInformationFile function, there is nothing it can do.")
         .ThrowAsJavaScriptException();
      return env.Null();
   }

   if (info.Length() < 1) {
      Napi::TypeError::New(env, "Expected one argument of number type.").ThrowAsJavaScriptException();
      return env.Null();
   }

   if (!info[0].IsNumber()) {
      Napi::TypeError::New(env, "Must provider a number as file descriptor.").ThrowAsJavaScriptException();
      return env.Null();
   }

   int fd = info[0].As<Napi::Number>().Int32Value();
   HANDLE fh = (HANDLE)uv_get_osfhandle(fd);
   if (fh == INVALID_HANDLE_VALUE) {
      Napi::Error::New(env, "Bad file descriptor.").ThrowAsJavaScriptException();
      return env.Null();
   }

   IO_STATUS_BLOCK statusBlock;
   FILE_ACCESS_INFORMATION accessInfo;

   NTSTATUS status = QueryInformationFile(
      fh, &statusBlock, &accessInfo, sizeof(FILE_ACCESS_INFORMATION), (FILE_INFORMATION_CLASS)8);

   if (status == S_OK) {
      return Napi::Number::New(env, accessInfo.AccessFlags);
   } else {
      Napi::Error::New(env, "NtQueryInformationFile returned an error code: 0x" + toString(status, hex))
         .ThrowAsJavaScriptException();
      return env.Null();
   }
}

FARPROC fnBind(const char* dllName, const char* procName) {
   auto dllModule = LoadLibraryA(dllName);
   if (dllModule == NULL) return NULL;
   return GetProcAddress(dllModule, procName);
}
#endif

Napi::Object Init(Napi::Env env, Napi::Object exports) {
#ifdef _WIN32
   QueryInformationFile = (decltype(&NtQueryInformationFile))fnBind("ntdll.dll", "NtQueryInformationFile");
   exports.Set(Napi::String::New(env, "getFdAccessMask"), Napi::Function::New(env, GetFdAccessMask));
#endif
   return exports;
}

NODE_API_MODULE(addon, Init)