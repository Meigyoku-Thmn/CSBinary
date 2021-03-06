#include "utils.h"
#include <cstdio>
#include <cmath>
#ifndef _WIN32
#include <unistd.h>
#endif
#include <fcntl.h>
#include <uv.h>
#include "../exception-handler/exception-handler.h"

#ifdef _WIN32
#include <Windows.h>
#include <io.h>
HMODULE hNtDll = NULL;
decltype(&NtQueryInformationFile) QueryInformationFile = NULL;
decltype(&RtlNtStatusToDosError) NtStatusToDosError = NULL;

FARPROC FnBind(const char *dllName, const char *procName) {
   auto dllModule = LoadLibraryA(dllName);
   if (dllModule == NULL) return NULL;
   return GetProcAddress(dllModule, procName);
}

void ImportNtDllFunctions() {
   hNtDll = LoadLibraryA("ntdll.dll");
   QueryInformationFile = (decltype(&NtQueryInformationFile))FnBind("ntdll.dll", "NtQueryInformationFile");
   NtStatusToDosError = (decltype(&RtlNtStatusToDosError))FnBind("ntdll.dll", "RtlNtStatusToDosError");
}

HANDLE GetWindowsHandle(int fd) {
   auto winHd = (HANDLE)uv_get_osfhandle(fd);
   if (winHd == INVALID_HANDLE_VALUE)
      THROW_ERRNO_EX(EBADF, "assumed");
   return winHd;
}
#endif

FILE *CreateFileFromFd(int fd) {
   int fd2 = fd;
#ifdef _WIN32
   auto winHd = GetWindowsHandle(fd);
   auto flagSet = GetFileState(winHd);
   fd2 = _open_osfhandle((intptr_t)winHd, flagSet.posixFlag);
   if (fd2 == -1)
      THROW_ERRNO;
#else
   auto flagSet = GetFileState(fd);
#endif
   FILE *file = fdopen(fd2, flagSet.stdioFlag);
   if (file == NULL)
      THROW_ERRNO;
   return file;
}

bool IsNullOrUndefined(Napi::Value x) {
   return x.IsNull() || x.IsUndefined();
}

IntegerInvalid IsSafeInteger(Napi::Value x, int typeSize, bool _unsigned) {
   if (!x.IsNumber()) return IntegerInvalid::Type;
   auto originalNumber = x.As<Napi::Number>().DoubleValue();
   auto afterCast = (int64_t)originalNumber;
   if ((double)afterCast != originalNumber) return IntegerInvalid::Type;
   bool inRange;
   if (typeSize >= 8) {
      inRange =  _unsigned ? originalNumber >= 0 : true;
   } else {
      auto min = (int64_t)pow(256, typeSize) / -2;
      auto max = (int64_t)pow(256, typeSize) - 1;
      if (_unsigned == true) {
         min = 0;
         max = max - min;
      }
      inRange = afterCast <= max && afterCast >= min;
   }
   if (inRange == false)
      return IntegerInvalid::Range;
   return IntegerInvalid::None;
}

const std::string GetSafeIntegerMessage(int typeSize, const char *argIdx, bool _unsigned) {
   if (typeSize >= 8)
      return std::string("Must provide a safe ") + (_unsigned ? "unsigned" : "") + " integer as the " + argIdx + ".";
   auto min = (int64_t)pow(256, typeSize) / -2;
   auto max = (int64_t)pow(256, typeSize) - 1;
   if (_unsigned == true) {
      min = 0;
      max = max - min;
   }
   return "Must provide an integer in range [" + 
      std::to_string(min) + ":" + std::to_string(max) + "] as the " + argIdx + ".";
}

