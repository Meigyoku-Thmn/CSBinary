#include "file-wrap.h"
#include <cstdio>
#include <napi.h>
#include <uv.h>
#include <uv.h>
#ifdef _WIN32
#include <Windows.h>
#include <io.h>
#endif
#include "../utils/utils.h"
#include "../exception-handler/exception-handler.h"

namespace FileWrap {
   void Prepare(Napi::Env env, Napi::Object exports) {
      File::Init(env, exports);
   }
   void File::Init(Napi::Env env, Napi::Object exports) {
      auto func = DefineClass(env, "File",
         {
            // Getters
            InstanceAccessor<&File::getFd>("fd"),
            InstanceAccessor<&File::getCanSeek>("canSeek"),
            InstanceAccessor<&File::getCanRead>("canRead"),
            InstanceAccessor<&File::getCanWrite>("canWrite"),
            InstanceAccessor<&File::getCanAppend>("canAppend"),
            // Methods
            InstanceMethod<&File::close>("close"),
            InstanceMethod<&File::seek>("seek"),
            InstanceMethod<&File::tell>("tell"),
            InstanceMethod<&File::read>("read"),
            InstanceMethod<&File::write>("write"),
            InstanceMethod<&File::flush>("flush"),
            InstanceMethod<&File::setBufSize>("setBufSize")
         }
      );
      auto *constructor = new Napi::FunctionReference();
      *constructor = Napi::Persistent(func);
      env.SetInstanceData(constructor);
      exports.Set("File", func);
   }
   // new (fd: number) => IFile
   File::File(const Napi::CallbackInfo &info) : Napi::ObjectWrap<File>(info), fd(-1), file(NULL) {
      auto env = info.Env();
      HandleException(env, [&]() {
         if (IsSafeInteger(info[0], sizeof(int)) != IntegerInvalid::None) // fd
            throw NodeException(
               NodeError::Type, std::string("Must provide a ") + std::to_string(sizeof(int) * 8) + "-bits integer file descriptor as the first argument.");

         auto fd = (int)info[0].As<Napi::Number>().DoubleValue();
         auto *file = CreateFileFromFd(fd);
#ifdef _WIN32
         auto state = GetFileState(GetWindowsHandle(fd));
#else
         auto state = GetFileState(fd);
#endif
         this->fd = fd;
         this->file = file;
         this->state = state;
      });
   }
   void File::ThrowIfClosed(const Napi::CallbackInfo &info) {
      if (this->isClose)
         THROW_ERRNO_EX(EBADF, "");
   }
   // close(): void
   void File::close(const Napi::CallbackInfo &info) {
      auto env = info.Env();
      HandleException(env, [&]() {
         if (this->isClose) return;
         CloseFile(this->file);
         this->fd = -1;
         this->file = NULL;
         this->state = IOState();
         this->isClose = true;
      });
   }
   // seek(offset: number, origin: SeekOrigin): void
   void File::seek(const Napi::CallbackInfo &info) {
      auto env = info.Env();
      HandleException(env, [&] {
         ThrowIfClosed(info);

         auto inputError = IsSafeInteger(info[0], sizeof(long));
         if (inputError == IntegerInvalid::Type) // offset
            throw NodeException(NodeError::Type, GetSafeIntegerMessage(sizeof(long), "first argument"));
         else if (inputError == IntegerInvalid::Range) // offset
            throw NodeException(NodeError::Range, GetSafeIntegerMessage(sizeof(long), "first argument"));

         if (!info[1].IsNumber()) // origin
            throw NodeException(NodeError::Type, "Must provide a SeekOrigin value as the second argument.");

         auto offset = (long)info[0].As<Napi::Number>().DoubleValue();
         auto origin = info[1].As<Napi::Number>().Int32Value();
         if (origin != SEEK_SET && origin != SEEK_CUR && origin != SEEK_END)
            throw NodeException(NodeError::Range, "Invalid SeekOrigin value.");
         SeekFile(this->file, offset, origin);
      });
   }
   // tell(): number
   Napi::Value File::tell(const Napi::CallbackInfo &info) {
      auto env = info.Env();
      Napi::Value rs;
      HandleException(env, [&]() {
         ThrowIfClosed(info);
         auto pos = TellFile(this->file);
         THROW_IF_NOT_SAFE_NUMBER(pos);
         rs = Napi::Number::New(env, (double)pos);
      });
      return rs;
   }
   // read(bytes: NodeJS.ArrayBufferView, offset?: number, count?: number): number
   Napi::Value File::read(const Napi::CallbackInfo &info) {
      auto env = info.Env();
      Napi::Value rs;
      HandleException(env, [&]() {
         ThrowIfClosed(info);

         if (!info[0].IsBuffer()) // bytes
            throw NodeException(NodeError::Type, "Must provide a Buffer value as the first argument.");

         if (!IsNullOrUndefined(info[1])) {
            auto inputError = IsSafeInteger(info[1], sizeof(size_t), true);
            if (inputError == IntegerInvalid::Type) // offset
               throw NodeException(NodeError::Type, GetSafeIntegerMessage(sizeof(size_t), "second argument", true));
            else if (inputError == IntegerInvalid::Range) // offset
               throw NodeException(NodeError::Range, GetSafeIntegerMessage(sizeof(size_t), "second argument", true));
         }
         if (!IsNullOrUndefined(info[2])) {
            auto inputError = IsSafeInteger(info[2], sizeof(size_t), true);
            if (inputError == IntegerInvalid::Type) // count
               throw NodeException(NodeError::Type, GetSafeIntegerMessage(sizeof(size_t), "third argument", true));
            if (inputError == IntegerInvalid::Range) // count
               throw NodeException(NodeError::Range, GetSafeIntegerMessage(sizeof(size_t), "third argument", true));
         }

         auto bytes = info[0].As<Napi::Buffer<char>>();
         auto byteLen = bytes.Length();
         auto offset = (size_t)TRY_GET_NUMBER(info[1], 0);
         if (offset > byteLen)
            throw NodeException(NodeError::Range, "offset is not allowed to be greater than buffer's length.");
         auto count = (size_t)TRY_GET_NUMBER(info[2], byteLen - offset);
         if (byteLen - offset < count)
            throw NodeException(NodeError::Range, "Your requested read range would cause buffer overflow.");
         auto nRead = ReadFile(this->file, bytes.Data() + offset, 1, count);
         rs = Napi::Number::New(env, (double)nRead);
      });
      return rs;
   }
   // write(bytes: NodeJS.ArrayBufferView, offset?: number, count?: number): void
   void File::write(const Napi::CallbackInfo &info) {
      auto env = info.Env();
      HandleException(env, [&]() {
         ThrowIfClosed(info);

         if (!info[0].IsBuffer()) // bytes
            throw NodeException(NodeError::Type, "Must provide a Buffer value as the first argument.");

         if (!IsNullOrUndefined(info[1])) {
            auto inputError = IsSafeInteger(info[1], sizeof(size_t), true);
            if (inputError == IntegerInvalid::Type) // offset
               throw NodeException(NodeError::Type, GetSafeIntegerMessage(sizeof(size_t), "second argument", true));
            else if (inputError == IntegerInvalid::Range) // offset
               throw NodeException(NodeError::Range, GetSafeIntegerMessage(sizeof(size_t), "second argument", true));
         }

         if (!IsNullOrUndefined(info[2])) {
            auto inputError = IsSafeInteger(info[2], sizeof(size_t), true);
            if (inputError == IntegerInvalid::Type) // count
               throw NodeException(NodeError::Type, GetSafeIntegerMessage(sizeof(size_t), "third argument", true));
            if (inputError == IntegerInvalid::Range) // count
               throw NodeException(NodeError::Range, GetSafeIntegerMessage(sizeof(size_t), "third argument", true));
         }

         auto bytes = info[0].As<Napi::Buffer<char>>();
         auto byteLen = bytes.Length();
         auto offset = (size_t)TRY_GET_NUMBER(info[1], 0);
         if (offset > byteLen)
            throw NodeException(NodeError::Range, "offset is not allowed to be greater than buffer's length.");
         auto count = (size_t)TRY_GET_NUMBER(info[2], byteLen - offset);
         if (byteLen - offset < count)
            throw NodeException(NodeError::Range, "Your requested read range would cause buffer overflow.");
         WriteFile(this->file, bytes.Data() + offset, 1, count);
      });
   }
   // flush(): void
   void File::flush(const Napi::CallbackInfo &info) {
      auto env = info.Env();
      HandleException(env, [&]() {
         ThrowIfClosed(info);
         FlushFile(this->file);
      });
   }
   // setBufSize(size: number): void
   void File::setBufSize(const Napi::CallbackInfo &info) {
      auto env = info.Env();
      HandleException(env, [&]() {
         ThrowIfClosed(info);

         auto inputError = IsSafeInteger(info[0], sizeof(size_t), true);
         if (inputError == IntegerInvalid::Type) // size
            throw NodeException(NodeError::Type, GetSafeIntegerMessage(sizeof(size_t), "first argument", true));
         else if (inputError == IntegerInvalid::Range) // size
            throw NodeException(NodeError::Range, GetSafeIntegerMessage(sizeof(size_t), "first argument", true));

         auto size = (size_t)info[0].As<Napi::Number>().DoubleValue();
         if (size != 0)
            SetFileBufSize(this->file, NULL, _IOFBF, size);
         else
            SetFileBufSize(this->file, NULL, _IONBF, 0);
      });
   }
}