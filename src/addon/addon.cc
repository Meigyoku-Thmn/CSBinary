#include <nan.h>
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

NAN_METHOD(GetFdAccessMask) {
   if (QueryInformationFile == NULL) {
      return Nan::ThrowError(
         Nan::TypeError("This module has failed to import the NtQueryInformationFile function, there is nothing I can do."));
   }

   if (info.Length() < 1) {
      return Nan::ThrowError(
         Nan::TypeError("Expected one argument of number type."));
   }

   if (!info[0]->IsNumber()) {
      return Nan::ThrowError(
         Nan::TypeError("Must provider a number as file descriptor."));
   }

   int fd = info[0].As<v8::Int32>()->Value();
   HANDLE fh = (HANDLE)uv_get_osfhandle(fd);
   if (fh == INVALID_HANDLE_VALUE) {
      return Nan::ThrowError(
         Nan::Error("Bad file descriptor."));
   }

   IO_STATUS_BLOCK statusBlock;
   FILE_ACCESS_INFORMATION accessInfo;

   NTSTATUS status = QueryInformationFile(
      fh, &statusBlock, &accessInfo, sizeof(FILE_ACCESS_INFORMATION), (FILE_INFORMATION_CLASS)8);

   if (status == S_OK) {
      info.GetReturnValue().Set((UINT32)accessInfo.AccessFlags);
   } else {
      return Nan::ThrowError(
         Nan::Error(("NtQueryInformationFile returned an error code: 0x" + toString(status, hex)).c_str()));
   }
}

FARPROC fnBind(const char* dllName, const char* procName) {
   auto dllModule = LoadLibraryA(dllName);
   if (dllModule == NULL) return NULL;
   return GetProcAddress(dllModule, procName);
}
#endif

NAN_MODULE_INIT(Init) {
#ifdef _WIN32
   QueryInformationFile = (decltype(&NtQueryInformationFile))fnBind("ntdll.dll", "NtQueryInformationFile");
   Nan::Export(target, "getFdAccessMask", GetFdAccessMask);
#endif
}

NODE_MODULE(addon, Init)