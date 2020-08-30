#ifndef UTILS_H
#define UTILS_H

#include <v8.h>
#include <cstdio>
#include <sstream>
#include "../exception-handler/exception-handler.h"

struct IOState {
   int posixFlag = -1;
   const char *stdioFlag = "";
   bool canSeek = false;
   bool canRead = false;
   bool canWrite = false;
   bool canAppend = false;
};

#ifdef _WIN32
#include <Windows.h>
#include <winternl.h>

FARPROC FnBind(const char *dllName, const char *procName);

NTSTATUS WINAPI NtQueryInformationFile(
   HANDLE                 FileHandle,
   PIO_STATUS_BLOCK       IoStatusBlock,
   PVOID                  FileInformation,
   ULONG                  Length,
   FILE_INFORMATION_CLASS FileInformationClass
);

typedef struct _FILE_ACCESS_INFORMATION {
   ACCESS_MASK AccessFlags;
} FILE_ACCESS_INFORMATION, *PFILE_ACCESS_INFORMATION;

extern decltype(&NtQueryInformationFile) QueryInformationFile;
extern decltype(&RtlNtStatusToDosError) NtStatusToDosError;

void ImportNtDllFunctions();

std::string GetNtStatusStr(NTSTATUS nsCode);

HANDLE GetWindowsHandle(int fd);

IOState GetFileState(HANDLE fHandle);
#else
IOState GetFileState(int fd);
#endif

FILE *CreateFileFromFd(int fd);

#define MAX_SAFE_INTEGER  9007199254740991
#define MIN_SAFE_INTEGER -9007199254740991

#define CURRENT_PATH (__FILE__":" + std::to_string(__LINE__))

#define THROW_ERRNO \
   { throw NodeException(NodeError::Errno, "", __func__, CURRENT_PATH); }

#define THROW_ERRNO_EX(errCode, message) \
   { errno = errCode; \
   throw NodeException(NodeError::Errno, message, __func__, CURRENT_PATH); }

#define THROW_IF_NOT_SAFE_NUMBER(x) \
   if (x > MAX_SAFE_INTEGER || x < MIN_SAFE_INTEGER) \
      THROW_ERRNO_EX(EOVERFLOW, "")

#define CAST_OR_DEFAULT(expression, nodeType, defaultValue) \
   (expression->IsNullOrUndefined() ? defaultValue : expression.As<nodeType>()->Value())

bool IsSafeInteger(v8::Local<v8::Value> x);

bool IsSafeNumber(v8::Local<v8::Value> x, int typeSize, bool _unsigned = false);

const std::string GetSafeNumberMessage(int typeSize, const char *argIdx, bool _unsigned = false);

template <class T>
std::string ToString(T t, std::ios_base &(*f)(std::ios_base &)) {
   std::ostringstream oss;
   oss << f << t;
   return oss.str();
}

void CloseFile(FILE *file);

void SeekFile(FILE *file, long offset, int origin);

long TellFile(FILE *file);

size_t ReadFile(FILE *file, void *ptr, size_t size, size_t count);

void WriteFile(FILE *file, const void *ptr, size_t size, size_t count);

void FlushFile(FILE *file);

void SetFileBufSize(FILE *file, char *buffer, int mode, size_t size);
#endif