#ifndef EXCEPTION_HANDLER_H
#define EXCEPTION_HANDLER_H

#include <nan.h>
#include <exception>

enum class NodeError {
   Range, Reference, Generic, Type, Errno
};

struct NodeException : public std::exception {
   NodeError type;
   std::string message;
   std::string func;
   std::string path;
   NodeException(NodeError type, std::string message = "", std::string func = "", std::string path = "")
      : std::exception(message.c_str()), type(type), message(message), func(func), path(path) {}
   const char *what() const noexcept {
      return message.c_str();
   }
};

template<typename Func>
void HandleException(Func f) {
   try {
      f();
   } catch (NodeException &e) {
      switch (e.type) {
         case NodeError::Generic:
            return Nan::ThrowError(e.what());
         case NodeError::Range:
            return Nan::ThrowRangeError(e.what());
         case NodeError::Reference:
            return Nan::ThrowReferenceError(e.what());
         case NodeError::Type:
            return Nan::ThrowTypeError(e.what());
         case NodeError::Errno: {
            auto func = e.func.length() == 0 ? NULL : e.func.c_str();
            auto message = e.message.length() == 0 ? NULL : e.message.c_str();
            auto path = e.path.length() == 0 ? NULL : e.path.c_str();
            return Nan::ThrowError(
               Nan::ErrnoException(errno, func, message, path));
         }
         default:
            throw;
      }
   } catch (std::exception &e) {
      return Nan::ThrowError(e.what());
   }
}

#endif