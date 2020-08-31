
#include "file-wrap.h"
#include <cstdio>
#include <nan.h>
#include <uv.h>
#ifdef _WIN32
#include <Windows.h>
#include <io.h>
#endif
#include "../utils/utils.h"
#include "../exception-handler/exception-handler.h"

namespace FileWrap {
   void Prepare(Local<Object> target) {
      File::Init(target);
   }
   Nan::Persistent<Function> File::constructor;
   void File::Init(Local<Object> exports) {
      auto tpl = Nan::New<FunctionTemplate>(New);
      tpl->SetClassName(Nan::New("File").ToLocalChecked());
      tpl->InstanceTemplate()->SetInternalFieldCount(1);

      Nan::SetAccessor(tpl->InstanceTemplate(), Nan::New("fd").ToLocalChecked(), File::getFd);
      Nan::SetAccessor(tpl->InstanceTemplate(), Nan::New("canSeek").ToLocalChecked(), File::getCanSeek);
      Nan::SetAccessor(tpl->InstanceTemplate(), Nan::New("canRead").ToLocalChecked(), File::getCanRead);
      Nan::SetAccessor(tpl->InstanceTemplate(), Nan::New("canWrite").ToLocalChecked(), File::getCanWrite);
      Nan::SetAccessor(tpl->InstanceTemplate(), Nan::New("canAppend").ToLocalChecked(), File::getCanAppend);

      Nan::SetPrototypeMethod(tpl, "close", File::close);
      Nan::SetPrototypeMethod(tpl, "seek", File::seek);
      Nan::SetPrototypeMethod(tpl, "tell", File::tell);
      Nan::SetPrototypeMethod(tpl, "read", File::read);
      Nan::SetPrototypeMethod(tpl, "write", File::write);
      Nan::SetPrototypeMethod(tpl, "flush", File::flush);
      Nan::SetPrototypeMethod(tpl, "setBufSize", File::setBufSize);

      auto func = Nan::GetFunction(tpl).ToLocalChecked();
      constructor.Reset(func);
      Nan::Set(exports, Nan::New("File").ToLocalChecked(), func);
   }
   // constructor(fd: number): File
   NAN_METHOD(File::New) {
      HandleException([&]() {
         if (info.IsConstructCall()) {
            if (!info[0]->IsInt32()) // fd
               throw NodeException(NodeError::Type, "Must provide an integer file descriptor as the first argument.");

            auto fd = info[0].As<Int32>()->Value();
            auto *file = CreateFileFromFd(fd);
#ifdef _WIN32
            auto state = GetFileState(GetWindowsHandle(fd));
#else
            auto state = GetFileState(fd);
#endif
            auto obj = new File(fd, file, state);
            obj->Wrap(info.This());
            info.GetReturnValue().Set(info.This());
         } else {
            Local<Value> argv[] = { info[0] };
            auto ctor = Nan::New(constructor);
            info.GetReturnValue().Set(Nan::NewInstance(ctor, 1, argv).ToLocalChecked());
         }
      });
   }
   NAN_METHOD(File::ThrowIfClosed) {
      auto obj = Unwrap<File>(info.Holder());
      if (obj->isClose)
         THROW_ERRNO_EX(EBADF, "");
   }
   // close(): void
   NAN_METHOD(File::close) {
      HandleException([&]() {
         auto obj = Unwrap<File>(info.Holder());
         if (obj->isClose) return;
         CloseFile(obj->file);
         obj->fd = -1;
         obj->file = NULL;
         obj->state = IOState();
         obj->isClose = true;
      });
   }
   // seek(offset: number, origin: SeekOrigin): void
   NAN_METHOD(File::seek) {
      HandleException([&] {
         ThrowIfClosed(info);

         if (!IsSafeInteger(info[0])) // offset
            throw NodeException(NodeError::Type, GetSafeNumberMessage(sizeof(long), "first argument"));
         if (!IsSafeNumber(info[0], sizeof(long))) // offset
            throw NodeException(NodeError::Range, GetSafeNumberMessage(sizeof(long), "first argument"));

         if (!info[1]->IsNumber()) // origin
            throw NodeException(NodeError::Type, "Must provide a SeekOrigin value as the second argument.");

         auto offset = (long)info[0].As<Number>()->Value();
         auto origin = info[1].As<Int32>()->Value();
         if (origin != SEEK_SET && origin != SEEK_CUR && origin != SEEK_END)
            throw NodeException(NodeError::Range, "Invalid SeekOrigin value.");
         auto obj = Unwrap<File>(info.Holder());
         SeekFile(obj->file, offset, origin);
      });
   }
   // tell(): number
   NAN_METHOD(File::tell) {
      HandleException([&]() {
         ThrowIfClosed(info);
         auto obj = Unwrap<File>(info.Holder());
         auto pos = TellFile(obj->file);
         THROW_IF_NOT_SAFE_NUMBER(pos);
         info.GetReturnValue().Set(Nan::New((double)pos));
      });
   }
   // read(bytes: NodeJS.ArrayBufferView, offset?: number, count?: number): number
   NAN_METHOD(File::read) {
      HandleException([&]() {
         using namespace node;
         ThrowIfClosed(info);

         if (!Buffer::HasInstance(info[0])) // bytes
            throw NodeException(NodeError::Type, "Must provide a Buffer value as the first argument.");

         if (!info[1]->IsNullOrUndefined()) {
            if (!IsSafeInteger(info[1])) // offset
               throw NodeException(NodeError::Type, GetSafeNumberMessage(sizeof(size_t), "second argument", true));
            if (!IsSafeNumber(info[1], sizeof(size_t), true)) // offset
               throw NodeException(NodeError::Range, GetSafeNumberMessage(sizeof(size_t), "second argument", true));
         }

         if (!info[2]->IsNullOrUndefined()) {
            if (!IsSafeInteger(info[2])) // count
               throw NodeException(NodeError::Type, GetSafeNumberMessage(sizeof(size_t), "third argument", true));
            if (!IsSafeNumber(info[2], sizeof(size_t), true)) // count
               throw NodeException(NodeError::Range, GetSafeNumberMessage(sizeof(size_t), "third argument", true));
         }

         auto bytes = Buffer::Data(info[0]);
         auto byteLen = Buffer::Length(info[0]);
         auto offset = (size_t)CAST_OR_DEFAULT(info[1], Number, 0);
         if (offset > byteLen)
            throw NodeException(NodeError::Range, "offset is not allowed to be greater than buffer's length.");
         auto count = (size_t)CAST_OR_DEFAULT(info[2], Number, byteLen - offset);
         if (byteLen - offset < count)
            throw NodeException(NodeError::Range, "Your requested read range would cause buffer overflow.");
         auto obj = Unwrap<File>(info.Holder());
         auto nRead = ReadFile(obj->file, bytes + offset, 1, count);
         info.GetReturnValue().Set(Nan::New((double)nRead));
      });
   }
   // write(bytes: NodeJS.ArrayBufferView, offset?: number, count?: number): void
   NAN_METHOD(File::write) {
      HandleException([&]() {
         using namespace node;
         ThrowIfClosed(info);

         if (!Buffer::HasInstance(info[0])) // bytes
            throw NodeException(NodeError::Type, "Must provide a Buffer value as the first argument.");

         if (!info[1]->IsNullOrUndefined()) {
            if (!IsSafeInteger(info[1])) // offset
               throw NodeException(NodeError::Type, GetSafeNumberMessage(sizeof(size_t), "second argument", true));
            if (!IsSafeNumber(info[1], sizeof(size_t), true)) // offset
               throw NodeException(NodeError::Range, GetSafeNumberMessage(sizeof(size_t), "second argument", true));
         }

         if (!info[2]->IsNullOrUndefined()) {
            if (!IsSafeInteger(info[2])) // count
               throw NodeException(NodeError::Type, GetSafeNumberMessage(sizeof(size_t), "third argument", true));
            if (!IsSafeNumber(info[2], sizeof(size_t), true)) // count
               throw NodeException(NodeError::Range, GetSafeNumberMessage(sizeof(size_t), "third argument", true));
         }

         auto bytes = Buffer::Data(info[0]);
         auto byteLen = Buffer::Length(info[0]);
         auto offset = (size_t)CAST_OR_DEFAULT(info[1], Number, 0);
         if (offset > byteLen)
            throw NodeException(NodeError::Range, "offset is not allowed to be greater than buffer's length.");
         auto count = (size_t)CAST_OR_DEFAULT(info[2], Number, byteLen - offset);
         if (byteLen - offset < count)
            throw NodeException(NodeError::Range, "Your requested read range would cause buffer overflow.");
         auto obj = Unwrap<File>(info.Holder());
         WriteFile(obj->file, bytes + offset, 1, count);
      });
   }
   // flush(): void
   NAN_METHOD(File::flush) {
      HandleException([&]() {
         ThrowIfClosed(info);
         auto obj = Unwrap<File>(info.Holder());
         FlushFile(obj->file);
      });
   }
   // setBufSize(size: number): void
   NAN_METHOD(File::setBufSize) {
      HandleException([&]() {
         ThrowIfClosed(info);

         if (!IsSafeInteger(info[0])) // size
            throw NodeException(NodeError::Type, GetSafeNumberMessage(sizeof(size_t), "first argument", true));
         if (!IsSafeNumber(info[0], sizeof(size_t), true)) // size
            throw NodeException(NodeError::Range, GetSafeNumberMessage(sizeof(size_t), "first argument", true));

         auto size = (size_t)info[0].As<Number>()->Value();
         auto obj = Unwrap<File>(info.Holder());
         SetFileBufSize(obj->file, NULL, _IOFBF, size);
      });
   }
}