#ifdef _WIN32
std::string GetNtStatusStr(NTSTATUS nsCode) {
   if (NtStatusToDosError == NULL)
      throw NodeException(NodeError::Reference, "This module has failed to import the NtStatusToDosError function.");
   LPTSTR message;
   DWORD dwRes = FormatMessageA(
      FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_FROM_HMODULE,
      hNtDll,
      NtStatusToDosError(nsCode),
      MAKELANGID(LANG_ENGLISH, SUBLANG_DEFAULT),
      (LPTSTR)&message,
      0,
      NULL
   );
   if (dwRes == 0)
      return "NTSTATUS code is " + std::to_string(nsCode);
   auto rs = std::string(message);
   LocalFree(message);
   return rs;
}
IOState GetFileState(HANDLE fHandle) {
   if (QueryInformationFile == NULL)
      throw NodeException(NodeError::Reference, "This module has failed to import the NtQueryInformationFile function.");
   IOState rs;
   IO_STATUS_BLOCK statusBlock;
   FILE_ACCESS_INFORMATION accessInfo;
   NTSTATUS status = QueryInformationFile(
      fHandle, &statusBlock, &accessInfo, sizeof(FILE_ACCESS_INFORMATION), (FILE_INFORMATION_CLASS)8);
   if (status != S_OK)
      throw NodeException(NodeError::Generic, GetNtStatusStr(status));
   auto flags = accessInfo.AccessFlags;
   auto isRead = (FILE_READ_DATA & flags) != 0;
   auto isWrite = (FILE_WRITE_DATA & flags) != 0;
   auto isAppend = (FILE_APPEND_DATA & flags) != 0; // is ON in both write mode and append mode
   rs.canRead = isRead;
   rs.canWrite = isAppend ? true : isWrite;
   rs.canAppend = isWrite ? false : isAppend;
   rs.canSeek = GetFileType(fHandle) == FILE_TYPE_DISK;
   if (isRead == false && isWrite == false && isAppend == true) {
      rs.posixFlag = O_WRONLY | O_APPEND | O_BINARY;
      rs.stdioFlag = "ab";
   } else if (isRead == true && isWrite == false && isAppend == true) {
      rs.posixFlag = O_RDWR | O_APPEND | O_BINARY;
      rs.stdioFlag = "a+b";
   } else if (isRead == true && isWrite == false && isAppend == false) {
      rs.posixFlag = O_RDONLY | O_BINARY;
      rs.stdioFlag = "rb";
   } else if (isRead == true && isWrite == true) {
      rs.posixFlag = O_RDWR | O_BINARY;
      rs.stdioFlag = "r+b";
   } else if (isRead == false && isWrite == true) {
      rs.posixFlag = O_WRONLY | O_BINARY;
      rs.stdioFlag = "wb";
   } else {
      // This should not happen
      throw NodeException(NodeError::Generic, "There is no suitable file flag that can be inferred from your file handle.");
   }
   return rs;
}
#else
IOState GetFileState(int fd) {
   IOState rs;
   int flags = fcntl(fd, F_GETFL);
   if (flags == -1)
      THROW_ERRNO;
   int accessMode = flags & O_ACCMODE;
   auto isRead = accessMode == O_RDONLY || accessMode == O_RDWR;
   auto isWrite = accessMode == O_WRONLY || accessMode == O_RDWR;
   auto isAppend = (flags & O_APPEND) != 0;
   rs.canRead = isRead;
   rs.canWrite = isWrite;
   rs.canAppend = isAppend;
   rs.canSeek = lseek(fd, 0, SEEK_CUR) != -1;
   if (isRead == false && isWrite == true && isAppend == true) {
      rs.posixFlag = O_WRONLY | O_APPEND;
      rs.stdioFlag = "ab";
   } else if (isRead == true && isWrite == true && isAppend == true) {
      rs.posixFlag = O_RDWR | O_APPEND;
      rs.stdioFlag = "a+b";
   } else if (isRead == true && isWrite == false && isAppend == false) {
      rs.posixFlag = O_RDONLY;
      rs.stdioFlag = "rb";
   } else if (isRead == true && isWrite == true && isAppend == false) {
      rs.posixFlag = O_RDWR;
      rs.stdioFlag = "r+b";
   } else if (isRead == false && isWrite == true && isAppend == false) {
      rs.posixFlag = O_WRONLY;
      rs.stdioFlag = "wb";
   } else {
      // This should not happen
      throw NodeException(NodeError::Generic, "There is no suitable file flag that can be inferred from your file descriptor.");
   }
   return rs;
}
#endif

void CloseFile(FILE *file) {
   if (fclose(file) == EOF)
      THROW_ERRNO;
}

void SeekFile(FILE *file, long offset, int origin) {
   if (fseek(file, offset, origin) != 0)
      THROW_ERRNO;
}

long TellFile(FILE *file) {
   auto rs = ftell(file);
   if (rs == -1)
      THROW_ERRNO;
   return rs;
}

size_t ReadFile(FILE *file, void *ptr, size_t size, size_t count) {
   auto nRead = fread(ptr, size, count, file);
   if (ferror(file) != 0)
      THROW_ERRNO;
   return nRead;
}

void WriteFile(FILE *file, const void *ptr, size_t size, size_t count) {
   if (fwrite(ptr, size, count, file) != count)
      THROW_ERRNO;
}

void FlushFile(FILE *file) {
   if (fflush(file) == EOF)
      THROW_ERRNO;
}

void SetFileBufSize(FILE *file, char *buffer, int mode, size_t size) {
   if (setvbuf(file, buffer, mode, size) != 0)
      THROW_ERRNO;
}
