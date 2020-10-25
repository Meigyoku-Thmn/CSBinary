#ifndef EXCEPTION_HANDLER_H
#define EXCEPTION_HANDLER_H

#include <napi.h>
#include <uv.h>
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
      : std::exception(), type(type), message(message), func(func), path(path) {}
   const char *what() const noexcept {
      return message.c_str();
   }
};

template<typename Func>
void HandleException(Napi::Env env, Func f) {
   try {
      f();
   } catch (NodeException &e) {
      switch (e.type) {
         case NodeError::Generic:
            return Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
         case NodeError::Range:
            return Napi::RangeError::New(env, e.what()).ThrowAsJavaScriptException();
         case NodeError::Reference:
            // waiting for a day that Napi would have ReferenceError
            return Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
         case NodeError::Type:
            return Napi::TypeError::New(env, e.what()).ThrowAsJavaScriptException();
         case NodeError::Errno: {
            auto func = e.func.Length() == 0 ? NULL : e.func.c_str();
            auto message = e.message.Length() == 0 ? NULL : e.message.c_str();
            auto path = e.path.Length() == 0 ? NULL : e.path.c_str();
            // {ErrnoString}: {ErrnoMessage}, {Message}
            return Napi::Error::New(env, Napi::ErrnoException(errno, func, message, path))
         }
         default:
            throw;
      }
   } catch (std::exception &e) {
      return Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
   }
}

#endif